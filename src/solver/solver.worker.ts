// Worker entry point: runs the exact solver off the main thread (design.md decision 3),
// so a slow enumeration degrades to "heatmap takes a moment" instead of freezing input.
//
// Isomorphic on purpose: the browser build loads this as a module Worker (bundled by Vite),
// while automated tests load the same file through Node's worker_threads, since this sandbox
// has no headless browser to exercise a real Worker in.
import { solve, type ComponentCache } from './frontierSolver.ts'
import type { SolveRequestMessage, SolveResponseMessage } from './solverProtocol.ts'

let cache: ComponentCache = new Map()

function handle(message: SolveRequestMessage): SolveResponseMessage {
  const { result, cache: nextCache } = solve(message.board, cache)
  cache = nextCache
  return { type: 'result', requestId: message.requestId, result }
}

interface BrowserWorkerScope {
  postMessage?: (message: SolveResponseMessage) => void
  onmessage?: ((event: { data: SolveRequestMessage }) => void) | null
}

const browserScope = globalThis as unknown as BrowserWorkerScope

if (typeof browserScope.postMessage === 'function') {
  browserScope.onmessage = (event) => {
    browserScope.postMessage!(handle(event.data))
  }
} else {
  const { parentPort } = await import('node:worker_threads')
  parentPort?.on('message', (message: SolveRequestMessage) => {
    parentPort?.postMessage(handle(message))
  })
}
