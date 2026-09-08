import type { Board } from '../board/board.ts'
import { key, type SolveResult } from '../solver/types.ts'

export function countFlags(board: Board): number {
  let count = 0
  for (const row of board.cells) {
    for (const cell of row) {
      if (cell.flagged) count++
    }
  }
  return count
}

/** Resolves a cell's mine probability the same way `toRenderBoard` does: frontier lookup, else the pooled non-frontier probability. */
export function probabilityAt(solve: SolveResult, row: number, col: number): number | null {
  return solve.frontierByKey.get(key(row, col))?.probability ?? solve.nonFrontierProbability
}
