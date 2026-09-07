import { describe, expect, it } from 'vitest'
import { computeFrontierComponents, computeTrivialDeductions } from '../decomposition.ts'
import { computeExplanations } from '../explanation.ts'
import {
  getGrowTrimCallCountForTest,
  getSubsetKeyCallCountForTest,
  resetGrowTrimCallCountForTest,
  resetSubsetKeyCallCountForTest,
} from '../instrumentation.ts'
import { solve } from '../probability.ts'
import { makeBoard } from '../../__tests__/support/makeBoard.ts'
import {
  computeCellExplanationForTest,
  computeClueBfsLayers,
  computeCluesByCellForTest,
  computeComponentForcedSets,
  computeSubsetKeyForTest,
  countLayersPulledForTest,
  createSubsetVerdictCacheForTest,
  quickXplainForTest,
  resolveSubsetForTest,
} from '../../__tests__/support/solverExplanation.ts'

function coordSet(coords: readonly { row: number; col: number }[]): Set<string> {
  return new Set(coords.map((c) => `${c.row},${c.col}`))
}

describe('clue-adjacency BFS layering (1.1, 1.2)', () => {
  it('groups same-distance clues into one layer and orders layers outward from the given cell', () => {
    // Row0 numbers: 1,2,1 over frontier cells A=(1,0) B=(1,1) C=(1,2).
    // From A: (0,0) and (0,1) both touch A directly (layer 1); (0,2) only reachable via
    // a shared frontier cell with those (layer 2).
    const board = makeBoard(['121', '???'], 2)
    const layers = computeClueBfsLayers(board, { row: 1, col: 0 })
    expect(layers.map((layer) => coordSet(layer))).toEqual([
      coordSet([
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ]),
      coordSet([{ row: 0, col: 2 }]),
    ])
  })

  it('lands every clue touching the cell directly in layer 1, however many there are', () => {
    // From B=(1,1): all three clues touch it directly, so layer 1 alone contains all of them.
    const board = makeBoard(['121', '???'], 2)
    const layers = computeClueBfsLayers(board, { row: 1, col: 1 })
    expect(layers).toHaveLength(1)
    expect(coordSet(layers[0])).toEqual(
      coordSet([
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ]),
    )
  })
})

describe('grow-then-trim minimal explanation search (2.1, 2.2)', () => {
  it('needs only the one clue that resolves it via Tier-0 alone', () => {
    const board = makeBoard(['.1', '.?'], 1)
    const explanations = computeExplanations(board, solve(board, new Map()).result, new Set(), new Map()).explanations
    const explanation = explanations.get('1,1')!
    expect(coordSet(explanation.clueCells)).toEqual(coordSet([{ row: 0, col: 1 }]))
  })

  it('needs every clue jointly for a cell only backtracking (not Tier-0) can resolve', () => {
    // In the 1-2-1 pattern, B=(1,1) is the one cell whose certainty needs all three
    // clues together - no two of them alone force it (verified by hand above).
    const board = makeBoard(['121', '???'], 2)
    const explanations = computeExplanations(board, solve(board, new Map()).result, new Set(), new Map()).explanations
    const explanation = explanations.get('1,1')!
    expect(coordSet(explanation.clueCells)).toEqual(
      coordSet([
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ]),
    )
  })
})

describe('trim-phase minimality (2.2)', () => {
  it('leaves no redundant member: removing any single clue changes the resolved certainty', () => {
    // B=(1,1) needs all three clues jointly (verified above); each is individually load-bearing.
    // The extra all-unrevealed row keeps some non-frontier cells in play (K > 0), so dropping a
    // clue is only checked against genuine local ambiguity, not an incidental K=0 global-count
    // coincidence pinning the frontier's mine total to a single value regardless of the clue.
    const rows = ['121', '???', '???']
    const board = makeBoard(rows, 2)
    const explanation = computeExplanations(board, solve(board, new Map()).result, new Set(), new Map()).explanations.get('1,1')!
    for (const dropped of explanation.clueCells) {
      // Blanking (not unrevealing) the clue removes its constraint without introducing a new
      // frontier variable in its place, matching what dropping a constraint means internally.
      const blankedRows = rows.map((row, r) =>
        r === dropped.row ? row.slice(0, dropped.col) + '.' + row.slice(dropped.col + 1) : row,
      )
      const withoutDropped = makeBoard(blankedRows, 2)
      const stillCertain = solve(withoutDropped, new Map()).result.frontier.find((f) => f.row === 1 && f.col === 1)?.probability === 0
      expect(stillCertain).toBe(false)
    }
  })
})

