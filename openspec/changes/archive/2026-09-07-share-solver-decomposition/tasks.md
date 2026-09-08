## 1. Frontier index on `SolveResult` (D3)

- [x] 1.1 Add `readonly frontierByKey: ReadonlyMap<string, FrontierCellResult>` to `SolveResult` in `src/solver/types.ts`; verify `npx tsc --noEmit` reports errors only at the construction sites that still need updating.
- [x] 1.2 Build `frontierByKey` once where the frontier is built in `src/solver/probability.ts:solve`, and update every other `SolveResult` construction site (including `src/__tests__/support/`); verify `npm test` passes and `npx tsc --noEmit` is clean.
- [x] 1.3 Replace the seven `frontier.find(f => f.row === r && f.col === c)` scans with `frontierByKey.get(key(r, c))` in `src/main.ts`, `src/game/revealFeedback.ts` (x2), `src/explainer/worldsTree.ts`, `src/explainer/predictedVsRealized.ts`, `src/explainer/revealDemo.ts`, and `src/explainer/compileExplainer.ts`; verify no `frontier.find(` remains (`grep -rn "frontier.find(" src`) and `npm test` passes.
- [x] 1.4 Replace the three hand-built probability/EIG map pairs in `src/main.ts`, `src/explainer/revealDemo.ts`, and `src/explainer/boardSvg.ts` with reads from `frontierByKey`; verify `npm test` passes with unchanged explainer figure values and SVG snapshots.

## 2. Shared decomposition (D1, D2)

- [x] 2.1 Define the `Decomposition` interface and `decompose(board)` in `src/solver/decomposition.ts` carrying `board`, `frontierCoords`, `frontierKeys`, `frontierSet`, `frontierCoordByKey`, `constraints`, `components`, `componentSlices` (cells + `relevantConstraints`), `nonFrontierCells`, and `numberedCoordByKey` — and no flag-dependent value; verify `npx tsc --noEmit` accepts the module and a new unit test in `src/solver/__tests__/decomposition.test.ts` asserts the slices match today's per-consumer filter results for a fixture board.
- [x] 2.2 Change `solve(decomposition, cache)` in `src/solver/probability.ts` to consume the decomposition instead of rebuilding it, keeping its component signature built with `EMPTY_FLAGGED_CELLS` inside `solve`; verify `npm test -- src/solver` passes with identical probabilities.
- [x] 2.3 Change `computeExplanations(decomposition, solveResult, flaggedCells, cache)` in `src/solver/explanation.ts` to consume the decomposition, keeping the real-flagged-set signature and flag givens inside the function; verify `src/solver/__tests__/explanation.test.ts`, `explanationSnapshot.test.ts`, and `explanationProperties.test.ts` pass unchanged.
- [x] 2.4 Run the flag-invariance guard first among the integration checks: `npm test -- src/solver/__tests__/decomposition.test.ts` including `'flagging a cell does not satisfy a neighbor's mine count'`, plus `src/solver/__tests__/frontierSolver.spec.test.ts`; verify both pass, confirming no flag state leaked into the shared value.
- [x] 2.5 Update `src/game/gameController.ts` so `reveal` decomposes once and passes the same `Decomposition` to `solve` and `computeExplanations`, and `toggleFlag` decomposes once for its `computeExplanations` call; verify `src/game/__tests__/gameController.test.ts` passes.
- [x] 2.6 Update the remaining `solve`/`computeExplanations` call sites across `src/explainer/`, `src/main.ts`, and `src/__tests__/support/` to pass a decomposition; verify `npx tsc --noEmit` is clean and `npm test` passes.
- [x] 2.7 Update the call-counter expectations in `src/solver/__tests__/cachePerformance.test.ts` and `src/solver/__tests__/bottleneckProfile.test.ts` to the new counts, asserting the decomposition phase runs once per board state rather than once per consumer; verify both tests pass and would fail if the decomposition were rebuilt per consumer.

## 3. Single enumeration in `buildTree` (D4)

- [x] 3.1 Add a single entry point in `src/solver/probability.ts` returning both the `SolveResult` and the `WeightedWorlds` from one `enumerateWorlds` call, and make `solve` and `enumerateWeightedWorlds` thin wrappers over it; verify `npm test -- src/solver` passes with identical outputs from both.
- [x] 3.2 Have `src/explainer/worldsTree.ts:buildTree` call that entry point once in place of its back-to-back `enumerateWeightedWorlds` + `solve` pair; verify `src/explainer/__tests__/worldsTree.test.ts` passes, the `focus-probability` figure value in `src/explainer/__tests__/figures.test.ts` is unchanged, and `buildTree` enumerates once (`getEnumerationCallCountForTest`).

## 4. One solve per explainer fixture (D5)

- [x] 4.1 Solve each fixture once (`WORLDS_TREE_BOARD`, `CERTAINTY_BOARD`) at the top of the illustration pipeline and thread the result through `buildIllustrationFiles` and `computeFigureValues` as a parameter to `renderBoardSvg`, `renderCertaintyBoard`, and `renderWorldsTree`; verify `grep -rn "solve(" src/explainer` shows one call per fixture and `npm test -- src/explainer` passes with unchanged illustration files and figure values.

## 5. One `toRenderBoard` (D7)

- [x] 5.1 Give the shared cell-fill rule (revealed -> no fill; else frontier entry, else pooled non-frontier probability) one name in `src/render/`, and call it from `src/main.ts`, `src/explainer/revealDemo.ts`, and `src/explainer/boardSvg.ts`; leave the two `toRenderBoard` conversions separate per design.md D7. Verify `npm test` passes including `src/render/__tests__/boardRenderer.test.ts` and unchanged SVG output, and that a new unit test pins the rule's three cases (revealed, frontier, non-frontier).

## 6. Redraw guards (D6)

- [x] 6.1 Change `GameController.toggleFlag` in `src/game/gameController.ts` to return the boolean `Board.toggleFlag` already produces; verify `src/game/__tests__/gameController.test.ts` covers both the changed and no-op toggle return values.
- [x] 6.2 Add the `mousemove` guards in `src/main.ts`: skip `draw()` when the pointer is still in the cell it was in on the previous event, and when there was no highlight before and none after (updating `hoverReadout` text only); verify `npx tsc --noEmit` is clean and the guard conditions are the two named in design.md D6.
- [x] 6.3 Add the remaining guards in `src/main.ts`: `mouseleave` skips when `hoveredHighlight` was already `null`; `click` skips when `controller.reveal` returned `false`; `contextmenu` skips when the event hit no cell or when `toggleFlag` returned `false`; verify `npm test` still passes.
- [x] 6.4 Gate `uncertaintyChart.update` on the plotted history having grown rather than calling it per `draw()`; verify `src/render/__tests__/uncertaintyChart.test.ts` passes and the update is unreachable from a hover-only redraw.
- [x] 6.5 Manual browser verification (no headless browser in this repo — this cannot be automated): run `npm run dev` and confirm hovering across cells updates readout and highlight; hovering within one cell does not flicker; clicking a flagged cell leaves the screen unchanged; flagging and unflagging updates the mines-left count; mousing off the board clears the highlight; the uncertainty chart advances on each reveal and resets on a new game. Ask the user to perform this check and report results before the change is considered done.

## 7. Final verification

- [x] 7.1 Run `npm test` and `npm run build`; verify both succeed with no remaining duplicate decomposition work (`grep -rn "identifyFrontier\|buildConstraints\|computeComponents" src` shows calls only from `decompose`).
