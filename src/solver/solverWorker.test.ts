// This sandbox has no headless browser, so a real DOM Worker can't be exercised here.
// solver.worker.ts is written to be isomorphic (see its header comment) so the exact same
// file that Vite bundles as a browser Worker can be loaded as a real, separate OS thread via
// Node's worker_threads - giving genuine off-main-thread execution to verify against, rather
// than a simulation.
import { Worker } from 'node:worker_threads'
import { describe, expect, it } from 'vitest'
import { solve, type SolverBoard, type SolverCell } from './frontierSolver.ts'
import type { SolveRequestMessage, SolveResponseMessage } from './solverProtocol.ts'

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

/** k independent 2-cell components ("?1?" over a blank separator row), so the cross-component
 * cartesian product the solver enumerates grows as 2^k - large enough to take real wall-clock
 * time without risking an OOM in CI. */
function buildLargeSyntheticFrontier(k: number): SolverBoard {
  const rows: string[] = []
  for (let i = 0; i < k; i++) {
    rows.push('?1?')
    rows.push('...')
  }
  rows.pop()
  return makeBoard(rows, k)
}

const workerUrl = new URL('./solver.worker.ts', import.meta.url)

describe('solver Worker isolation (4.1)', () => {
  it('keeps the main thread responsive while a large synthetic frontier enumerates', async () => {
    const board = buildLargeSyntheticFrontier(16)
    const worker = new Worker(workerUrl)

    let tickCount = 0
    const interval = setInterval(() => {
      tickCount++
    }, 10)

    const responsePromise = new Promise<SolveResponseMessage>((resolve, reject) => {
      worker.once('message', resolve)
      worker.once('error', reject)
    })

    const start = performance.now()
    const request: SolveRequestMessage = { type: 'solve', requestId: 1, board }
    worker.postMessage(request)
    const response = await responsePromise
    const elapsed = performance.now() - start

    clearInterval(interval)
    await worker.terminate()

    // Sanity: this board is actually slow enough to matter.
    expect(elapsed).toBeGreaterThan(50)
    // The main thread's timer kept firing on schedule throughout - it was never blocked,
    // because the enumeration ran on the worker thread instead.
    expect(tickCount).toBeGreaterThan(elapsed / 10 / 3)
    expect(response.result.frontier).toHaveLength(2 * 16)
  }, 20000)

  it('returns the same result via the worker as calling solve() directly', async () => {
    const board = buildLargeSyntheticFrontier(6)
    const worker = new Worker(workerUrl)

    const responsePromise = new Promise<SolveResponseMessage>((resolve, reject) => {
      worker.once('message', resolve)
      worker.once('error', reject)
    })
    const request: SolveRequestMessage = { type: 'solve', requestId: 42, board }
    worker.postMessage(request)
    const response = await responsePromise
    await worker.terminate()

    const direct = solve(board, new Map()).result
    expect(response.requestId).toBe(42)
    expect(response.result.nonFrontierProbability).toEqual(direct.nonFrontierProbability)
    expect(response.result.frontier.map((f) => [f.row, f.col, f.probability])).toEqual(
      direct.frontier.map((f) => [f.row, f.col, f.probability]),
    )
  })
})