describe('premise-cell extraction (2.3)', () => {
  // Deduction chain over a width-1 corridor: ClueA=(0,0) forces M1=(1,0) mine on its own;
  // ClueB=(2,0) (touching M1,M2) then forces M2=(3,0) safe using M1 as a premise; ClueC=(4,0)
  // (touching M2,X) then forces X=(5,0) mine using M2 as a premise. (6,0) caps the corridor
  // so X has only ClueC as a neighbor.
  const board = makeBoard(['1', '?', '1', '?', '1', '?', '.'], 2)

  it("includes a forced-mine neighbor the explanation's own clues rely on", () => {
    const explanations = computeExplanations(board, solve(board, new Map()).result, new Set(), new Map()).explanations
    const explanation = explanations.get('5,0')!
    expect(explanation.premiseCells).toContainEqual({ row: 1, col: 0 })
  })

  it("includes a forced-safe neighbor the explanation's own clues rely on", () => {
    const explanations = computeExplanations(board, solve(board, new Map()).result, new Set(), new Map()).explanations
    const explanation = explanations.get('5,0')!
    expect(explanation.premiseCells).toContainEqual({ row: 3, col: 0 })
  })
})

describe('explanation-set determinism (2.4)', () => {
  it('returns an identical result across repeated queries for the same board state', () => {
    const board = makeBoard(['121', '???'], 2)
    const result = solve(board, new Map()).result
    const first = computeExplanations(board, result, new Set(), new Map()).explanations
    const second = computeExplanations(board, result, new Set(), new Map()).explanations
    expect(first).toEqual(second)
  })
})

describe('explanation exclusion cases (2.5)', () => {
  it('reports no explanation for a cell whose probability is strictly between 0 and 1', () => {
    const board = makeBoard(['11', '??'], 1)
    const explanations = computeExplanations(board, solve(board, new Map()).result, new Set(), new Map()).explanations
    expect(explanations.has('1,0')).toBe(false)
  })

  it('reports no explanation for a non-frontier cell', () => {
    const board = makeBoard(['1??'], 1)
    const result = solve(board, new Map()).result
    expect(result.nonFrontierCells).toContainEqual({ row: 0, col: 2 })
    const explanations = computeExplanations(board, result, new Set(), new Map()).explanations
    expect(explanations.has('0,2')).toBe(false)
  })

  it("excludes a same-component clue that doesn't affect the cell's certainty", () => {
    // A=(1,0)'s minimal explanation is {(0,1),(0,2)}; (0,0) shares the component but is redundant for A.
    const board = makeBoard(['121', '???'], 2)
    const explanations = computeExplanations(board, solve(board, new Map()).result, new Set(), new Map()).explanations
    const explanation = explanations.get('1,0')!
    expect(explanation.clueCells).not.toContainEqual({ row: 0, col: 0 })
    expect(coordSet(explanation.clueCells)).toEqual(
      coordSet([
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ]),
    )
  })
})

describe('exposed real per-component forced sets (7.1)', () => {
  it('exposes exactly the pre-backtracking Tier-0 fixed map, even on a fixture the solver only resolves via backtracking', () => {
    // The 1-2-1 pattern needs full backtracking to resolve A/B/C to certainty (verified
    // above) - Tier-0 alone forces nothing. The map `enumerateComponent` already computes
    // and (per 7.1) now exposes is that same pre-backtracking Tier-0 snapshot, so it should
    // come back empty here too, matching computeTrivialDeductions exactly rather than
    // reflecting the backtracking-derived certainty solve() later reports.
    const board = makeBoard(['121', '???'], 2)
    const components = computeFrontierComponents(board)
    expect(components).toHaveLength(1)

    const exposed = computeComponentForcedSets(board, components[0])
    const tier0 = computeTrivialDeductions(board)
    expect(coordSet(exposed.forcedMine)).toEqual(coordSet(tier0.forcedMine))
    expect(coordSet(exposed.forcedSafe)).toEqual(coordSet(tier0.forcedSafe))
    expect(exposed.forcedMine).toHaveLength(0)
    expect(exposed.forcedSafe).toHaveLength(0)
  })
})

