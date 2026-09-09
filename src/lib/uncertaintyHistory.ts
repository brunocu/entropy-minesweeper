// One point on the total-uncertainty trace: what `GameController` records per move, what the live
// uPlot chart plots, and what the explainer's static SVG of the same shape draws. Kept out of
// `uncertaintyChart.ts` so build-time code can name the type without pulling in uPlot's CSS.
export interface UncertaintyHistoryPoint {
  readonly moveIndex: number
  readonly totalEntropyBits: number
}
