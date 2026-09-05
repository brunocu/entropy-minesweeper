## 1. Solver: clue-adjacency and BFS layering

- [x] 1.1 Build a per-component clue-adjacency structure (which revealed numbered cells share a frontier neighbor), reusing `buildConstraints`/`computeComponents`, and verify with a unit test that BFS layers computed from a given cell match hand-derived layers on a small fixture board.
- [x] 1.2 Implement BFS layer ordering outward from a given frontier cell over that structure, with same-distance clues grouped into one layer (no per-cell tie-break), and verify via a unit test on a board with multiple clues at the same distance that they land in the same layer.

## 2. Solver: grow-then-trim minimal explanation search

- [x] 2.1 Implement the grow phase: add BFS layers to a candidate constraint set one layer at a time, checking sufficiency after each layer first via the existing Tier-0 trivial-deduction pass, falling back to exact backtracking restricted to the candidate set only when Tier-0 doesn't resolve it; verify against a fixture resolvable by Tier-0 alone (single clue) and a fixture requiring joint/backtracking reasoning (e.g. a "1-2-1" pattern) that the grow phase reaches a sufficient set in each case.
- [x] 2.2 Implement the trim phase: deletion-based minimization over the grown set only, in a fixed, deterministic order; verify with a unit test that removing any single member of a trimmed result changes the target cell's resolved certainty (no redundant members remain).
- [x] 2.3 Implement premise-cell extraction: run the Tier-0 pass over the final trimmed set and include any forced-mine or forced-safe cell it relies on; verify with one fixture where a clue's constraint is only satisfied because a neighbor is already known-mine, and a second fixture for known-safe, confirming that neighbor appears in the explanation set in each case.
- [x] 2.4 Verify explanation-set determinism (frontier-solver spec scenario): querying the same certain cell's explanation twice for the same board state returns an identical result both times.
- [x] 2.5 Verify exclusion cases (frontier-solver spec scenarios): a cell with probability strictly between 0 and 1 and a non-frontier cell produce no explanation set; a revealed numbered cell in the same component that doesn't affect a given cell's certainty is excluded from that cell's explanation set.

## 3. Solver: batch computation per solve

- [x] 3.1 Implement a function that runs the grow-then-trim search (2.1-2.3) for every frontier cell with probability exactly 0 or 1 after a `solve()` call, producing a lookup keyed by cell; verify it covers every such cell on a fixture board with multiple independent certainties.
- [x] 3.2 Wire this batch computation into `GameController.reveal()` immediately after the existing solve pass so the explanation lookup is available as soon as a reveal settles; verify with a `GameController` test that the lookup reflects the board state after each reveal and is recomputed (not stale) after a subsequent reveal.

## 4. Rendering: two-tone explanation highlight

- [x] 4.1 Choose two new categorical outline colors distinct from the existing diverging (`SAFE_POLE`/`MINE_POLE`) and sequential EIG (`EIG_LOW`/`EIG_HIGH`) scales in `probabilityColor.ts`, and record them as named exports alongside the existing palette constants.
- [x] 4.2 Extend `BoardRenderer`/`RenderCell` to accept a per-cell highlight role (clue, premise, or none) and draw an additive inset stroke on top of existing fill/markers; verify with a renderer test that a highlighted premise cell's existing certainty-ring/fill markup is still drawn alongside the new stroke (information-visualization spec's "Highlight does not obscure existing cell state" scenario).
- [x] 4.3 Verify via renderer test that clue-role and premise-role cells receive visually distinct stroke colors (information-visualization spec's "Clue and premise cells are visually distinguishable" scenario).

## 5. Hover wiring

- [x] 5.1 Extend the `mousemove` handler in `main.ts` to look up the precomputed explanation set for the hovered cell when it qualifies (unrevealed frontier cell, probability exactly 0 or 1) and pass clue/premise roles into the render call, performing no computation on `mousemove` itself.
- [x] 5.2 Verify the highlight clears when the mouse leaves a qualifying cell or moves to a non-qualifying cell, and that hovering a different qualifying cell replaces rather than accumulates the highlight (information-visualization spec's "Highlight follows the inspected cell" scenario).

## 6. Manual verification

- [x] 6.1 Run the app, reveal cells until at least one p=0 and one p=1 frontier cell are on the board, hover each, and visually confirm the clue/premise highlighting matches a manually worked-out deduction for that position.

## 7. Solver: expose real per-component forced sets (design.md Decision 5, step 1)

- [x] 7.1 Change `enumerateComponent` (or a thin wrapper around it) to also return its already-computed `fixed` map (`forcedMine`/`forcedSafe` over the component's full constraint set) instead of discarding it, without changing its existing return value's meaning or any existing caller's behavior; verify with a unit test that the exposed forced sets match `computeTrivialDeductions`-style expectations on a fixture requiring backtracking (not just Tier-0) to resolve.

## 8. Solver: flag-aware premise seeding (design.md Decision 5, steps 2-3)

- [x] 8.1 Add a flagged-cells input to `computeExplanations` (e.g. `flaggedCells: ReadonlySet<string>` or equivalent board-derived coordinates), without adding a `flagged` field to `SolverCell`/`SolverBoard` (flags stay out of the core solver data model per the existing frontier-solver spec).
- [x] 8.2 Per component, compute `flagGivens = flaggedCells ∩ (forcedMine ∪ forcedSafe)` using the sets exposed in task 7.1, restricted to that component's cells.
- [x] 8.3 Thread `flagGivens` into `resolvesTo`'s `applyTrivialDeduction` calls (used by both grow and trim) and into premise extraction, seeding the `forcedSafe`/`forcedMine` accumulators before the fixpoint loop runs, for cells in the corresponding component only.
- [x] 8.4 Verify with a fixture: a p=1 cell `X` whose only local (unflagged) explanation would require pulling in an extra BFS layer to prove a neighbor `A` is a mine; flag `A`, and confirm the recomputed explanation for `X` omits that extra layer while `A` still appears as a premise cell.
- [x] 8.5 Verify with a fixture: flagging a cell that is *not* independently, globally forced (an incorrect or unprovable flag) produces no change to any explanation - confirms Option A (unconditional trust) was not implemented.
- [x] 8.6 Verify explanation-set determinism still holds (extends 2.4): querying the same certain cell's explanation twice for the same board state *and* the same flag state returns an identical result both times.

## 9. Wiring: recompute explanations on flag toggle, excluded from the uncertainty chart

- [x] 9.1 Extend `GameController.toggleFlag()` to recompute `latestExplanations` via `computeExplanations(board, latestSolve, ...)` after `board.toggleFlag()`, reusing the existing `latestSolve` unchanged.
- [x] 9.2 Verify with a `GameController` test that `toggleFlag()` still never calls `solveFn` (extends the existing "never for a flag toggle" test in `gameController.test.ts`) and still never advances `moveIndex`/grows `uncertaintyHistory` (extends the existing "flag toggles never advance moveIndex" test).
- [x] 9.3 Verify with a `GameController` test that `latestExplanations` actually changes after a `toggleFlag()` call that flags a cell satisfying task 8.4's fixture shape (i.e., the recompute is real, not a no-op wire-up).

## 10. Manual verification

- [x] 10.1 Run the app, reveal cells until a certain frontier cell's explanation spans more than one BFS layer, flag the far-layer premise cell, and visually confirm hovering the certain cell now highlights a smaller clue set while the flagged cell still shows as a premise.
