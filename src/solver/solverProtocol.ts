import type { SolveResult, SolverBoard } from './frontierSolver.ts'

export interface SolveRequestMessage {
  readonly type: 'solve'
  readonly requestId: number
  readonly board: SolverBoard
}

export interface SolveResponseMessage {
  readonly type: 'result'
  readonly requestId: number
  readonly result: SolveResult
}
