import { Board } from '../board/board.ts'
import type { ComponentCache } from '../solver/componentEnumeration.ts'
import { computeExplanations, type FrontierExplanation } from '../solver/explanation.ts'
import { solve, type SolveWithCache } from '../solver/probability.ts'
import type { SolveResult } from '../solver/types.ts'

function flaggedCellKeys(board: Board): Set<string> {
  const result = new Set<string>()
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      if (board.cells[row][col].flagged) result.add(`${row},${col}`)
    }
  }
  return result
}

export type Solve = (board: Board, cache: ComponentCache) => SolveWithCache

export interface UncertaintyHistoryEntry {
  readonly moveIndex: number
  readonly totalEntropyBits: number
}

/**
 * Wires the board engine to the solver: exactly one solver pass runs per settled board state
 * (Board.reveal already resolves a full flood-fill internally before returning), never per
 * individual cell revealed during a cascade.
 */
export class GameController {
  readonly board: Board
  latestSolve: SolveResult
  latestExplanations: ReadonlyMap<string, FrontierExplanation>
  uncertaintyHistory: readonly UncertaintyHistoryEntry[]
  private readonly solveFn: Solve
  private componentCache: ComponentCache = new Map()
  private nextMoveIndex = 0

  constructor(board: Board, solveFn: Solve = solve) {
    this.board = board
    this.solveFn = solveFn
    const { result, cache } = this.solveFn(this.board, this.componentCache)
    this.latestSolve = result
    this.componentCache = cache
    const explained = computeExplanations(this.board, this.latestSolve, flaggedCellKeys(this.board), this.componentCache)
    this.latestExplanations = explained.explanations
    this.componentCache = explained.cache
    this.uncertaintyHistory = [{ moveIndex: this.nextMoveIndex++, totalEntropyBits: this.latestSolve.totalEntropyBits }]
  }

  reveal(row: number, col: number, rng?: () => number): boolean {
    const changed = this.board.reveal(row, col, rng)
    if (!changed) return false
    const { result, cache } = this.solveFn(this.board, this.componentCache)
    this.latestSolve = result
    this.componentCache = cache
    const explained = computeExplanations(this.board, this.latestSolve, flaggedCellKeys(this.board), this.componentCache)
    this.latestExplanations = explained.explanations
    this.componentCache = explained.cache
    this.recordMove()
    return true
  }

  toggleFlag(row: number, col: number): void {
    this.board.toggleFlag(row, col)
    const explained = computeExplanations(this.board, this.latestSolve, flaggedCellKeys(this.board), this.componentCache)
    this.latestExplanations = explained.explanations
    this.componentCache = explained.cache
  }

  private recordMove(): void {
    this.uncertaintyHistory = [
      ...this.uncertaintyHistory,
      { moveIndex: this.nextMoveIndex++, totalEntropyBits: this.latestSolve.totalEntropyBits },
    ]
  }
}
