import { describe, expect, it } from 'vitest'
import { computeFrontierComponents, computeTrivialDeductions } from '../decomposition.ts'
import { solve } from '../probability.ts'
import { makeBoard } from '../../__tests__/support/makeBoard.ts'

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
