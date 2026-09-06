import { describe, expect, it } from 'vitest'
import {
  computeCellExplanationForTest,
  computeClueBfsLayers,
  computeComponentForcedSets,
  computeComponentSignature,
  computeExplanations,
  computeFrontierComponents,
  computeSubsetSignatureForTest,
  computeTrivialDeductions,
  createSubsetVerdictCacheForTest,
  getEnumerationCallCountForTest,
  getGrowTrimCallCountForTest,
  quickXplainForTest,
  resetEnumerationCallCountForTest,
  resetGrowTrimCallCountForTest,
  resolveSubsetForTest,
  solve,
  type SolverBoard,
  type SolverCell,
} from './frontierSolver.ts'

/**
 * Builds a SolverBoard from a compact text grid:
 *   '?' unrevealed
 *   '.' revealed blank (adjacentMines 0)
 *   '0'-'8' revealed numbered cell
 * Rows need not be reachable via real flood-fill play; they exercise the solver
 * as a pure function of board state. Flags carry no solver meaning - flagging
 * is UI-only - so there is no flagged marker in this grid.
 */
function makeBoard(rows: string[], mineCount: number): SolverBoard {
  const height = rows.length
  const width = rows[0].length
  const cells: SolverCell[][] = rows.map((row) =>
    row.split('').map((ch): SolverCell => {
      if (ch === '?') return { revealed: false, adjacentMines: 0 }
      if (ch === '.') return { revealed: true, adjacentMines: 0 }
      return { revealed: true, adjacentMines: Number(ch) }
    }),
  )
  return { width, height, mineCount, cells }
}

function coordSet(coords: readonly { row: number; col: number }[]): Set<string> {
  return new Set(coords.map((c) => `${c.row},${c.col}`))
}

describe('frontier identification (3.1)', () => {
  it('finds every unrevealed cell adjacent to a revealed numbered cell', () => {
    const board = makeBoard(['111', '???'], 1)
    const expected = coordSet([
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
    ])
    const frontierCoords = solve(board, new Map()).result.frontier.map((f) => ({ row: f.row, col: f.col }))
    expect(coordSet(frontierCoords)).toEqual(expected)
  })
})

describe('Tier 0 trivial deduction (3.2)', () => {
  it('marks remaining neighbors safe when a number is already fully satisfied by a deduced mine', () => {
    // (0,1) forces (1,1) to be a mine on its own; that deduced mine then fully
    // satisfies (2,1)'s count, leaving (2,0) safe.
    const board = makeBoard(['.1', '.?', '?1'], 1)
    const { forcedSafe, forcedMine } = computeTrivialDeductions(board)
    expect(coordSet(forcedMine)).toEqual(coordSet([{ row: 1, col: 1 }]))
    expect(coordSet(forcedSafe)).toEqual(coordSet([{ row: 2, col: 0 }]))
  })

  it('forces remaining neighbors to be mines when their count equals the unsatisfied count', () => {
    const board = makeBoard(['.1', '.?'], 1)
    const { forcedMine } = computeTrivialDeductions(board)
    expect(coordSet(forcedMine)).toEqual(coordSet([{ row: 1, col: 1 }]))
  })

  it('flagging a cell does not satisfy a neighbor\'s mine count', () => {
    // With no flag concept at the solver level, a board with an unrevealed cell
    // the player has flagged solves identically to the same board unflagged:
    // the "1" here has two unrevealed neighbors and is not resolved to certainty.
    const board = makeBoard(['1?', '??'], 1)
    const { forcedSafe, forcedMine } = computeTrivialDeductions(board)
    expect(forcedSafe).toHaveLength(0)
    expect(forcedMine).toHaveLength(0)
  })
})

