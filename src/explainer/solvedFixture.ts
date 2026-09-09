// One authoritative solve of one fixed board, threaded through the illustration pipeline.
import { decompose, type Decomposition } from '../lib/solver/decomposition.ts'
import { solve, type WeightedWorld } from '../lib/solver/probability.ts'
import type { SolveResult, SolverBoard } from '../lib/solver/types.ts'

export interface SolvedFixture {
  /** The board these results describe, carried so the two cannot be paired wrongly. */
  readonly board: SolverBoard
  readonly decomposition: Decomposition
  readonly result: SolveResult
  /** The individual weighted worlds behind `result` - what the worlds-tree illustration draws. */
  readonly worlds: readonly WeightedWorld[]
}

export function solveFixture(board: SolverBoard): SolvedFixture {
  const decomposition = decompose(board)
  const { result, worlds } = solve(decomposition, new Map())
  return { board, decomposition, result, worlds }
}
