export interface GridCoord {
  readonly row: number
  readonly col: number
}

/** Maps a pixel offset within the canvas to a grid row/column, or null if outside the board. */
export function pixelToCell(
  x: number,
  y: number,
  cellSize: number,
  width: number,
  height: number,
): GridCoord | null {
  if (x < 0 || y < 0) return null
  const col = Math.floor(x / cellSize)
  const row = Math.floor(y / cellSize)
  if (col < 0 || col >= width || row < 0 || row >= height) return null
  return { row, col }
}
