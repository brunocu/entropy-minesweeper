## Context

See proposal.md - Why. `cascade-aware-eig`'s design.md (Decisions 2-3, Risks/Trade-offs) built `expectedCascadeInfo` from a mean-field/independence approximation and explicitly predicted two failure modes, both flagged as accepted-but-unquantified risk at the time: (1) systematic overestimation from treating newly-reachable shadow cells' information as independent when they share a finite mine budget, and (2) a "fusion blind spot" where a cascade reconnects into a separate, already-partially-solved frontier component - the single largest real information jump a cascade can produce, and one this estimator cannot see by construction (seeing it requires a conditional re-solve, the cost the whole design avoids). Real play now shows the predicted overestimate live in the UI, matching (1). This change builds the harness to quantify both (1) and (2) directly rather than continuing to eyeball the in-app readout.

Two existing pieces of machinery this design builds on directly:
- `src/solver/frontierSolver.ts`'s `computeFrontierCellResult`/`solve`, and `src/game/revealFeedback.ts`'s `computeRevealFeedback` (`preSolve.totalEntropyBits - postSolve.totalEntropyBits`) - the exact machinery already used to compute the in-app `predictedEig`/`revealedInformation` readout.
- `src/solver/cachePerformance.test.ts`'s pattern: a seeded `mulberry32` PRNG for reproducible random mine layouts, a `SolverBoard` snapshot helper, and a `Board`-driven reveal loop - reused here instead of inventing a new board-generation approach.

## Goals / Non-Goals

**Goals:**
- Quantify the cascade estimator's overestimation bias in isolation from real-play noise, stratified by real board-preset density and by boundary-distance (how close the estimate region is to an already-revealed edge).
- Quantify how much of the real predicted-vs-realized gap is attributable specifically to the fusion blind spot, and how that changes as a game progresses (revealed fraction).
- Produce numbers (not a fix): raw mean bias and geometric-mean ratio bias per stratification bucket, per the forecast-verification/entropy-estimation literature consulted during exploration (Murphy decomposition; entropy-estimator bias literature reporting both `E[Ĥ-H]` and `E[Ĥ/H]`).

**Non-Goals:**
- No change to the shipped estimator, `frontierSolver.ts`, or `revealFeedback.ts`. Measurement only.
- No bias-correction mechanism. Deciding what to do with the measured bias (leave as-is, correct, adjust pruning, expose a UI breakdown) is explicitly deferred to a follow-up decision per proposal.md's Impact section.
- No synthetic density sweep beyond the three real presets (Beginner/Intermediate/Expert) - deliberate, per user decision during exploration, to keep results tied to what's actually played rather than points nobody will encounter.
- No attempt to make Part 1's isolated estimator "solver-aware" (i.e., it never substitutes an exact frontier probability for `q0` mid-computation) - that substitution is exactly what real gameplay does and is what Part 2 exists to capture instead. Keeping Part 1 pure-`(q,d)` is what makes it an isolated measurement of the estimator itself.

## Decisions

### 1. Two independent parts, not one combined harness

Part 1 (isolated estimator calibration) and Part 2 (fusion-blind-spot tracking over a real game) measure different things and were kept structurally separate rather than merged into one Monte Carlo loop:

- Part 1 needs no `Board`/`solve()` machinery at all - it's the `(q,d)` formula compared against exact combinatorics on a small bounded region. Fast, high-volume, no gameplay dependency.
- Part 2 fundamentally requires the exact multi-component frontier solve (to detect merging components) and real board progression - it cannot be isolated the way Part 1 is, by construction (fusion is a cross-component effect).

**Alternative considered**: fold boundary-distance and fusion-tracking into one full-game Monte Carlo loop. Rejected - conflates two different independent variables (an isolated `(q,d)` estimator property vs. a topology-dependent, cross-component effect) into one noisier signal, and forces Part 1's exact-combinatorics ground truth (cheap only because the region is small and bounded) to run inside a full board, which it doesn't need to.

### 2. Part 1: isolated estimator calibration via exact local combinatorics

For each preset's mine density `q` (Beginner ~0.123, Intermediate ~0.156, Expert ~0.206 - the exact `mineCount/(width*height)` from `src/game/difficulty.ts`, not rounded presets) and each boundary-distance bucket (`interior`: full 8-neighbor cells only, unconstrained by any board edge; `edge-adjacent`: root cell placed near a board edge so some BFS-reachable cells have truncated `d`; `corner-adjacent`: same near a board corner):

