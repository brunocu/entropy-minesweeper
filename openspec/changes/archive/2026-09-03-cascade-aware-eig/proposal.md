## Status: REVERTED (2026-09-03)

This change was implemented, then reverted after `cascade-eig-calibration`'s Part 2 measurement
(real solver-guided play, same moves compared under both formulas) showed the cascade-aware term
made the predicted-vs-realized EIG gap *worse* on the metric that matters (mean absolute error:
baseline 2.29 vs. cascade-aware 4.08, consistently across 5 independent seed ranges, 1291 moves) -
see `design.md`'s Migration Plan for the full writeup. `frontierSolver.ts`'s `eig` has reverted to
plain single-reveal EIG; `cascadeProbability` and the cascade BFS machinery were removed entirely.
The `cascade-eig-calibration` change (dev-only calibration harness) was removed alongside it, since
it existed solely to measure this feature. Both changes' docs are kept, archived, for the record.
The delta spec below was **never merged** into the main `frontier-solver` spec - it documents what
was built and then undone, not a currently-true requirement.

## Why

`frontier-solver`'s expected information gain (EIG) treats revealing a cell as a single-outcome event, scoring only the entropy drop from learning that cell's own number. But revealing a cell whose true value is 0 actually cascades, flood-revealing a whole connected region of further cells. Today's EIG doesn't credit that, so it systematically undersells cells likely to cascade — which is directly visible in-app as a gap between `predictedEig` and the post-reveal `revealedInformation` (`src/game/revealFeedback.ts`). This change adds a cheap, cascade-aware term to close (not eliminate) that gap.

## What Changes

- Add `cascadeProbability` to each frontier cell's result: the already-known-exactly probability that revealing it yields a 0 (`outcomeProbabilities['safe:0']`), simply exposed as a named field.
- Add an `expectedCascadeInfo` term computed via a single probability-weighted BFS outward from each frontier cell over the local unrevealed-cell graph: at each hop, propagate reveal-probability using the real local mine density and each cell's actual (edge/corner-aware) unrevealed-neighbor count, accumulating each newly-reachable cell's own estimated self-entropy, pruned once reveal-probability decays below a small threshold. Where a reachable cell is itself an already-enumerated frontier cell, its exact solver-computed probability is used in place of the density estimate.
- Fold this into the cell's reported `eig` as `EIG_single + expectedCascadeInfo`, so the number consumed by the UI and by `revealFeedback.ts` is cascade-aware by default.
- **BREAKING**: `FrontierCellResult.eig` changes meaning from "single-reveal EIG" to "cascade-aware EIG" — existing consumers reading `eig` as a strict single-outcome quantity will see different (generally larger, for cells likely to cascade) values. `EIG_single` is not separately exposed unless something downstream needs it.
- Amend `frontier-solver`'s Purpose statement, which currently states no approximation ships as a mode: the core probability/EIG enumeration (Trivial Deduction, Frontier Component Decomposition, Exact Joint World Enumeration, Global Mine-Count Weighting) stays exact and unchanged; only the new cascade term is approximate, and it must be clearly documented as such rather than silently blended in as if exact.
- Known, accepted limitation (documented in design.md, not solved by this change): the BFS-propagation model treats each newly-reachable cell's information as independent. It will overestimate when a cascade sweeps ordinary open territory (double-counts shared uncertainty against the ambient density baseline) and cannot detect the case where a cascade's border cell reconnects into a separate, already-partially-solved frontier component — the single largest real information jump a cascade can produce. Closing that gap fully would require a conditional re-solve, which is exactly the cost this change avoids. An empirical comparison (predicted vs. realized information, before and after this change) is planned once implementation lands, to characterize how much of the gap actually closes and how large the remaining fusion blind spot is in practice.

## Capabilities

### Modified Capabilities
- `frontier-solver`: EIG computation gains a cascade-aware term (approximate) alongside the existing exact probability/world-enumeration machinery; Purpose statement is amended to scope the "no approximation" guarantee to the exact core rather than the whole capability.

## Impact

- `src/solver/frontierSolver.ts`: `computeFrontierCellResult` gains the BFS-propagation step and folds its result into `eig`; `FrontierCellResult` gains `cascadeProbability`.
- `src/game/revealFeedback.ts`: `predictedEig` now reflects the cascade-aware figure with no code change needed there, since it just reads `frontierResult.eig` — but the gap it reports against `revealedInformation` should narrow, which is the change's actual goal and its planned empirical check.
- `src/render/uncertaintyChart.ts` and any other `eig` display: worth a follow-up look at whether showing `cascadeProbability`/the cascade contribution as a breakdown (vs. one blended number) is warranted, given it's an approximation — left to design.md.
