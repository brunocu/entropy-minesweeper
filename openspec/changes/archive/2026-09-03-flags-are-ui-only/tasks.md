## 1. Solver: remove flag influence

- [x] 1.1 Remove `SolverCell.flagged` and all uses in `src/solver/frontierSolver.ts` (forced-mine seeding, the fixed-mine shortcut in component enumeration); a flagged cell must be built/solved identically to an unrevealed `'?'` cell, verified by `npm run typecheck` (or equivalent) passing with no remaining references to `flagged`.
- [x] 1.2 Rewrite the flagged (`'F'`) fixture cases in `src/solver/frontierSolver.test.ts` to assert flagged cells behave exactly like unrevealed cells (same probability/EIG/entropy as the equivalent unflagged board), and verify `npm test -- frontierSolver` passes.

## 2. Board: report whether an action mutated state

- [x] 2.1 Change `Board.reveal` in `src/board/board.ts` to return `boolean` (`true` if it mutated state, `false` for every existing no-op case: game already won/lost, cell flagged, cell already revealed), verified by a new `board.test.ts` case for each no-op path plus the state-changing path.
- [x] 2.2 Change `Board.toggleFlag` in `src/board/board.ts` to return `boolean` (`true` if it toggled the flag, `false` for game-over or already-revealed no-ops), verified by a new `board.test.ts` case for each path.

## 3. GameController: gate move recording on actual state change

- [x] 3.1 Update `GameController.reveal` in `src/game/gameController.ts` to call `recordMove()` only when `board.reveal(...)` returned `true`; when it returned `false`, skip both the solver re-run and `recordMove()` (leave `latestSolve` and `uncertaintyHistory` untouched), verified by `gameController.test.ts`.
- [x] 3.2 Update `GameController.toggleFlag` to no longer call `solveFn` or `recordMove()` at all — just delegate to `board.toggleFlag(...)`, verified by `gameController.test.ts` asserting `latestSolve` and `uncertaintyHistory` are unchanged (same object reference or identical values) after a flag toggle.
- [x] 3.3 Rewrite the `gameController.test.ts` "uncertainty history" tests: replace the existing assertion that two flag toggles advance `moveIndex` sequentially with an assertion that flag toggles never advance `moveIndex` or grow `uncertaintyHistory`; add a case for clicking an already-revealed cell not advancing `moveIndex`; add a case for a genuine reveal still advancing `moveIndex` by exactly 1. Verify `npm test -- gameController` passes.
- [x] 3.4 Update/confirm the "one solver pass per settled board state" tests (`gameController.test.ts`) to reflect that `toggleFlag` no longer invokes the solver at all (was: asserted exactly one call; now: assert zero calls), verified by the same test file passing.

## 4. Full verification

- [x] 4.1 Run the full test suite (`npm test`) and confirm all tests pass, including the rewritten solver and controller tests.
- [x] 4.2 Manually sanity-check in the running app (or via `Board`/`GameController` directly) that: flagging a cell adjacent to a satisfied number no longer marks other neighbors certain; clicking an already-revealed cell does not add a chart point; a genuine reveal still does.
