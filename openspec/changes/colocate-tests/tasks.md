## 1. Baseline

- [x] 1.1 Run `npm test` and record the exact file count, test count, and pass/fail totals; save the summary line so the post-move run can be compared against it
- [x] 1.2 Run `npm run build` and confirm it currently passes, so any later type error is attributable to this change

## 2. Shared test support

- [x] 2.1 Create `src/__tests__/support/prng.ts` holding `mulberry32` and `src/__tests__/support/solverBoard.ts` holding `snapshotSolverBoard`, both moved verbatim from `src/solver/testSupport.ts`; verify by `npx tsc --noEmit` reporting no errors in the new files
- [x] 2.2 Add an optional trailing pre-placed mine layout parameter to the `Board` constructor in `src/board/board.ts` that sets mine flags, computes adjacent counts, and marks mines as placed; verify existing `new Board(...)` call sites still compile unchanged via `npm run build`
- [x] 2.3 Create `src/__tests__/support/boardFactory.ts` exposing a `boardFromMineLayout(layout)` factory built on the new constructor parameter; verify it produces a board whose first reveal does not re-randomize mines (temporary check or covered by 3.2)
- [x] 2.4 Create `src/__tests__/support/makeBoard.ts` with one grid-literal parser accepting the union of characters the five existing `makeBoard` copies accept; verify by unit-checking it against one grid literal from each of the five current call sites

## 3. Move tests and switch to shared helpers

- [x] 3.1 Move `src/board/*.test.ts` into `src/board/__tests__/`, `src/game/*.test.ts` into `src/game/__tests__/`, `src/render/*.test.ts` into `src/render/__tests__/`, `src/solver/*.test.ts` into `src/solver/__tests__/`, `src/explainer/*.test.ts` into `src/explainer/__tests__/`, and `src/informationVisualization.spec.test.ts` into `src/__tests__/`, fixing relative imports by one level; verify `npm test` collects all 31 test files
- [x] 3.2 Replace all `Board.fromMineLayout(...)` calls in `board.test.ts`, `board.spec.test.ts`, `gameController.test.ts`, and `cachePerformance.test.ts` with the `boardFactory` helper, then delete the static method from `src/board/board.ts`; verify those four files pass and `grep -rn fromMineLayout src` returns nothing
- [x] 3.3 Point `explanationSnapshot.test.ts`, `cachePerformance.test.ts`, `explanationProperties.test.ts`, and `predictedVsRealized.test.ts` at `src/__tests__/support/prng.ts` and `solverBoard.ts`, then delete `src/solver/testSupport.ts`; verify those tests pass and `grep -rn testSupport src` returns nothing
- [x] 3.4 Delete the five local `makeBoard` definitions in `informationVisualization.spec.test.ts`, `frontierSolver.spec.test.ts`, `frontierSolver.test.ts`, `revealFeedback.test.ts`, and `explanationProperties.test.ts` in favour of the shared helper; verify each of the five files still passes with identical assertions
- [x] 3.5 Stop exporting `parseSolverBoard` from `src/explainer/fixtures.ts` (keep it module-private); verify `npm run build` passes, proving no other module imported it

## 4. Verification

- [x] 4.1 Update the header comment in `bottleneckProfile.test.ts` to the new path and confirm `PROFILE=1 npx vitest run src/solver/__tests__/bottleneckProfile.test.ts` runs the profile
- [x] 4.2 Run `npm test` and confirm the file/test/pass/fail totals match the 1.1 baseline exactly
- [x] 4.3 Run `npm run build` and confirm it passes, then confirm each source directory listing contains only shipping modules plus `__tests__/`
