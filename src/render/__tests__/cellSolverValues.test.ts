import { describe, expect, it } from 'vitest'
import { cellSolverValues } from '../cellSolverValues.ts'
import type { FrontierCellResult, SolveResult } from '../../solver/types.ts'

function frontierCell(row: number, col: number, probability: number, eig: number): FrontierCellResult {
  return { row, col, probability, eig, outcomeProbabilities: new Map() }
}

const FRONTIER = frontierCell(0, 1, 0.25, 1.5)

const RESULT: SolveResult = {
  frontier: [FRONTIER],
  frontierByKey: new Map([['0,1', FRONTIER]]),
  nonFrontierProbability: 0.4,
  nonFrontierCells: [{ row: 2, col: 2 }],
  totalEntropyBits: 3,
}

describe('cell fill rule shared by the three board renderers', () => {
  it('gives a frontier cell its own probability and EIG', () => {
    expect(cellSolverValues(RESULT, '0,1', false)).toEqual({ probability: 0.25, eig: 1.5 })
  })

  it('falls back to the pooled non-frontier probability, with no EIG of its own', () => {
    expect(cellSolverValues(RESULT, '2,2', false)).toEqual({ probability: 0.4, eig: null })
  })

  it('shows nothing on a revealed cell, whether or not it has a frontier entry', () => {
    // (0,1) is a frontier cell; once revealed its answer is on the board, so no fill is painted.
    expect(cellSolverValues(RESULT, '0,1', true)).toEqual({ probability: null, eig: null })
    expect(cellSolverValues(RESULT, '2,2', true)).toEqual({ probability: null, eig: null })
  })

  it('shows nothing at all for a board drawn without solver output', () => {
    // The explainer's introduction poses deductions the heatmap would answer outright.
    expect(cellSolverValues(null, '0,1', false)).toEqual({ probability: null, eig: null })
  })

  it('reports a null pooled probability rather than inventing one when there is no remainder', () => {
    const noRemainder: SolveResult = { ...RESULT, nonFrontierProbability: null, nonFrontierCells: [] }
    expect(cellSolverValues(noRemainder, '2,2', false)).toEqual({ probability: null, eig: null })
  })
})
