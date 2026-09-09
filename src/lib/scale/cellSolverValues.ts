// How a cell's solver-derived fill is read off a solve, in one place.
//
// Three renderers paint the same board - the live canvas, the explainer's runtime demo, and its
// static SVGs - and all three must agree here, or one shows a different heatmap for the same
// position. The conversions around this stay separate: they disagree about flags, mines, hover
// highlights and simulated reveals, and merging them would need a parameter per caller.
import type { SolveResult } from '../solver/types.ts'

export interface CellSolverValues {
  /** Mine probability to paint, or null when the cell shows no solver output. */
  readonly probability: number | null
  /** Expected information gain to paint, or null when there is none to show. */
  readonly eig: number | null
}

const NO_VALUES: CellSolverValues = { probability: null, eig: null }

/**
 * A revealed cell has no fill - its answer is already on the board. Otherwise the cell's own
 * frontier entry supplies both numbers, and a cell the frontier does not reach falls back to the
 * pooled non-frontier probability, with no EIG of its own.
 *
 * `result` is null for a board deliberately drawn without solver output.
 */
export function cellSolverValues(
  result: SolveResult | null,
  cellKey: string,
  revealed: boolean,
): CellSolverValues {
  if (revealed || result === null) return NO_VALUES
  const frontierResult = result.frontierByKey.get(cellKey)
  return {
    probability: frontierResult?.probability ?? result.nonFrontierProbability,
    eig: frontierResult?.eig ?? null,
  }
}