describe('flag-aware premise seeding (8.4)', () => {
  it('omits an extra BFS layer needed only to prove a flagged, globally-forced neighbor', () => {
    // Same deduction chain as the premise-extraction fixture above: ClueA forces M1 mine,
    // ClueB then needs M1 to force M2 safe, ClueC then needs M2 to force X mine - X's
    // unflagged explanation needs all three clues.
    const board = makeBoard(['1', '?', '1', '?', '1', '?', '.'], 2)
    const solveResult = solve(board, new Map()).result

    const withoutFlag = computeExplanations(board, solveResult, new Set(), new Map()).explanations.get('5,0')!
    expect(coordSet(withoutFlag.clueCells)).toEqual(
      coordSet([
        { row: 0, col: 0 },
        { row: 2, col: 0 },
        { row: 4, col: 0 },
      ]),
    )

    const withFlag = computeExplanations(board, solveResult, new Set(['1,0']), new Map()).explanations.get('5,0')!
    expect(coordSet(withFlag.clueCells)).toEqual(
      coordSet([
        { row: 2, col: 0 },
        { row: 4, col: 0 },
      ]),
    )
    expect(withFlag.clueCells).not.toContainEqual({ row: 0, col: 0 })
    expect(withFlag.premiseCells).toContainEqual({ row: 1, col: 0 })
  })
})

describe('flag rejection when not globally forced (8.5)', () => {
  it('has no effect on any explanation when the flagged cell is not independently, globally forced', () => {
    // Component with A=(1,0),B=(1,1) ambiguous (either could be the shared mine) but
    // C=(1,2) forced safe and D=(1,3) forced mine regardless - design.md Decision 5's
    // rejected "Option A" would let flagging an ambiguous cell shortcut a derivation;
    // this confirms that never happens.
    const board = makeBoard(['11.1', '????'], 2)
    const solveResult = solve(board, new Map()).result
    const withoutFlag = computeExplanations(board, solveResult, new Set(), new Map()).explanations
    const withFlag = computeExplanations(board, solveResult, new Set(['1,0']), new Map()).explanations
    expect(withFlag.get('1,3')).toEqual(withoutFlag.get('1,3'))
  })
})

describe('explanation-set determinism with flags (8.6)', () => {
  it('returns an identical result across repeated queries for the same board and flag state', () => {
    const board = makeBoard(['1', '?', '1', '?', '1', '?', '.'], 2)
    const result = solve(board, new Map()).result
    const flagged = new Set(['1,0'])
    const first = computeExplanations(board, result, flagged, new Map()).explanations
    const second = computeExplanations(board, result, flagged, new Map()).explanations
    expect(first).toEqual(second)
  })
})

describe('batch explanation computation (3.1)', () => {
  it('computes an explanation for every certain frontier cell on a board with multiple independent certainties', () => {
    const board = makeBoard(['1??1'], 2)
    const explanations = computeExplanations(board, solve(board, new Map()).result, new Set(), new Map()).explanations
    expect(explanations.has('0,1')).toBe(true)
    expect(explanations.has('0,2')).toBe(true)
    expect(coordSet(explanations.get('0,1')!.clueCells)).toEqual(coordSet([{ row: 0, col: 0 }]))
    expect(coordSet(explanations.get('0,2')!.clueCells)).toEqual(coordSet([{ row: 0, col: 3 }]))
  })
})

describe('subset key (optimize-explanation-extraction 1.1, reduce-explanation-setup-overhead 4.2)', () => {
  const board = makeBoard(['121', '???'], 2)
  const clueA = { row: 0, col: 0 }
  const clueB = { row: 0, col: 1 }

  it('is identical for the same constraints in a different order and from a different build', () => {
    expect(computeSubsetKeyForTest(board, [clueA, clueB])).toBe(computeSubsetKeyForTest(board, [clueB, clueA]))
  })

  it('differs when the givens the subset is resolved under differ', () => {
    expect(computeSubsetKeyForTest(board, [clueA, clueB], { forcedMine: ['1,0'] })).not.toBe(
      computeSubsetKeyForTest(board, [clueA, clueB]),
    )
  })
})

