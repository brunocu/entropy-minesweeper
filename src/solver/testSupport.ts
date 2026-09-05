import type { Board } from '../board/board.ts'
import type { SolverBoard } from './frontierSolver.ts'

/** Deterministic seeded PRNG (mulberry32), so mine layouts are reproducible across runs. */
export function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deep-copies the solver-relevant fields of a Board into a standalone SolverBoard snapshot. */
export function snapshotSolverBoard(board: Board): SolverBoard {
  return {
    width: board.width,
    height: board.height,
    mineCount: board.mineCount,
    cells: board.cells.map((row) => row.map((c) => ({ revealed: c.revealed, adjacentMines: c.adjacentMines }))),
  }
}