describe('component cache signature (1.2)', () => {
  it('is identical regardless of constraint/flag insertion order, and changes when any input changes', () => {
    const board = makeBoard(['121', '???'], 2)
    const components = computeFrontierComponents(board)
    expect(components).toHaveLength(1)
    const component = components[0]
    const reversedComponent = [...component].reverse()

    const flags = new Set(['1,0'])
    const baseline = computeComponentSignature(board, component, flags)
    expect(computeComponentSignature(board, reversedComponent, flags)).toBe(baseline)

    // A different flagged subset changes the signature.
    expect(computeComponentSignature(board, component, new Set(['1,1']))).not.toBe(baseline)
    expect(computeComponentSignature(board, component, new Set())).not.toBe(baseline)

    // A different board (different constraint structure) changes the signature.
    const otherBoard = makeBoard(['131', '???'], 2)
    expect(computeComponentSignature(otherBoard, component, flags)).not.toBe(baseline)
  })
})

describe('solve component cache (2.4)', () => {
  it('reuses cached enumeration across an unchanged board, and only re-enumerates a changed component', () => {
    // Two disjoint single-cell components: (0,1) under clue (0,0), (0,2) under clue (0,3).
    const board = makeBoard(['1??1'], 2)
    const changedBoard = makeBoard(['2??1'], 2) // only the left clue's requiredMines changes

    resetEnumerationCallCountForTest()
    const first = solve(board, new Map())
    expect(getEnumerationCallCountForTest()).toBe(2) // one enumeration per component, first time

    resetEnumerationCallCountForTest()
    solve(board, first.cache)
    expect(getEnumerationCallCountForTest()).toBe(0) // unchanged board: both components hit cache

    resetEnumerationCallCountForTest()
    solve(changedBoard, first.cache)
    expect(getEnumerationCallCountForTest()).toBe(1) // only the changed component re-enumerates
  })
})

describe('computeExplanations component cache (3.2, 3.3)', () => {
  it('reuses a solve-produced cache: performs zero fresh top-level enumeration for components solve already populated', () => {
    const board = makeBoard(['121', '???'], 2)
    const { result, cache: solveCache } = solve(board, new Map())

    resetEnumerationCallCountForTest()
    computeExplanations(board, result, new Set(), solveCache)
    expect(getEnumerationCallCountForTest()).toBe(0)
  })

  it('reuses cached explanations across repeated calls: no new grow/trim search on the second call', () => {
    const board = makeBoard(['121', '???'], 2)
    const { result, cache: solveCache } = solve(board, new Map())

    resetGrowTrimCallCountForTest()
    const first = computeExplanations(board, result, new Set(), solveCache)
    expect(getGrowTrimCallCountForTest()).toBeGreaterThan(0) // first call actually runs grow/trim

    resetGrowTrimCallCountForTest()
    const second = computeExplanations(board, result, new Set(), first.cache)
    expect(getGrowTrimCallCountForTest()).toBe(0)
    expect(second.explanations).toEqual(first.explanations)
  })
})

describe('toggleFlag-shaped cache reuse (3.4, 3.5)', () => {
  // Two disjoint components: A={(0,1),(1,0),(1,1)} under clue (0,0), B={(0,3),(1,3),(1,4)} under
  // clue (0,4). (0,2)/(1,2) are non-frontier (not adjacent to any revealed numbered cell).
  const board = makeBoard(['1???1', '?????'], 2)

  it('is a full cache hit when the toggled cell is outside every frontier component', () => {
    const result = solve(board, new Map()).result
    const before = computeExplanations(board, result, new Set(), new Map())

    const after = computeExplanations(board, result, new Set(['0,2']), before.cache)

    expect(after.cache).toEqual(before.cache)
    expect(after.explanations).toEqual(before.explanations)
  })

  it('recomputes only the component containing a toggled frontier cell, carrying other components over unchanged', () => {
    const result = solve(board, new Map()).result
    const before = computeExplanations(board, result, new Set(), new Map())

    const after = computeExplanations(board, result, new Set(['0,1']), before.cache) // (0,1) is in component A

    expect(after.cache.size).toBe(before.cache.size)
    const beforeKeys = new Set(before.cache.keys())
    const afterKeys = new Set(after.cache.keys())
    const removed = [...beforeKeys].filter((k) => !afterKeys.has(k))
    const added = [...afterKeys].filter((k) => !beforeKeys.has(k))
    const unchanged = [...beforeKeys].filter((k) => afterKeys.has(k))

    expect(removed).toHaveLength(1) // component A's old signature is gone
    expect(added).toHaveLength(1) // component A got a fresh signature (new enumeration+explanations)
    expect(unchanged).toHaveLength(before.cache.size - 1) // component B carried over unchanged
    for (const k of unchanged) {
      expect(after.cache.get(k)).toEqual(before.cache.get(k))
    }
  })
})

