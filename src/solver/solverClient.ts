import type { SolveResult, SolverBoard } from './frontierSolver.ts'
import type { SolveRequestMessage, SolveResponseMessage } from './solverProtocol.ts'

/** Browser-side handle to the solver Worker: board state in, probabilities/EIG out. */
export class SolverClient {
  private readonly worker: Worker
  private nextRequestId = 0
  private readonly pending = new Map<number, (result: SolveResult) => void>()

  constructor() {
    this.worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<SolveResponseMessage>) => {
      const { requestId, result } = event.data
      const resolve = this.pending.get(requestId)
      if (resolve) {
        this.pending.delete(requestId)
        resolve(result)
      }
    }
  }

  solve(board: SolverBoard): Promise<SolveResult> {
    const requestId = this.nextRequestId++
    return new Promise((resolve) => {
      this.pending.set(requestId, resolve)
      const message: SolveRequestMessage = { type: 'solve', requestId, board }
      this.worker.postMessage(message)
    })
  }

  terminate(): void {
    this.worker.terminate()
  }
}
