import { key, type SolveResult } from '../solver/types.ts'

export interface RevealFeedback {
  readonly predictedEig: number | null
  readonly revealedInformation: number
}

/** EIG readout for an inspected cell: only frontier cells have one. */
export function findFrontierEig(solveResult: SolveResult, row: number, col: number): number | null {
  return solveResult.frontierByKey.get(key(row, col))?.eig ?? null
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
  return {
    predictedEig: preRevealSolve.frontierByKey.get(key(row, col))?.eig ?? null,
    revealedInformation: preRevealSolve.totalEntropyBits - postRevealSolve.totalEntropyBits,
  }
}
