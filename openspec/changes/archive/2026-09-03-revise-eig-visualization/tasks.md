## 1. Color scale

- [x] 1.1 Add a sequential EIG-gradient color function to `src/render/probabilityColor.ts` (distinct palette from the existing diverging scale) and verify a unit test covering low-EIG vs. high-EIG inputs produces visually-ordered, distinct colors, plus a degenerate single-value (min===max) case that returns the high-end color.

## 2. Renderer

- [x] 2.1 Add an `eig: number | null` field to `RenderCell` in `src/render/boardRenderer.ts` (design.md decision 2) and verify existing renderer tests still type-check and pass.
- [x] 2.2 In `BoardRenderer.render`, add a first pass collecting `{eig}` for unrevealed, unflagged cells with `probability === 0` and non-null `eig` (frontier certain-safe cells), compute min/max EIG (design.md decision 1).
- [x] 2.3 In `fillColorFor` (or its caller), when a cell is unrevealed, unflagged, `probability === 0`, and `eig` is non-null, return the sequential EIG-gradient color positioned within the per-render min/max range instead of the diverging scale's safe-pole color; leave `probability === 0` non-frontier cells (`eig === null`) on the existing flat pole color. Verify with a unit test asserting: two certain-safe frontier cells with different EIG get different fills, a single certain-safe frontier cell renders at the gradient's high end, and a certain-safe non-frontier cell keeps the flat pole color.
- [x] 2.4 Verify the existing certainty-ring test/behavior (`p === 0 || p === 1` white ring) is unaffected by the fill-color change — ring still draws on top for both poles.

## 3. Wiring from solve result to render cell

- [x] 3.1 In `src/main.ts`'s `toRenderBoard`, populate each cell's `eig` from `controller.latestSolve.frontier` (null for non-frontier and revealed/flagged cells), mirroring how `probability` is already populated. Verify with a unit test or by re-running existing `informationVisualization.spec.test.ts` cases.

## 4. Hover and reveal readouts

- [x] 4.1 In `src/main.ts`'s `mousemove` handler, look up the hovered cell's probability (from `controller.latestSolve.frontier` or `nonFrontierProbability`, matching how `toRenderBoard` resolves it) and build the probability-percentage line when it is strictly between 0 and 1, per the Uncertain Cell Probability Readout requirement. Verify with a test/manual check that hovering an uncertain frontier or non-frontier cell shows `P(mine): NN%`.
- [x] 4.2 In the same handler, suppress the existing EIG line when the hovered frontier cell's probability is exactly 1, per the modified Frontier Expected-Information-Gain Readout requirement. Verify hovering a certain-mine frontier cell shows no EIG text.
- [x] 4.3 Combine the probability line and EIG line into `hoverReadout`'s content as two independent lines (design.md decision 4), each shown only when its own condition holds. Verify a certain-safe (p=0) frontier cell still shows its EIG line with no probability line, and a certain-mine (p=1) frontier cell shows neither line.
- [x] 4.4 In the `click` handler's predicted-vs-realized readout, suppress `revealReadout`'s text when the pre-reveal probability of the revealed cell was exactly 1, per the modified Predicted-vs-Realized Information Display requirement. Verify revealing a certain-mine cell shows no predicted-vs-realized text (existing behavior for non-frontier and 0<p<1/p=0 reveals is unchanged).

## 5. Verification

- [x] 5.1 Run the full test suite (`npm test` or project's configured command) and confirm all existing and new tests pass.
- [x] 5.2 Manually play a game in the dev server: confirm certain-mine cells show no EIG on hover or reveal, certain-safe frontier cells show a visibly graded (not flat) fill distinct from the probability diverging scale, and uncertain cells show a probability percentage alongside EIG on hover.