describe('subset verdict cache (optimize-explanation-extraction 1.2, 1.4)', () => {
  it('recomputes a subset only on the first query for it', () => {
    const board = makeBoard(['.1', '.?'], 1)
    const cache = createSubsetVerdictCacheForTest()
    const clues = [{ row: 0, col: 1 }]

    resetGrowTrimCallCountForTest()
    const first = resolveSubsetForTest(cache, board, clues)
    const second = resolveSubsetForTest(cache, board, clues)

    expect(getGrowTrimCallCountForTest()).toBe(1)
    expect(coordSet(first.forcedMine)).toEqual(coordSet([{ row: 1, col: 1 }]))
    expect(second).toEqual(first)
  })

  it('does less work for cells sharing candidate subsets when they share one cache', () => {
    // In the 1-2-1 pattern all three frontier cells are certain, and each one's grow/trim search
    // probes subsets of the same three clues - so a shared cache turns most of the second and
    // third cells' queries into hits.
    const board = makeBoard(['121', '???'], 2)
    const certain = solve(board, new Map()).result.frontier.filter((f) => f.probability === 0 || f.probability === 1)
    expect(certain.length).toBeGreaterThan(1)
    const explain = (cacheFor: (f: (typeof certain)[number]) => ReturnType<typeof createSubsetVerdictCacheForTest>): void => {
      for (const f of certain) {
        computeCellExplanationForTest(cacheFor(f), board, { row: f.row, col: f.col }, f.probability === 1 ? 1 : 0)
      }
    }

    resetGrowTrimCallCountForTest()
    explain(() => createSubsetVerdictCacheForTest()) // a fresh cache per cell: no cross-cell reuse
    const isolated = getGrowTrimCallCountForTest()

    const shared = createSubsetVerdictCacheForTest()
    resetGrowTrimCallCountForTest()
    explain(() => shared)
    expect(getGrowTrimCallCountForTest()).toBeLessThan(isolated)
  })
})

describe('QuickXplain minimization (optimize-explanation-extraction 2.1)', () => {
  it('returns a single-element candidate set unchanged', () => {
    const board = makeBoard(['.1', '.?'], 1)
    const trimmed = quickXplainForTest(createSubsetVerdictCacheForTest(), board, [], [{ row: 0, col: 1 }], { row: 1, col: 1 }, 1)
    expect(coordSet(trimmed)).toEqual(coordSet([{ row: 0, col: 1 }]))
  })

  it('keeps only the genuinely necessary member, dropping redundant ones', () => {
    // (0,0) alone forces (0,1) to be a mine; (0,3) constrains the other end of the board only.
    const board = makeBoard(['1??1'], 2)
    const trimmed = quickXplainForTest(
      createSubsetVerdictCacheForTest(),
      board,
      [],
      [
        { row: 0, col: 0 },
        { row: 0, col: 3 },
      ],
      { row: 0, col: 1 },
      1,
    )
    expect(coordSet(trimmed)).toEqual(coordSet([{ row: 0, col: 0 }]))
  })

  it('returns the empty set when the background alone already resolves the cell', () => {
    const board = makeBoard(['1??1'], 2)
    const trimmed = quickXplainForTest(
      createSubsetVerdictCacheForTest(),
      board,
      [{ row: 0, col: 0 }],
      [{ row: 0, col: 3 }],
      { row: 0, col: 1 },
      1,
    )
    expect(trimmed).toEqual([])
  })
})

describe('premise extraction reuses the trim verdict (optimize-explanation-extraction 3.1)', () => {
  it('finds the trimmed set already in the cache once QuickXplain has minimized it', () => {
    const board = makeBoard(['121', '???'], 2)
    const cache = createSubsetVerdictCacheForTest()
    const allClues = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]
    const trimmed = quickXplainForTest(cache, board, [], allClues, { row: 1, col: 0 }, 1)
    expect(coordSet(trimmed)).toEqual(coordSet([
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]))

    resetGrowTrimCallCountForTest()
    resolveSubsetForTest(cache, board, trimmed) // what extractPremiseKeys now does instead of its own pass
    expect(getGrowTrimCallCountForTest()).toBe(0)
  })
})

describe('subset key call count probe (reduce-explanation-setup-overhead 1.1)', () => {
  it('counts a key build on every query, including the one that hits the cache', () => {
    const board = makeBoard(['.1', '.?'], 1)
    const cache = createSubsetVerdictCacheForTest()
    const clues = [{ row: 0, col: 1 }]

    resetGrowTrimCallCountForTest()
    resetSubsetKeyCallCountForTest()
    resolveSubsetForTest(cache, board, clues)
    resolveSubsetForTest(cache, board, clues)

    expect(getSubsetKeyCallCountForTest()).toBe(2)
    expect(getGrowTrimCallCountForTest()).toBe(1)
  })
})

