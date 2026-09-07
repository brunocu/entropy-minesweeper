import type { SolverBoard, SolverCell } from '../../solver/types.ts'

/**
 * Parses a grid literal into a SolverBoard: `?` is an unrevealed cell, `.` a revealed blank,
 * and a digit a revealed cell with that adjacent-mine count.
 */
export function makeBoard(rows: string[], mineCount: number): SolverBoard {
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
