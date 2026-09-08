import { describe, expect, it } from 'vitest'
import { WORLDS_TREE_BOARD } from '../../explainer/fixtures.ts'
import { decompose } from '../decomposition.ts'
import { solve } from '../probability.ts'

describe('the weighted worlds solve reports alongside its aggregates', () => {
  const { result, worlds } = solve(decompose(WORLDS_TREE_BOARD), new Map())

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
