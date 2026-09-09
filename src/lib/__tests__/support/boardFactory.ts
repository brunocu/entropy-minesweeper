import { Board } from '../../board/board.ts'

/** Builds a board with a fixed mine layout, mines already placed and play under way. */
export function boardFromMineLayout(layout: boolean[][]): Board {
  const height = layout.length
  const width = layout[0]?.length ?? 0
  const mineCount = layout.flat().filter(Boolean).length
  const board = new Board(width, height, mineCount, layout)
  board.status = 'playing'
  return board
}
