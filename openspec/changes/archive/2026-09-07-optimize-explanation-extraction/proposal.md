## Why

Profiling (`src/solver/bottleneckProfile.test.ts`, PROFILE=1 harness) shows `computeExplanations` costing 6-16x more than the probability-solving enumeration it runs alongside per move, even on boards where the underlying CSP is easy to solve - this is a search-structure/redundancy problem in `computeExplanationForCell`'s grow/trim implementation, not raw CSP hardness. A literature review of proven minimal-explanation (MUS) extraction techniques identified two concrete, dependency-free improvements that target exactly this overhead: replacing the linear, fixed-order deletion trim with QuickXplain's divide-and-conquer minimization, and eliminating redundant oracle re-derivation across the many certain-cell queries that share overlapping candidate constraint sets within one `computeExplanations` call.

This is scoped narrowly to that overhead. It does not address the separate, more severe "uncapped exponential enumeration on large ambiguous components" issue (up to 78 free variables observed on Expert boards), which needs its own follow-up change with a free-variable cap/fallback.

## What Changes

- Replace `trimToMinimal`'s linear, fixed-order deletion pass with QuickXplain's divide-and-conquer minimization algorithm, using the existing `resolvesTo` oracle unchanged. Cuts oracle-call count from up to `n` (candidate set size) to roughly `2k·log2(n/k)` worst case, where `k` is the final minimal explanation size - a meaningful reduction whenever the grown candidate set is much larger than the true minimal explanation, which profiling shows is the common case.
- Add an oracle-verdict cache shared across all certain-cell explanation queries within a single `computeExplanations` call, so that the many per-cell grow/trim searches - which query heavily-overlapping candidate constraint sets within the same component - reuse prior `resolvesTo` verdicts instead of recomputing them from scratch for every cell.
- Output is unchanged: `computeExplanations` must still return the same explanation set for the same board state as it does today (see `frontier-solver`'s "Explanation is deterministic for a fixed board state" and "Minimal Certainty Explanation" requirements) - this is a performance change, not a behavior change, matching how the prior `cache-frontier-explanations-by-component` change was scoped.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
(none - output behavior is unchanged; only the internal minimization algorithm and oracle-call reuse strategy change)

## Impact

- `src/solver/frontierSolver.ts`: `trimToMinimal` is replaced by a QuickXplain-based minimization function; `resolvesTo` gains a shared verdict-cache parameter (or an equivalent memoization wrapper) threaded through `growSufficientSet`, the new trim, and `extractPremiseKeys` within one `computeExplanationForCell`/`computeExplanations` pass. The per-call cache is separate from and does not replace the existing cross-call `ComponentCache`.
- No changes to `src/game/gameController.ts`, `src/main.ts`, or any consumer-facing API - `latestExplanations`'s shape and contents are unchanged.
- This is not required to produce bit-identical explanation output to today's linear-deletion algorithm - only irreducible and deterministic, per the `frontier-solver` spec's actual requirements. Some existing `frontierSolver.test.ts` fixtures assert exact explanation content and may break if they hit a genuine tie between equally-minimal explanations; per this project's convention that tests verify behavior rather than pin it, any such fixture is replaced with a new assertion checking the spec's actual properties (irreducibility, determinism), not preserved as-is. New tests will also cover QuickXplain's minimality guarantee and the verdict cache's hit/miss behavior directly.
- `src/solver/bottleneckProfile.test.ts` (the PROFILE=1 investigation harness) can be rerun after this change to confirm the measured `computeExplanations`-vs-`solve` overhead has shrunk.
