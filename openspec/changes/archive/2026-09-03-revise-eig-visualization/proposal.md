## Why

Playtesting the implemented `information-visualization` capability surfaced three readability gaps: the EIG readout still shows a meaningless value for cells the solver has already fully determined are mines, the color channel on certain-safe cells is wasted repeating information the certainty border already conveys, and the raw mine probability itself is never shown to the player even though it drives the heatmap fill they're looking at.

## What Changes

- The frontier EIG readout (hover, and the predicted-vs-realized reveal comparison) no longer displays a value for a cell whose pre-reveal probability is exactly 1 (certain mine) — a click there was already fully predicted, so EIG and predicted surprisal are trivially 0 and add no information.
- Frontier cells with probability exactly 0 (certain safe) no longer render the flat diverging-scale pole fill. Instead they render a color gradient keyed to that cell's own EIG, using a new sequential palette distinct from the probability heatmap's diverging scale. The gradient's low/high endpoints are normalized per-render against the min/max EIG among the current board's certain-safe frontier cells; a single certain-safe frontier cell (no spread) renders at full saturation. Non-frontier cells at probability 0 have no individual EIG and keep the existing flat pole fill.
- Hovering any unrevealed cell whose probability is strictly between 0 and 1 (frontier or non-frontier) now also shows that cell's mine probability as a percentage, on its own line, in addition to the existing EIG line (frontier cells only — non-frontier cells show only the probability line, since they have no per-cell EIG). Cells at probability exactly 0 or 1 continue to show no probability line; the certainty border remains their only certainty indicator.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `information-visualization`: revises the Frontier Expected-Information-Gain Readout requirement to exclude certain-mine (p=1) cells from both the hover EIG readout and the predicted-vs-realized reveal comparison; adds a requirement for an EIG-keyed gradient fill on certain-safe (p=0) frontier cells; adds a requirement for a mine-probability hover readout on uncertain (0<p<1) cells.

## Impact

- `src/main.ts`: hover handler (EIG readout), reveal handler (predicted-vs-realized readout).
- `src/render/boardRenderer.ts`: per-cell fill-color logic for p=0 frontier cells.
- `src/render/probabilityColor.ts` (or a new sibling module): new sequential EIG-gradient color function alongside the existing diverging `probabilityColor`.
- `src/game/revealFeedback.ts`: `findFrontierEig` / `computeRevealFeedback` callers need the pre-reveal probability, not just the EIG, to apply the p=1 exclusion.
- No changes to `frontier-solver` or `minesweeper-board` capabilities — this is purely a display revision over existing solver output.
