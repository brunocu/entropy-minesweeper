import { describe, expect, it } from 'vitest'
import { boardFromMineLayout } from '../../__tests__/support/boardFactory.ts'
import { computeExplanations, solve, type ComponentCache, type SolverBoard } from '../frontierSolver.ts'
import { mulberry32 } from '../../__tests__/support/prng.ts'
import { snapshotSolverBoard } from '../../__tests__/support/solverBoard.ts'

/** A 30x16/99-mine (Expert) layout with (0,0) kept safe, for a deterministic first click.
 * This seed (empirically found via a scan of seeds) happens to produce a real single frontier
 * component of 100+ cells that persists, essentially unchanged, across dozens of consecutive
 * moves deep into the game - exactly the "large, mostly-solved frontier" scenario proposal.md's
 * Why cites as the source of the multi-second `reveal()`/`toggleFlag()` hang. */
function buildExpertLayout(): boolean[][] {
  const width = 30
  const height = 16
  const mineCount = 99
  const rng = mulberry32(15)

  const candidates: [number, number][] = []
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (row === 0 && col === 0) continue
      candidates.push([row, col])
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }

  const layout = Array.from({ length: height }, () => Array.from({ length: width }, () => false))
  for (const [row, col] of candidates.slice(0, mineCount)) layout[row][col] = true
  return layout
}

/** Reveals safe cells in row-major order, one `reveal()` call at a time (a flood-fill reveal
 * can settle several cells at once). The first `warmupClicks` clicks build up a large, mostly-
 * solved board unmeasured (establishing a big, mostly-stable component structure); the next
 * `moveCount` clicks are snapshotted individually - mirroring a real "click a safe cell, repeat"
 * session deep into an already-mostly-solved Expert game, where each move only disturbs a small
 * part of the frontier. */
function buildMoveSnapshots(layout: boolean[][], warmupClicks: number, moveCount: number): SolverBoard[] {
  const board = boardFromMineLayout(layout)
  const snapshots: SolverBoard[] = []
  let clicks = 0
  outer: for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      if (board.cells[row][col].isMine || board.cells[row][col].revealed) continue
      board.reveal(row, col)
      clicks++
      if (clicks > warmupClicks) snapshots.push(snapshotSolverBoard(board))
      if (snapshots.length >= moveCount) break outer
    }
  }
  return snapshots
}

function runSequence(snapshots: readonly SolverBoard[], threadCache: boolean): number {
  let cache: ComponentCache = new Map()
  const start = performance.now()
  for (const board of snapshots) {
    const { result, cache: afterSolve } = solve(board, threadCache ? cache : new Map())
    const { cache: afterExplain } = computeExplanations(board, result, new Set(), threadCache ? afterSolve : new Map())
    cache = afterExplain
  }
  return performance.now() - start
}

describe('component cache performance on an Expert-sized board (5.1)', () => {
  it('reduces total wall-clock time for a sequence of moves on a large, mostly-solved frontier', () => {
    const layout = buildExpertLayout()
    const snapshots = buildMoveSnapshots(layout, 117, 60)
    expect(snapshots.length).toBeGreaterThan(0)

    // Run each variant twice and take the best-of-two, to reduce noise from JIT warm-up/GC pauses.
    const uncachedMs = Math.min(runSequence(snapshots, false), runSequence(snapshots, false))
    const cachedMs = Math.min(runSequence(snapshots, true), runSequence(snapshots, true))

    // eslint-disable-next-line no-console
    console.log(`[cache perf] uncached: ${uncachedMs.toFixed(1)}ms, cached: ${cachedMs.toFixed(1)}ms`)

    expect(cachedMs).toBeLessThan(uncachedMs)
  }, 60000)
})
