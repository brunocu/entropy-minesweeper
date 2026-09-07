import { describe, expect, it } from 'vitest'
import { WORLDS_TREE_BOARD } from '../../explainer/fixtures.ts'
import { enumerateWeightedWorlds, solve } from '../frontierSolver.ts'

describe('enumerateWeightedWorlds', () => {
  const worlds = enumerateWeightedWorlds(WORLDS_TREE_BOARD)
  const { result } = solve(WORLDS_TREE_BOARD, new Map())

  it('returns one entry per surviving world', () => {
    expect(worlds.worlds.length).toBe(4)
    expect(worlds.frontierCells.length).toBe(5)
    expect(worlds.nonFrontierCellCount).toBe(0)
  })

  it('normalizes the worlds’ weights to sum to 1', () => {
    const total = worlds.worlds.reduce((sum, w) => sum + w.weight, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it('assigns every frontier cell a value in every world', () => {
    for (const world of worlds.worlds) {
      for (const cell of worlds.frontierCells) {
        expect(world.assignment.get(`${cell.row},${cell.col}`)).toBeTypeOf('number')
      }
    }
  })

  it('agrees with solve: a cell’s mine-world weight is its reported probability', () => {
    for (const frontierResult of result.frontier) {
      const cellKey = `${frontierResult.row},${frontierResult.col}`
      const mineWeight = worlds.worlds
        .filter((w) => w.assignment.get(cellKey) === 1)
        .reduce((sum, w) => sum + w.weight, 0)
      expect(mineWeight).toBeCloseTo(frontierResult.probability, 10)
    }
  })
})
