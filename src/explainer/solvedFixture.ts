// One authoritative solve of one fixed board, threaded through the illustration pipeline.
//
// The explainer's fixtures are constants, so every generator that wants numbers off one could
// solve it for itself. The argument for solving each once instead is coherence rather than
// speed: independent solves of one fixed board are independent chances for the figures to
// disagree with each other. Passed explicitly rather than memoized so there is visibly one
// solve per fixture, not many cheap ones.
import { decompose, type Decomposition } from '../solver/decomposition.ts'
import { solve, type WeightedWorld } from '../solver/probability.ts'
import type { SolveResult, SolverBoard } from '../solver/types.ts'

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
