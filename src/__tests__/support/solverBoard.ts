import type { Board } from '../../board/board.ts'
import type { SolverBoard } from '../../solver/types.ts'

/** Deep-copies the solver-relevant fields of a Board into a standalone SolverBoard snapshot. */
export function snapshotSolverBoard(board: Board): SolverBoard {
  return {
    width: board.width,
    height: board.height,
    mineCount: board.mineCount,
    cells: board.cells.map((row) => row.map((c) => ({ revealed: c.revealed, adjacentMines: c.adjacentMines }))),
  }
}
