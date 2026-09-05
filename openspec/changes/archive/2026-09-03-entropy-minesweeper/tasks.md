**Note for implementation agents:** This sandbox has no headless browser access. Any task marked **[VISUAL — HALT]** cannot be verified by the agent directly — stop and prompt the user to verify in their own browser before marking it complete. Tasks without that marker should be verified with automated tests/commands as written.

## 1. Project Setup

- [x] 1.1 Scaffold a TypeScript client-only single-page app (bundler/dev server of choice) with no backend, and verify `npm run dev` (or equivalent) serves a blank page
- [x] 1.2 Configure strict TypeScript compilation and verify the build fails on a deliberately introduced type error, then remove it

## 2. Board Engine (`minesweeper-board`)

- [x] 2.1 Implement board data model (width, height, mine layout, per-cell revealed/flagged/mine state) and verify with unit tests constructing boards of several sizes
- [x] 2.2 Implement deferred, first-click-safe mine placement (mines placed only after first reveal, excluding the clicked cell and its neighbors) and verify with a unit test asserting the first-clicked cell and its neighbors are never mines across repeated random trials
- [x] 2.3 Implement single-cell reveal (mine -> loss, non-mine -> adjacent-mine-count) and verify with unit tests for both outcomes
- [x] 2.4 Implement flood-fill reveal for zero-adjacency cells, stopping expansion at numbered cells, and verify with a unit test on a known board layout asserting the exact set of revealed cells
- [x] 2.5 Implement flag toggle, including blocking reveal on flagged cells, and verify with unit tests for flag/unflag and blocked-reveal behavior
- [x] 2.6 Implement win detection (all non-mine cells revealed) and loss detection (mine revealed, further actions disabled) and verify with unit tests covering both end states
- [x] 2.7 Verify all `minesweeper-board` spec scenarios pass as automated tests

## 3. Frontier Solver Core (`frontier-solver`)

- [x] 3.1 Implement frontier identification (unrevealed cells adjacent to a revealed numbered cell) and verify with a unit test on a known board layout asserting the exact frontier cell set
- [x] 3.2 Implement Tier 0 trivial deduction (fully-satisfied and fully-mined numbers resolve neighbors to probability 0 or 1) and verify with unit tests against known deduction patterns
- [x] 3.3 Implement frontier connected-component decomposition (union-find over shared numbered neighbors) and verify with a unit test asserting disjoint regions split into separate components
- [x] 3.4 Implement per-component exact backtracking enumeration with constraint propagation and Tier 0 pre-application, and verify with a unit test reproducing a shared-constraint case where a cell resolves to certainty that neither constraint alone would force
- [x] 3.5 Implement cross-component combination weighted by the global remaining-mine count (binomial weighting over non-frontier cells) and verify with a unit test asserting per-cell marginal probabilities sum/normalize correctly across a multi-component board
- [x] 3.6 Implement non-frontier probability computation from the same weighted world list and verify with a unit test asserting all non-frontier cells share one probability value that shifts when frontier deductions change
- [x] 3.7 Implement per-frontier-cell expected information gain (mutual information between click outcome and the weighted world distribution, derived from the existing world list) and verify with a unit test against a hand-computed example
- [x] 3.8 Implement realized surprisal computation (`-log2 P(outcome)` under the pre-reveal world distribution) and verify with a unit test comparing predicted EIG and realized surprisal on the same resolved cell
- [x] 3.9 Verify all `frontier-solver` spec scenarios pass as automated tests

## 4. Solver Performance Isolation

- [x] 4.1 Move solver execution (sections 3.1-3.8) into a Web Worker with a message-based board-state-in / probabilities-and-EIG-out interface, and verify the main thread stays responsive (input still handled) while a deliberately large synthetic frontier is enumerating
- [x] 4.2 Trigger exactly one solver pass per settled board state (after a full flood-fill completes, not per individual revealed cell), and verify with a test asserting solver invocation count during a multi-cell flood-fill reveal

## 5. Rendering (`information-visualization` — heatmap)

- [x] 5.1 **[VISUAL — HALT]** Implement the Canvas2D board renderer (grid draw loop, cell fills from a per-cell probability array) and verify by rendering a board and visually confirming cell boundaries and layout
- [x] 5.2 Implement the p -> color mapping as a diverging scale and verify with a unit test asserting p=0 and p=1 map to visually distinct pole colors and p=0.5 maps to the neutral midpoint color (revised from sequential H(p) — see design.md decision 5)
- [x] 5.3 **[VISUAL — HALT]** Wire heatmap redraw to solver output for both frontier and non-frontier cells, and verify by triggering a reveal and visually confirming heatmap colors update across the whole board
- [x] 5.4 Implement grid-coordinate click/hover hit-testing and verify with a unit test mapping known pixel coordinates to expected row/column

## 6. Interaction (`information-visualization` — EIG and predicted/realized)

- [x] 6.1 **[VISUAL — HALT]** Implement hover/selection EIG readout for frontier cells only (no readout for non-frontier cells) and verify by hovering a known frontier cell and a known non-frontier cell and confirming the display differs
- [x] 6.2 **[VISUAL — HALT]** Implement the predicted-EIG-then-realized-surprisal display sequence on a frontier cell reveal and verify by revealing a frontier cell and confirming both values render and remain simultaneously visible for comparison
- [x] 6.3 Verify non-frontier reveals show no predicted-vs-realized comparison, matching the spec scenario

## 7. Game Loop Integration

- [x] 7.1 **[VISUAL — HALT]** Wire click/flag input, board engine, solver, and renderer into a single playable game loop and verify by playing a full game from first click through to a win and a separate game through to a loss
- [x] 7.2 Add board size/difficulty selection (e.g. Beginner/Intermediate/Expert presets) and verify programmatically (dimensions/mine-count assertions per preset); only fall back to visual confirmation if that's insufficient, per the note above

## 8. Verification

- [x] 8.1 Run the full automated test suite covering all three specs and verify all scenarios pass
- [x] 8.2 **[VISUAL — HALT]** Manually play through a full game exercising: trivial deduction, a shared-constraint certainty case, a non-frontier reveal, and a frontier reveal, confirming the heatmap, EIG readout, and predicted-vs-realized display all behave as specified
