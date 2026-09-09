// The explainer's one runtime demo: draw an outcome for a fixed toy reveal, weighted by the
// outcome's real solver-computed probability, and report the same predicted-vs-realized pair
// the live game reports after a click.
//
// Nothing here is hand-authored arithmetic: the probabilities come from `solve` and the comparison
// from `computeRevealFeedback`, the same pair the live game uses.
import { computeRevealFeedback, type RevealFeedback } from '../lib/game/revealFeedback.ts'
import { decompose } from '../lib/solver/decomposition.ts'
import { solve } from '../lib/solver/probability.ts'
import { key, type Coord, type SolveResult, type SolverBoard } from '../lib/solver/types.ts'

/** How many worlds a solve leaves standing; total uncertainty is log2 of this by definition. */
export function worldCount(result: SolveResult): number {
  return 2 ** result.totalEntropyBits
}

export interface SimulatedReveal {
  /** The drawn outcome, in the solver's own outcome-key form (`mine` or `safe:<n>`). */
  readonly outcome: string
  /** How likely that outcome was, before it was drawn. */
  readonly outcomeProbability: number
  readonly feedback: RevealFeedback
}

/** Draws one entry from a probability-weighted map. `random` returns a number in [0, 1). */
export function pickWeighted(weights: ReadonlyMap<string, number>, random: () => number): string {
  const entries = [...weights]
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  let threshold = random() * total
  for (const [value, weight] of entries) {
    threshold -= weight
    if (threshold < 0) return value
  }
  // Only reachable through floating-point slop at the very top of the range.
  return entries[entries.length - 1][0]
}

/**
 * The information state left once `cell` is known to hold an outcome of probability `p`.
 *
 * Derived from the outcome's probability rather than by rebuilding a board. The worlds surviving
 * the answer are exactly those consistent with it, carrying `p` of the weight, so the remaining
 * uncertainty is `H_before + log2(p)` - equation (9) of the article.
 *
 * A board cannot express this: `SolverBoard` has no "unrevealed but known safe", so folding in a
 * known mine must decrement the clues counting it, and a clue decremented to 0 stops constraining
 * anything - silently freeing cells the reveal had just pinned down.
 *
 * Only `totalEntropyBits` is meaningful here, which is all `computeRevealFeedback` reads from the
 * post-reveal side; the per-cell fields stay empty rather than invented.
 */
function informationStateAfter(preRevealSolve: SolveResult, outcomeProbability: number): SolveResult {
  return {
    frontier: [],
    frontierByKey: new Map(),
    nonFrontierProbability: null,
    nonFrontierCells: [],
    totalEntropyBits: preRevealSolve.totalEntropyBits + Math.log2(outcomeProbability),
  }
}

/**
 * Simulates revealing `cell`: draws one of its possible outcomes weighted by the solver's own
 * outcome probabilities, then compares what was predicted beforehand against what that
 * particular outcome actually resolved.
 */
export function simulateReveal(
  board: SolverBoard,
  cell: Coord,
  random: () => number,
  preRevealSolve?: SolveResult,
): SimulatedReveal {
  const preSolve = preRevealSolve ?? solve(decompose(board), new Map()).result
  const frontierResult = preSolve.frontierByKey.get(key(cell.row, cell.col))
  if (!frontierResult) throw new Error(`demo cell ${cell.row},${cell.col} is not a frontier cell`)

  const outcome = pickWeighted(frontierResult.outcomeProbabilities, random)
  const outcomeProbability = frontierResult.outcomeProbabilities.get(outcome) ?? 0
  const postSolve = informationStateAfter(preSolve, outcomeProbability)

  return {
    outcome,
    outcomeProbability,
    feedback: computeRevealFeedback(preSolve, postSolve, cell.row, cell.col),
  }
}
