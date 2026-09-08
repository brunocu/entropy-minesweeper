## 1. Delete the worker subsystem

- [x] 1.1 Delete `src/solver/solverWorker.test.ts` (including its `buildLargeSyntheticFrontier` helper) and verify `npx vitest run` still passes with no unresolved-import failures
- [x] 1.2 Delete `src/solver/solverClient.ts`, `src/solver/solver.worker.ts`, and `src/solver/solverProtocol.ts`; verify with `grep -rn "solverClient\|solver.worker\|solverProtocol" src/ vite.config.* index.html` returning no hits
- [x] 1.3 Verify the worker's message types are gone with the file: confirm `SolveRequestMessage` / `SolveResponseMessage` have no remaining references (`grep -rn "SolveRequestMessage\|SolveResponseMessage" src/`), and confirm `SolveResult` / `SolverCell` remain exported from `frontierSolver.ts` since production code still uses them
- [x] 1.4 Run `npm run build` and verify `tsc` and the Vite build both succeed with no worker chunk emitted

## 2. Privatize `identifyFrontier`

- [x] 2.1 Drop the `export` keyword from `identifyFrontier` in `src/solver/frontierSolver.ts` and verify the four in-module call sites (lines ~164, ~210, ~808, ~1117) still resolve under `npx tsc --noEmit`

## 3. Remove test-only exports

- [x] 3.1 Remove `export` from `fromLabel` in `src/board/chessLabel.ts` — verify no non-test caller exists first, then update `src/board/chessLabel.test.ts` so the round-trip and error-case assertions cover `toLabel` only, and verify `npx vitest run src/board/chessLabel.test.ts` passes
- [x] 3.2 ~~Remove the `NEUTRAL_MIDPOINT_COLOR` and `EIG_LOW_COLOR` re-export aliases~~ — dropped by user decision during apply: the aliases stay exported, because inlining them would duplicate the hex literals in two test files and let the tests drift from the module. `src/render/probabilityColor.ts` and its two test consumers are unchanged by this change.
- [x] 3.3 Remove `WORLDS_TREE_CONTRAST_CELL` from `src/explainer/fixtures.ts`, inlining its `{ row: 0, col: 0 }` coordinates in `src/explainer/figures.test.ts` and `src/explainer/fixtures.test.ts`; verify both pass under `npx vitest run`

## 4. Verification

- [x] 4.1 Run the full suite (`npm test`) and the full build (`npm run build`) and verify both pass clean
- [x] 4.2 Verify both page entry points still work: load `main.ts` and `explainer/main.ts` in `npm run dev` and confirm the heatmap and explainer figures render as before (report to the user for visual confirmation rather than asserting it unseen)