describe('component cache pruning (3.6)', () => {
  it('drops a component signature from the cache once a board change removes that component', () => {
    const board = makeBoard(['1???1', '?????'], 2)
    // Component A's own frontier cells are all revealed away, eliminating it; component B (under
    // clue (0,4)) is untouched, so its signature carries over identically.
    const changedBoard = makeBoard(['1.??1', '..???'], 2)

    const firstResult = solve(board, new Map()).result
    const first = computeExplanations(board, firstResult, new Set(), new Map())
    expect(first.cache.size).toBe(2)

    const secondResult = solve(changedBoard, new Map()).result
    const second = computeExplanations(changedBoard, secondResult, new Set(), first.cache)

    expect(second.cache.size).toBe(1)
    const firstKeys = [...first.cache.keys()]
    const secondKeys = new Set(second.cache.keys())
    expect(firstKeys.filter((k) => secondKeys.has(k))).toHaveLength(1) // component B survives
    expect(firstKeys.filter((k) => !secondKeys.has(k))).toHaveLength(1) // component A is dropped
  })
})

describe('frontier component decomposition (3.3)', () => {
  it('splits disjoint frontier regions into separate components', () => {
    const board = makeBoard(['1??1'], 2)
    const components = computeFrontierComponents(board)
    expect(components).toHaveLength(2)
    const asSets = components.map((c) => coordSet(c))
    expect(asSets).toContainEqual(coordSet([{ row: 0, col: 1 }]))
    expect(asSets).toContainEqual(coordSet([{ row: 0, col: 2 }]))
  })
})

describe('exact joint world enumeration (3.4)', () => {
  it('resolves a cell to certainty via the 1-2-1 pattern, which neither single constraint forces alone', () => {
    // Row0 numbers: 1,2,1 over frontier cells A=(1,0) B=(1,1) C=(1,2).
    // Jointly: A+B=1, A+B+C=2, B+C=1 => unique solution A=1,B=0,C=1.
    const board = makeBoard(['121', '???'], 2)
    const result = solve(board, new Map()).result
    const byCoord = new Map(result.frontier.map((f) => [`${f.row},${f.col}`, f]))
    expect(byCoord.get('1,0')!.probability).toBeCloseTo(1)
    expect(byCoord.get('1,1')!.probability).toBeCloseTo(0)
    expect(byCoord.get('1,2')!.probability).toBeCloseTo(1)
  })
})

describe('global mine-count weighting (3.5)', () => {
  it('normalizes per-cell marginal probabilities so expected mine count matches the board total', () => {
    // Width-1 corridor: R1=(1,0) constrains {X0,A}; R2=(3,0) constrains {A,X4}.
    // Two non-frontier cells N1=(5,0), N2=(6,0). mineCount=2.
    const board = makeBoard(['?', '1', '?', '1', '?', '?', '?'], 2)
    const result = solve(board, new Map()).result
    const byCoord = new Map(result.frontier.map((f) => [`${f.row},${f.col}`, f]))
    expect(byCoord.get('2,0')!.probability).toBeCloseTo(2 / 3) // A
    expect(byCoord.get('0,0')!.probability).toBeCloseTo(1 / 3) // X0
    expect(byCoord.get('4,0')!.probability).toBeCloseTo(1 / 3) // X4
    expect(result.nonFrontierProbability).toBeCloseTo(1 / 3)

    const expectedTotal =
      byCoord.get('2,0')!.probability +
      byCoord.get('0,0')!.probability +
      byCoord.get('4,0')!.probability +
      result.nonFrontierCells.length * (result.nonFrontierProbability ?? 0)
    expect(expectedTotal).toBeCloseTo(board.mineCount)
  })
})

