import { describe, expect, it } from 'vitest'
import { makeBoard } from '../../__tests__/support/makeBoard.ts'
import { decompose } from '../decomposition.ts'
import { solve } from '../probability.ts'

/**
 * Five unknowns that resolve to exactly four worlds, which is what makes the counts below
 * checkable by hand: B1's `1` sees only A1 and A2, so exactly one of that pair is a mine; C2's
 * `1` sees only B3 and C3, so exactly one of that pair is too; B2's `3` sees all five, and with
 * those two accounted for A3 must be the third. Two independent coin-flips remain - four worlds.
 */
const WEIGHTED_WORLDS = makeBoard(['?10', '?31', '???'], 3)

describe('the weighted worlds solve reports alongside its aggregates', () => {
  const { result, worlds } = solve(decompose(WEIGHTED_WORLDS), new Map())

  it('returns one entry per surviving world', () => {
    expect(worlds.length).toBe(4)
    expect(result.frontier.length).toBe(5)
    expect(result.nonFrontierCells.length).toBe(0)
  })

  it('normalizes the worlds’ weights to sum to 1', () => {
    const total = worlds.reduce((sum, w) => sum + w.weight, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it('assigns every frontier cell a value in every world', () => {
    for (const world of worlds) {
      for (const cell of result.frontier) {
        expect(world.assignment.get(`${cell.row},${cell.col}`)).toBeTypeOf('number')
      }
    }
  })

  it('agrees with the aggregates: a cell’s mine-world weight is its reported probability', () => {
    // The two halves come back from one enumeration, so this is a check that the projection is
    // faithful rather than that two independent computations happen to match.
    for (const frontierResult of result.frontier) {
      const cellKey = `${frontierResult.row},${frontierResult.col}`
      const mineWeight = worlds
        .filter((w) => w.assignment.get(cellKey) === 1)
        .reduce((sum, w) => sum + w.weight, 0)
      expect(mineWeight).toBeCloseTo(frontierResult.probability, 10)
    }
  })
})
