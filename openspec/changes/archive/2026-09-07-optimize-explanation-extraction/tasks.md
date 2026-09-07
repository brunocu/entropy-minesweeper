## 1. Subset verdict cache (D2, D3)

- [x] 1.1 Add `SubsetVerdict` interface and `subsetSignature(constraints, flagGivens)` helper in `src/solver/frontierSolver.ts`, following the existing `componentSignature` style (sorted constraint keys + sorted flagGivens forcedMine/forcedSafe), and verify with a unit test that two constraint arrays with the same content but different order/identity produce identical signatures, and that a different flagGivens produces a different signature.
- [x] 1.2 Add `resolveSubset(cache, constraints, flagGivens)`: on a cache hit, return the stored `SubsetVerdict`; on a miss, run `applyTrivialDeduction`, and if a cell of interest isn't resolved by Tier-0 alone, fall back to `enumerateComponent` and derive `forcedMine`/`forcedSafe` for every cell in the subset (not just one) from assignment agreement across all returned assignments. Increment `growTrimCallCount` only on the miss path. Verify with a unit test that calling `resolveSubset` twice with the same subset increments `growTrimCallCount` only once.
- [x] 1.3 Rewrite `resolvesTo` to call `resolveSubset` and read `xKey`'s status off the returned verdict instead of running its own `applyTrivialDeduction`/`enumerateComponent`. Verify existing `frontierSolver.test.ts` assertions on `resolvesTo`-dependent behavior (via `growSufficientSet`/`trimToMinimal`) still pass unmodified at this stage (trim not yet replaced).
- [x] 1.4 Verify cross-cell reuse directly: construct a fixture where two certain cells' candidate subsets overlap or coincide, run `computeExplanations` for both, and assert `getGrowTrimCallCountForTest()` is lower than it would be with the cache disabled (e.g. by comparing against a call-count baseline captured before this task's change, or by asserting a specific expected count for the fixture).

## 2. QuickXplain trim (D1)

- [x] 2.1 Implement `quickXplain(cache, background, candidates, xKey, targetValue, flagGivens)` per design.md's D1 recursive formulation, using `resolvesTo` (now cache-backed) as its only consistency primitive. Verify with unit tests: single-element candidate set returns itself; a candidate set with one genuinely necessary element and several redundant ones returns exactly the necessary element; a candidate set that's entirely redundant given `background` alone returns the empty set.
- [x] 2.2 Replace `trimToMinimal`'s call site in `computeExplanationForCell` with `quickXplain([], candidate, xKey, targetValue, flagGivens)`, keeping `growSufficientSet`'s grow-order as the input ordering for determinism. Remove `trimToMinimal` once unused, or keep it deleted rather than dead code.
- [x] 2.3 Verify the "Minimal Certainty Explanation" spec scenarios still hold: single-clue certainty needs only that clue; joint certainty needs every clue it depends on with no redundant member; explanation excludes clues that don't affect the outcome. Run `frontierSolver.test.ts`'s existing scenario tests for these unmodified and confirm they pass.
- [x] 2.4 Verify "Explanation is deterministic for a fixed board state": add or confirm a test that calls `computeExplanationForCell`/`computeExplanations` twice against the same board state and asserts identical results.
- [x] 2.5 Run `frontierSolver.test.ts`. For any fixture asserting exact `clueCells`/`premiseCells` content that now fails because QuickXplain picked a different but equally-minimal explanation (a genuine tie), replace that assertion with one verifying the spec's actual properties (irreducible, deterministic) rather than exact content - per this project's convention, existing tests aren't contracts, so breaking on a spec-valid behavior change is expected, not a regression to work around.

## 3. Route premise extraction through the shared cache (D4)

- [x] 3.1 Update `extractPremiseKeys` to call `resolveSubset(cache, trimmed, flagGivens)` instead of its own direct `applyTrivialDeduction` call. Verify with a test asserting this call is a cache hit (no `growTrimCallCount` increment) immediately after `quickXplain` returns `trimmed` as sufficient.
- [x] 3.2 Run existing premise-cell scenario tests ("Explanation includes a relied-upon premise cell" and the flag-seeded variants) unmodified and confirm they still pass.

## 4. Wire the cache through `computeExplanations`

- [x] 4.1 Create one `SubsetVerdictCache` instance per `computeExplanations` call and thread it through `computeExplanationForCell`'s call sites (grow, QuickXplain trim, premise extraction) for every certain cell processed in that call, across all components.
- [x] 4.2 Verify the cache is call-scoped, not persisted across moves: confirm `computeExplanations` creates a fresh cache each invocation and that this is independent of, and does not interfere with, the existing cross-call `ComponentCache` (e.g. a test asserting `ComponentCache` cache-hit behavior from `frontierSolver.test.ts` still passes unmodified).

## 5. Full-suite validation and profiling

- [x] 5.1 Run the full test suite (`npm test`) and confirm all tests pass, replacing any remaining fixture assertions per task 2.5's approach.
- [x] 5.2 Rerun `PROFILE=1 npx vitest run src/solver/bottleneckProfile.test.ts --reporter=verbose` and record the before/after `computeExplanations`-vs-`solve` timing totals per difficulty, confirming the measured overhead has shrunk relative to the numbers captured before this change.