describe('non-frontier probability (3.6)', () => {
  it('gives every non-frontier cell the same probability, which shifts with the remaining mine count', () => {
    const lowMineBoard = makeBoard(['?', '1', '?', '1', '?', '?', '?'], 2)
    const highMineBoard = makeBoard(['?', '1', '?', '1', '?', '?', '?'], 3)

    const lowResult = solve(lowMineBoard, new Map()).result
    const highResult = solve(highMineBoard, new Map()).result

    expect(lowResult.nonFrontierCells).toHaveLength(2)
    expect(lowResult.nonFrontierProbability).toBeCloseTo(1 / 3)
    expect(highResult.nonFrontierProbability).toBeCloseTo(2 / 3)
    expect(lowResult.nonFrontierProbability).not.toBeCloseTo(highResult.nonFrontierProbability ?? NaN, 5)
  })
})

describe('expected information gain for frontier cells (3.7)', () => {
  it('matches a hand-computed example: two symmetric cells, either resolves the board with certainty', () => {
    // Two "1"s sharing the same two unrevealed neighbors A,B; mineCount=1 so exactly one of A,B is a mine.
    // Revealing either cell fully resolves the other with certainty => EIG = prior entropy = 1 bit.
    const board = makeBoard(['11', '??'], 1)
    const result = solve(board, new Map()).result
    const a = result.frontier.find((f) => f.row === 1 && f.col === 0)!
    expect(a.probability).toBeCloseTo(0.5)
    expect(a.eig).toBeCloseTo(1, 5)
    expect(a.outcomeProbabilities.get('mine')).toBeCloseTo(0.5)
    expect(a.outcomeProbabilities.get('safe:1')).toBeCloseTo(0.5)
  })
})

describe('outcome probabilities for frontier cells (3.8)', () => {
  it('reports per-outcome probabilities consistent with the pre-reveal distribution', () => {
    const board = makeBoard(['?', '1', '?', '1', '?', '?', '?'], 2)
    const result = solve(board, new Map()).result
    const a = result.frontier.find((f) => f.row === 2 && f.col === 0)!

    expect(a.eig).toBeCloseTo(0.91829, 4)
    expect(a.outcomeProbabilities.get('mine')).toBeCloseTo(2 / 3, 5)
    expect(a.outcomeProbabilities.get('safe:0')).toBeCloseTo(1 / 3, 5)
  })
})

describe('total joint uncertainty (totalEntropyBits)', () => {
  it('is exactly 0 bits when only one configuration remains consistent', () => {
    // 1-2-1 pattern uniquely resolves A=1,B=0,C=1 with no non-frontier cells remaining.
    const board = makeBoard(['121', '???'], 2)
    expect(solve(board, new Map()).result.totalEntropyBits).toBe(0)
  })

  it('does not increase after a reveal that adds a constraint', () => {
    // "before" is the same board with the middle numbered cell still unrevealed.
    const before = makeBoard(['1?1', '???'], 2)
    const after = makeBoard(['121', '???'], 2)
    expect(solve(after, new Map()).result.totalEntropyBits).toBeLessThanOrEqual(solve(before, new Map()).result.totalEntropyBits)
  })

  it('equals log2(C(K, remainingMines)) for a board with no frontier', () => {
    const board = makeBoard(['???', '???'], 2)
    expect(solve(board, new Map()).result.frontier).toHaveLength(0)
    const K = 6
    const remainingMines = 2
    const expected = Math.log2(binomialForTest(K, remainingMines))
    expect(solve(board, new Map()).result.totalEntropyBits).toBeCloseTo(expected, 10)
  })
})

function binomialForTest(n: number, k: number): number {
  let result = 1
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1)
  return result
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

describe('subset signature (optimize-explanation-extraction 1.1)', () => {
  const board = makeBoard(['121', '???'], 2)
  const clueA = { row: 0, col: 0 }
  const clueB = { row: 0, col: 1 }

  it('is identical for the same constraints in a different order and from a different build', () => {
    expect(computeSubsetSignatureForTest(board, [clueA, clueB])).toBe(computeSubsetSignatureForTest(board, [clueB, clueA]))
  })

  it('differs when the givens the subset is resolved under differ', () => {
    expect(computeSubsetSignatureForTest(board, [clueA, clueB], { forcedMine: ['1,0'] })).not.toBe(
      computeSubsetSignatureForTest(board, [clueA, clueB]),
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
