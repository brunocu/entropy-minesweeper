import { Board } from '../board/board.ts'
import type { ComponentCache } from '../solver/componentEnumeration.ts'
import { decompose, type Decomposition } from '../solver/decomposition.ts'
import { computeExplanations, type FrontierExplanation } from '../solver/explanation.ts'
import { solve, type SolveWithCache } from '../solver/probability.ts'
import type { SolveResult } from '../solver/types.ts'
import type { UncertaintyHistoryPoint } from '../uncertaintyHistory.ts'

function flaggedCellKeys(board: Board): Set<string> {
  const result = new Set<string>()
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      if (board.cells[row][col].flagged) result.add(`${row},${col}`)
    }
  }
  return result
}

export type Solve = (decomposition: Decomposition, cache: ComponentCache) => SolveWithCache

/**
 * Wires the board engine to the solver: exactly one solver pass runs per settled board state
 * (Board.reveal already resolves a full flood-fill internally before returning), never per
 * individual cell revealed during a cascade.
 */
export class GameController {
  readonly board: Board
  latestSolve: SolveResult
  latestExplanations: ReadonlyMap<string, FrontierExplanation>
  uncertaintyHistory: readonly UncertaintyHistoryPoint[]
  private readonly solveFn: Solve
  /**
   * The decomposition `latestSolve` was computed from. Held rather than rebuilt: it reads only
   * revealed cells and their counts, so a flag toggle cannot invalidate it, which is what lets
   * `toggleFlag` re-explain without redoing the phase.
   */
  private latestDecomposition: Decomposition
  private componentCache: ComponentCache = new Map()
  private nextMoveIndex = 0

  constructor(board: Board, solveFn: Solve = solve) {
    this.board = board
    this.solveFn = solveFn
    this.latestDecomposition = decompose(this.board)
    const { result, cache } = this.solveFn(this.latestDecomposition, this.componentCache)
    this.latestSolve = result
    this.componentCache = cache
    this.latestExplanations = this.explain()
    this.uncertaintyHistory = [{ moveIndex: this.nextMoveIndex++, totalEntropyBits: this.latestSolve.totalEntropyBits }]
  }

  reveal(row: number, col: number, rng?: () => number): boolean {
    const changed = this.board.reveal(row, col, rng)
    if (!changed) return false
    // One decomposition of the settled board, shared by both consumers of it.
    this.latestDecomposition = decompose(this.board)
    const { result, cache } = this.solveFn(this.latestDecomposition, this.componentCache)
    this.latestSolve = result
    this.componentCache = cache
    this.latestExplanations = this.explain()
    this.recordMove()
    return true
  }

  /** Reports whether the flag actually moved, so a caller can skip work when it did not. */
  toggleFlag(row: number, col: number): boolean {
    const changed = this.board.toggleFlag(row, col)
    this.latestExplanations = this.explain()
    return changed
  }

  /** Re-derives explanations for the current flags, against the standing solve and decomposition. */
  private explain(): ReadonlyMap<string, FrontierExplanation> {
    const explained = computeExplanations(
      this.latestDecomposition,
      this.latestSolve,
      flaggedCellKeys(this.board),
      this.componentCache,
    )
    this.componentCache = explained.cache
    return explained.explanations
  }

  private recordMove(): void {
    this.uncertaintyHistory = [
      ...this.uncertaintyHistory,
      { moveIndex: this.nextMoveIndex++, totalEntropyBits: this.latestSolve.totalEntropyBits },
    ]
  }
}
