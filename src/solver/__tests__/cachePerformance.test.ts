import { describe, expect, it } from 'vitest'
import { boardFromMineLayout } from '../../__tests__/support/boardFactory.ts'
import type { ComponentCache } from '../componentEnumeration.ts'
import { decompose } from '../decomposition.ts'
import { computeExplanations } from '../explanation.ts'
import { getEnumerationCallCountForTest, resetEnumerationCallCountForTest } from '../instrumentation.ts'
import { solve } from '../probability.ts'
import type { SolverBoard } from '../types.ts'
import { mulberry32 } from '../../__tests__/support/prng.ts'
import { snapshotSolverBoard } from '../../__tests__/support/solverBoard.ts'

/** A 30x16/99-mine (Expert) layout with (0,0) kept safe, for a deterministic first click.
 * This seed (empirically found via a scan of seeds) happens to produce a real single frontier
 * component of 100+ cells that persists, essentially unchanged, across dozens of consecutive
 * moves deep into the game - exactly the "large, mostly-solved frontier" scenario behind the
 * multi-second `reveal()`/`toggleFlag()` hang this cache exists to prevent. */
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

function runSequence(
  snapshots: readonly SolverBoard[],
  threadCache: boolean,
): { ms: number; enumerationCalls: number } {
  let cache: ComponentCache = new Map()
  resetEnumerationCallCountForTest()
  const start = performance.now()
  for (const board of snapshots) {
    // One decomposition per board state, shared by both consumers - the sequence being timed
    // here is the one GameController runs per move.
    const decomposition = decompose(board)
    const { result, cache: afterSolve } = solve(decomposition, threadCache ? cache : new Map())
    const { cache: afterExplain } = computeExplanations(
      decomposition,
      result,
      new Set(),
      threadCache ? afterSolve : new Map(),
    )
    cache = afterExplain
  }
  return { ms: performance.now() - start, enumerationCalls: getEnumerationCallCountForTest() }
}

describe('component cache performance on an Expert-sized board', () => {
  it('avoids re-enumerating components for a sequence of moves on a large, mostly-solved frontier', () => {
    const layout = buildExpertLayout()
    const snapshots = buildMoveSnapshots(layout, 117, 60)
    expect(snapshots.length).toBeGreaterThan(0)

    const uncached = runSequence(snapshots, false)
    const cached = runSequence(snapshots, true)

    // eslint-disable-next-line no-console
    console.log(`[cache perf] uncached: ${uncached.ms.toFixed(1)}ms, cached: ${cached.ms.toFixed(1)}ms`)

    // Wall-clock time is too noisy on shared CI runners to assert on directly; the enumeration
    // call count is the deterministic proxy for the work the cache is meant to avoid redoing.
    expect(cached.enumerationCalls).toBeLessThan(uncached.enumerationCalls)
  }, 60000)
})