1. Construct a small bounded region (sized to comfortably contain the BFS's pruned reach at the given `epsilon`/max-node-count from `cascade-aware-eig`).
2. Force the root cell `x` to be a 0 (matches `cascade-aware-eig` Decision 2's observation that the root's `cascadeProbability` is exact and multiplies everything downstream - isolating the cascade term itself means conditioning on it firing, not re-measuring the already-exact `p(x=0)` term).
3. `predicted = expectedCascadeInfo(x)`, computed by calling the real BFS-propagation + `H(n)` logic from `frontierSolver.ts` directly (not reimplemented) with the bucket's `(q, d)`.
4. `actual`: place concrete mines in the bounded region at density `q` (many Monte Carlo draws), run the real `floodReveal` logic, and compute the exact entropy drop for that concrete region via direct enumeration (the region is small enough - bounded by the same pruning that bounds Part 1's own BFS - to enumerate exactly rather than approximate).
5. Aggregate per (density, boundary) bucket: raw mean bias (`mean(predicted - actual)`) and geometric-mean ratio bias (`exp(mean(log(predicted/actual)))`), per the literature-recommended dual-metric approach (arithmetic mean of a ratio is skewed by the overestimate-heavy tail; geometric mean is the correct central-tendency statistic for a ratio).

**Alternative considered**: report only one of raw bias or ratio bias. Rejected per session literature research (forecast verification / Murphy decomposition, percolation mean-field bias reporting, entropy-estimator bias literature) - all three independently converge on reporting both, since bias here is expected to scale with the magnitude of the predicted quantity (heteroscedastic), which raw bias alone obscures and ratio bias alone can't disambiguate from small-sample noise near zero.

### 3. Part 2: solver-guided synthetic playthrough with fusion classification

For each preset: generate a seeded random board (mulberry32, reusing `cachePerformance.test.ts`'s pattern) and drive a full playthrough where each move reveals the cell with the highest `frontierResult.eig` (mirrors real assisted play - a user following the solver's own recommendation). At every move:

1. Snapshot `SolverBoard` before and after, and call the real `computeRevealFeedback` to get `predictedEig` and `revealedInformation` - the exact same computation the in-app readout uses.
2. Classify the move: compare the frontier component structure immediately before the reveal against immediately after. If the post-reveal solve's frontier merges cells that belonged to two or more components that were separate pre-reveal, mark it `fusion: true`.
3. Record `(revealedFraction, predictedEig, revealedInformation, fusion)` per move.

Aggregate bias (raw + ratio, per Decision 2's dual-metric choice) as a function of `revealedFraction`, split into `fusion: true` / `fusion: false` series, to see both how the gap trends over a game and how much of it concentrates in fusion events specifically.

**Alternative considered (move-selection policy)**: row-major or uniform-random reveal instead of solver-guided. Rejected per user decision during exploration - solver-guided is the realistic case (what a user actually experiences), and the circularity of "the biased estimator picks the moves that are then evaluated for bias" doesn't invalidate the predicted-vs-actual comparison itself; it's still an honest comparison of what was predicted against what happened, for the actual move sequence a real user would see.

**Alternative considered (fusion detection)**: infer fusion indirectly from a large residual (`revealedInformation` far exceeding `predictedEig`) rather than directly comparing component structure. Rejected - a large residual is also consistent with plain estimator variance at high `revealedFraction` (fewer, larger remaining components), and the whole point of this part is to separate "fusion happened" from "the estimator was just off," which requires the direct structural check, not an inference from the same noisy quantity being measured.

### 4. Reuse solver internals directly, don't reimplement

Both parts call into `frontierSolver.ts`'s actual exported functions (`computeFrontierCellResult`, `solve`) and `revealFeedback.ts`'s `computeRevealFeedback` rather than reimplementing the formulas in the test harness. This guarantees the harness measures the real shipped estimator, not a paraphrase of it that could silently drift from the implementation.

## Risks / Trade-offs

- **[Part 1's "exact local combinatorics" ground truth still needs a bounding assumption]** → The bounded region must be large enough that boundary truncation (cells falling outside it) doesn't itself bias the "exact" ground truth. Mitigated by sizing the region relative to the same `epsilon`/max-node-count backstop that already bounds the BFS estimate being measured - if the estimator's own reach is bounded there, the ground-truth region only needs to be bounded slightly beyond that, not unboundedly large.
- **[Solver-guided Part 2 may under-sample low-density/rarely-visited board regions]** → Highest-EIG-first play tends to visit the most information-dense cells first, which may not evenly sample all boundary/topology conditions. Not mitigated - accepted as realistic per Decision 3's alternative-considered note; if this later turns out to hide an important effect, Part 1's density x boundary sweep still covers the isolated-estimator case exhaustively regardless of what Part 2's specific playthroughs happen to visit.
- **[Fusion classification is a binary flag, not a magnitude]** → A move that merges two components contributes some information from fusion and some from ordinary cascade growth; this design reports fusion as a group split (bias stats conditioned on `fusion: true/false`), not a per-move attribution of how much of that move's residual is fusion-specific. Sufficient for the stated goal (characterize how large and how frequent the blind spot is) without requiring a per-move decomposition that would need the very conditional re-solve this whole line of work avoids.

## Migration Plan

None - this is new, additive, offline dev tooling with no runtime code path and no persisted state. Nothing to roll back beyond deleting the new files.

## Open Questions

None - Part 1/Part 2 scope, bucketing, bias metric, and move-selection policy were all resolved during exploration rather than left open.
