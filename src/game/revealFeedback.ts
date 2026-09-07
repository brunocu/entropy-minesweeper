import type { SolveResult } from '../solver/types.ts'

export interface RevealFeedback {
  readonly predictedEig: number | null
  readonly revealedInformation: number
}

/** EIG readout for an inspected cell: only frontier cells have one (6.1). */
export function findFrontierEig(solveResult: SolveResult, row: number, col: number): number | null {
  const frontierResult = solveResult.frontier.find((f) => f.row === row && f.col === col)
  return frontierResult ? frontierResult.eig : null
}

/**
 * Predicted-vs-realized comparison for a cell that was just revealed. Predicted EIG comes from
 * the pre-reveal solve's frontier entry and is null/absent for a non-frontier reveal. Revealed
 * information is the whole reveal's (including any cascade) total-uncertainty reduction, so it's
 * always computable from the pre- and post-reveal SolveResults alone.
 */
export function computeRevealFeedback(
  preRevealSolve: SolveResult,
  postRevealSolve: SolveResult,
  row: number,
  col: number,
): RevealFeedback {
  const frontierResult = preRevealSolve.frontier.find((f) => f.row === row && f.col === col)
  return {
    predictedEig: frontierResult ? frontierResult.eig : null,
    revealedInformation: preRevealSolve.totalEntropyBits - postRevealSolve.totalEntropyBits,
  }
}
