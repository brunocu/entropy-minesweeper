// Traces 1:1 to the scenarios in
// openspec/changes/entropy-minesweeper/specs/frontier-solver/spec.md
import { describe, expect, it } from 'vitest'
import { computeFrontierComponents, computeTrivialDeductions, solve, type SolverBoard, type SolverCell } from './frontierSolver.ts'

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

describe('frontier-solver spec scenarios (3.9)', () => {
  it('Fully satisfied number marks remaining neighbors safe', () => {
    // (0,1) forces (1,1) to be a mine on its own; that deduced mine then fully
    // satisfies (2,1)'s count, leaving (2,0) safe - a chain, not a flag.
    const board = makeBoard(['.1', '.?', '?1'], 1)
    const { forcedSafe, forcedMine } = computeTrivialDeductions(board)
    expect(coordSet(forcedMine)).toEqual(coordSet([{ row: 1, col: 1 }]))
    expect(coordSet(forcedSafe)).toEqual(coordSet([{ row: 2, col: 0 }]))
  })

  it('Remaining neighbors forced to be mines', () => {
    const board = makeBoard(['.1', '.?'], 1)
    const { forcedMine } = computeTrivialDeductions(board)
    expect(coordSet(forcedMine)).toEqual(coordSet([{ row: 1, col: 1 }]))
  })

  it('Disjoint frontier regions form separate components', () => {
    const board = makeBoard(['1??1'], 2)
    const components = computeFrontierComponents(board)
    expect(components).toHaveLength(2)
  })

  it('Shared-constraint cell resolves to certainty', () => {
    const board = makeBoard(['121', '???'], 2)
    const result = solve(board, new Map()).result
    const middle = result.frontier.find((f) => f.row === 1 && f.col === 1)!
    expect(middle.probability).toBeCloseTo(0)
    const left = result.frontier.find((f) => f.row === 1 && f.col === 0)!
    expect(left.probability).toBeCloseTo(1)
  })

  it('Non-frontier probability reflects remaining mine count', () => {
    const board = makeBoard(['?', '1', '?', '1', '?', '?', '?'], 2)
    const result = solve(board, new Map()).result
    expect(result.nonFrontierCells.length).toBeGreaterThan(0)
    expect(result.nonFrontierProbability).toBeCloseTo(1 / 3)
  })

  it('Frontier deduction shifts non-frontier probability', () => {
    const before = solve(makeBoard(['?', '1', '?', '1', '?', '?', '?'], 2), new Map()).result
    const after = solve(makeBoard(['?', '1', '?', '1', '?', '?', '?'], 3), new Map()).result
    expect(before.nonFrontierProbability).not.toBeCloseTo(after.nonFrontierProbability ?? NaN, 5)
  })

  it('EIG reflects reduction in world-distribution entropy', () => {
    const board = makeBoard(['11', '??'], 1)
    const result = solve(board, new Map()).result
    const a = result.frontier.find((f) => f.row === 1 && f.col === 0)!
    expect(a.eig).toBeCloseTo(1, 5)
  })

  it('Non-frontier cells have no reported EIG', () => {
    const board = makeBoard(['?', '1', '?', '1', '?', '?', '?'], 2)
    const result = solve(board, new Map()).result
    // Non-frontier cells never appear in the frontier result list, so no EIG is reported for them.
    const nonFrontierKeys = coordSet(result.nonFrontierCells)
    for (const f of result.frontier) {
      expect(nonFrontierKeys.has(`${f.row},${f.col}`)).toBe(false)
    }
  })

  it('Outcome probabilities computed from pre-reveal distribution', () => {
    const board = makeBoard(['?', '1', '?', '1', '?', '?', '?'], 2)
    const result = solve(board, new Map()).result
    const a = result.frontier.find((f) => f.row === 2 && f.col === 0)!
    expect(a.outcomeProbabilities.get('mine')).toBeGreaterThan(0)
    expect(a.outcomeProbabilities.get('mine')).toBeLessThan(1)
  })
})