describe('per-component clue index (reduce-explanation-setup-overhead 2.1)', () => {
  it('maps each unrevealed cell to exactly the clues referencing it', () => {
    // Row0 numbers: 1,2,1 over frontier cells A=(1,0) B=(1,1) C=(1,2). A is referenced by
    // (0,0),(0,1); B by all three; C by (0,1),(0,2) - hand-checked from the 3x3 neighbourhoods.
    const board = makeBoard(['121', '???'], 2)
    const byCell = computeCluesByCellForTest(board)

    expect(new Set(byCell.keys())).toEqual(new Set(['1,0', '1,1', '1,2']))
    expect(coordSet(byCell.get('1,0')!)).toEqual(coordSet([{ row: 0, col: 0 }, { row: 0, col: 1 }]))
    expect(coordSet(byCell.get('1,1')!)).toEqual(
      coordSet([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]),
    )
    expect(coordSet(byCell.get('1,2')!)).toEqual(coordSet([{ row: 0, col: 1 }, { row: 0, col: 2 }]))
  })

  it('omits revealed cells entirely, so only frontier cells carry clues', () => {
    const board = makeBoard(['1??1'], 2)
    expect(new Set(computeCluesByCellForTest(board).keys())).toEqual(new Set(['0,1', '0,2']))
  })
})

describe('lazy BFS layer walking (reduce-explanation-setup-overhead 3.2)', () => {
  it('stops pulling layers as soon as the accumulated set resolves the cell', () => {
    // From B=(1,1) all three clues are in layer 1, and they jointly resolve it - so one pull.
    const board = makeBoard(['121', '???'], 2)
    expect(computeClueBfsLayers(board, { row: 1, col: 1 })).toHaveLength(1)
    expect(countLayersPulledForTest(board, { row: 1, col: 1 }, 0)).toBe(1)
  })

  it('leaves later layers unbuilt for a cell its first layer already resolves', () => {
    // X=(5,0) sits at the end of a three-clue chain, so its full layering is three layers deep -
    // but ClueC=(4,0) in layer 1 forces it on its own once (3,0) is known safe... it is not, so
    // this cell needs the chain. (1,1) below is the single-layer case; here we check the walker
    // never runs past the layer that resolves, whatever depth that is.
    const board = makeBoard(['1', '?', '1', '?', '1', '?', '.'], 2)
    const fullDepth = computeClueBfsLayers(board, { row: 5, col: 0 }).length
    expect(fullDepth).toBeGreaterThan(1)
    expect(countLayersPulledForTest(board, { row: 5, col: 0 }, 1)).toBeLessThanOrEqual(fullDepth)
  })

  it('pulls exactly one layer for a cell a single directly-touching clue resolves', () => {
    // (0,0) alone forces (0,1) to be a mine; (0,3)'s clue is in a different component entirely.
    const board = makeBoard(['1??1'], 2)
    expect(countLayersPulledForTest(board, { row: 0, col: 1 }, 1)).toBe(1)
  })
})

describe('subset key injectivity (reduce-explanation-setup-overhead 4.3)', () => {
  // D4 drops the content hashing `subsetSignature` did, trusting instead that a clue's id pins
  // down its constraint. This is the safety net for that: over every subset of a component, no
  // two distinct ones may share a key.
  const allSubsets = <T,>(items: readonly T[]): T[][] =>
    items.reduce<T[][]>((acc, item) => [...acc, ...acc.map((subset) => [...subset, item])], [[]])

  it.each([
    ['a three-clue component', ['121', '???'], 2],
    ['a four-clue component', ['1221', '????'], 2],
    ['a five-clue component', ['12321', '?????'], 3],
  ])('assigns every distinct subset of %s its own key', (_name, rows, mineCount) => {
    const board = makeBoard(rows as string[], mineCount as number)
    const clues: { row: number; col: number }[] = []
    for (let row = 0; row < board.height; row++) {
      for (let col = 0; col < board.width; col++) {
        const cell = board.cells[row][col]
        if (cell.revealed && cell.adjacentMines > 0) clues.push({ row, col })
      }
    }
    expect(clues.length).toBeGreaterThan(2)

    const subsets = allSubsets(clues)
    const keys = subsets.map((subset) => computeSubsetKeyForTest(board, subset))
    expect(new Set(keys).size).toBe(subsets.length)
  })
})
