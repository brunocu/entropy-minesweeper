// The shared vocabulary of the frontier solver: the board it reads, the coordinates it
// reports, and the `row,col` string key convention every other solver module speaks.
// See openspec/changes/entropy-minesweeper/specs/frontier-solver/spec.md and design.md.

export interface SolverCell {
  readonly revealed: boolean
  readonly adjacentMines: number
}

export interface SolverBoard {
  readonly width: number
  readonly height: number
  readonly mineCount: number
  readonly cells: readonly (readonly SolverCell[])[]
}

export interface Coord {
  readonly row: number
  readonly col: number
}

export type CellOutcome = { readonly type: 'mine' } | { readonly type: 'safe'; readonly adjacentMines: number }

export interface FrontierCellResult extends Coord {
  readonly probability: number
  readonly eig: number
  readonly outcomeProbabilities: ReadonlyMap<string, number>
}

export interface SolveResult {
  readonly frontier: readonly FrontierCellResult[]
  readonly nonFrontierProbability: number | null
  readonly nonFrontierCells: readonly Coord[]
  readonly totalEntropyBits: number
}

export function key(row: number, col: number): string {
  return `${row},${col}`
}
