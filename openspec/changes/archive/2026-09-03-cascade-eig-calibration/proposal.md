## Status: harness removed after use (2026-09-03)

This calibration harness did its job: its Part 1 and Part 2 measurements are what justified
reverting `cascade-aware-eig` (see that change's archived `proposal.md`/`design.md` for the full
finding - Part 2's mean-absolute-error comparison, extended with a baseline-vs-cascade-aware
field, showed the cascade term made real-play prediction error worse, not better). With
`cascade-aware-eig` reverted, the harness code (`src/solver/cascadeCalibration.ts`,
`cascadeGroundTruth.ts`, `cascadePart2.ts`, `cascadeCalibrationReport.ts`, `biasStats.ts`, and
their tests) was removed, since it directly imported that feature's now-deleted internals and had
nothing left to calibrate. This change's docs are kept, archived, for the record of the
methodology and findings.

## Why

`cascade-aware-eig` shipped a mean-field/independence-assumption estimate for a cell's cascade contribution to EIG, with a design doc that explicitly named the estimate as biased toward overestimation and deferred quantifying that bias until real predicted-vs-realized numbers came in from actual play. Those numbers are in: live play consistently shows the predicted EIG readout overestimating the realized `revealedInformation`, matching the design doc's theoretical prediction. This change builds the offline calibration harness the design doc deferred, to turn "consistent overestimate" into a quantitative, reproducible measurement the team can act on.

## What Changes

- Add an offline, two-part Monte Carlo calibration harness (dev-only tooling; not shipped to the app):
  - **Part 1 — isolated estimator calibration**: for each real board preset's mine density (Beginner/Intermediate/Expert), and for each boundary-distance bucket (interior / edge-adjacent / corner-adjacent unrevealed-neighbor counts), compare the `(q, d)`-based `expectedCascadeInfo` formula's prediction against an exact combinatorial ground-truth entropy computed on the same bounded local region. Reports both raw mean bias (`predicted - actual`) and geometric-mean ratio bias (`predicted / actual`) per bucket.
  - **Part 2 — fusion-blind-spot tracking over a real game**: for each preset, generate a seeded random board and drive a full solver-guided playthrough (each move picks the cell with the highest predicted EIG, mirroring real assisted play), snapshotting predicted vs. realized information at every move via the existing `computeRevealFeedback` machinery. Classify each reveal as fusion-occurred or not (did the cascade merge two previously-separate frontier components?) and report bias curves over revealed-fraction, split by that classification.
- No changes to `frontierSolver.ts`'s shipped EIG computation, `revealFeedback.ts`, or any other runtime/gameplay code. This is a standalone offline analysis added purely to measure the existing estimator; it produces numbers for a human to look at, not a runtime behavior change.
- Deliberately excludes any synthetic density points outside the three real presets, and excludes a bias-correction mechanism — this change measures, it does not correct.

## Capabilities

No new or modified capabilities. This change adds offline dev tooling (a Monte Carlo calibration script/test suite) with no spec-level behavior change to any shipped capability — nothing a player or the app's runtime behavior observes differs before and after. `skip_specs: true` is set in `.openspec.yaml` accordingly.

## Impact

- New code only, additive: a calibration harness living alongside existing solver tests/tooling (e.g. under `src/solver/`, following the seeded-RNG/`SolverBoard`-snapshot pattern already established in `src/solver/cachePerformance.test.ts`).
- Reads (does not modify) `src/solver/frontierSolver.ts`'s exported `computeFrontierCellResult`/`solve` and `src/game/revealFeedback.ts`'s `computeRevealFeedback`.
- Output is a report (console/file) of bias statistics for human review; no UI, persistence, or app-facing change.
- Follow-up decision (out of scope for this change): once bias magnitudes are known, decide whether to leave the estimator as-is, add a density-dependent correction, adjust BFS pruning, or expose the cascade term separately in the UI (Open Question already on record in `cascade-aware-eig`'s design.md).
