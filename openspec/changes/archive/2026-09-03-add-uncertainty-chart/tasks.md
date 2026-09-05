## 1. Solver: expose total joint uncertainty

- [x] 1.1 Add `totalEntropyBits: number` to `SolveResult` in `src/solver/frontierSolver.ts`, computed as `Math.log2(Z)` from the existing `Z` accumulator in `solve()`, and verify with a unit test asserting `totalEntropyBits === 0` when only one configuration remains consistent, and that it decreases (or stays equal) after a reveal that adds a constraint
- [x] 1.2 Add a unit test verifying `totalEntropyBits` equals `log2(C(K, remainingMines))` for a board with no frontier (only non-frontier cells), confirming the formula matches the hypergeometric/combinatorial case rather than an independent-Bernoulli sum

## 2. Game controller: move history

- [x] 2.1 Add an `uncertaintyHistory: ReadonlyArray<{ moveIndex: number; totalEntropyBits: number }>` (or equivalent) to `GameController`, seeded with the move-0 entry (initial board's `totalEntropyBits`) when a game starts, and verify with a unit test that a new controller instance starts with exactly one history entry at move index 0
- [x] 2.2 Append a new history entry after each `reveal` and `toggleFlag` call, incrementing move index by one each time, and verify with a unit test that N reveals/toggles produce N+1 history entries with sequential move indices
- [x] 2.3 Reset `uncertaintyHistory` back to a single move-0 entry when a new game starts, and verify with a unit test that starting a new game after several moves clears prior history

## 3. Chart rendering

- [x] 3.1 Add `uplot` as a runtime dependency in `package.json` and verify `npm install` succeeds and the package is importable from a TypeScript file
- [x] 3.2 Create `src/render/uncertaintyChart.ts` wrapping `uplot`, exposing functions to create the chart against a container element, update it from an `uncertaintyHistory` array, and verify by rendering it against a sample history array in a unit or component-level test (or manual check if canvas rendering isn't testable in the current test setup) and confirming the module compiles and exports the expected functions
- [x] 3.3 Mount a new chart container element in `src/main.ts` alongside the existing board/status UI, and wire it to call the chart module's update function after each `GameController` mutation and its reset function on new game
- [x] 3.4 Manually verify in the running dev server that the chart displays move 0's initial uncertainty, appends a point after each reveal/flag toggle, and resets to a single move-0 point when starting a new game

## 4. Confirm export stays unaffected

- [x] 4.1 Verify (via existing `stateExport` tests or a new assertion) that `buildStateExport`'s output shape is unchanged and does not include `uncertaintyHistory` or `totalEntropyBits` history data
