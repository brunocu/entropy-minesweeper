import { describe, expect, it } from 'vitest'
import { computeFrontierComponents, computeTrivialDeductions, decompose } from '../decomposition.ts'
import { solve } from '../probability.ts'
import { makeBoard } from '../../__tests__/support/makeBoard.ts'

function coordSet(coords: readonly { row: number; col: number }[]): Set<string> {
  return new Set(coords.map((c) => `${c.row},${c.col}`))
}

describe('frontier identification', () => {
  it('finds every unrevealed cell adjacent to a revealed numbered cell', () => {
    const board = makeBoard(['111', '???'], 1)
    const expected = coordSet([
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
    ])
    const frontierCoords = solve(decompose(board), new Map()).result.frontier.map((f) => ({ row: f.row, col: f.col }))
    expect(coordSet(frontierCoords)).toEqual(expected)
  })
})

describe('Tier 0 trivial deduction', () => {
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

describe('frontier component decomposition', () => {
  it('splits disjoint frontier regions into separate components', () => {
    const board = makeBoard(['1??1'], 2)
    const components = computeFrontierComponents(board)
    expect(components).toHaveLength(2)
    const asSets = components.map((c) => coordSet(c))
    expect(asSets).toContainEqual(coordSet([{ row: 0, col: 1 }]))
    expect(asSets).toContainEqual(coordSet([{ row: 0, col: 2 }]))
  })
})

describe('shared decomposition', () => {
  // Two clue clusters that share no cell, plus an unrevealed corner no number touches:
  // enough structure that a slice built from the wrong component would show up.
  const board = makeBoard(['1?.?1', '?????', '.....'], 3)

  it('slices each component to exactly the constraints the per-consumer filter would have kept', () => {
    const { componentSlices, constraints } = decompose(board)
    expect(componentSlices).toHaveLength(2) // the two clue clusters, sharing no cell

    for (const slice of componentSlices) {
      const cellSet = new Set(slice.cells)
      // The per-component scan the slices stand in for.
      const byFilter = constraints.filter((c) => c.cells.some((k) => cellSet.has(k)))
      expect(slice.relevantConstraints).toEqual(byFilter)
    }
  })

  it('covers every frontier cell exactly once across its slices', () => {
    const { componentSlices, frontierKeys } = decompose(board)
    const covered = componentSlices.flatMap((s) => [...s.cells])
    expect(new Set(covered).size).toBe(covered.length)
    expect(new Set(covered)).toEqual(new Set(frontierKeys))
  })

  it('splits every unrevealed cell into either the frontier or the non-frontier pool', () => {
    const { frontierSet, nonFrontierCells } = decompose(board)
    const unrevealed = board.cells.flatMap((row, r) =>
      row.flatMap((cell, c) => (cell.revealed ? [] : [`${r},${c}`])),
    )
    const nonFrontierKeys = new Set(nonFrontierCells.map((c) => `${c.row},${c.col}`))
    expect(nonFrontierKeys.size + frontierSet.size).toBe(unrevealed.length)
    for (const k of unrevealed) expect(frontierSet.has(k) || nonFrontierKeys.has(k)).toBe(true)
  })

  it('carries the board it was derived from, so the two cannot be paired wrongly', () => {
    expect(decompose(board).board).toBe(board)
  })
})
