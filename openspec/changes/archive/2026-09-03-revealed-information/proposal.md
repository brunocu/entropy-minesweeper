## Why

A reveal that cascades (flood-fills through zero cells) currently reports realized surprisal for only the clicked cell, ignoring every other cell the cascade opened — understating what the player actually learned. Separately, "surprisal" (`-log2 P(outcome)`) and "information revealed" (entropy reduction about the mine field) are, in this solver's uniform-prior/deterministic-reveal model, provably the same quantity, so keeping both as distinct concepts was misleading. That same identity gives a cheap, exact, cascade-aware fix: the difference between the board's total joint uncertainty before and after the reveal settles, which already accounts for every cell a cascade opens with no new enumeration machinery.

## What Changes

- Replace the single-cell realized-surprisal computation with a realized "revealed information" value computed as `preRevealSolve.totalEntropyBits - postRevealSolve.totalEntropyBits`, evaluated after any reveal (including a cascade) fully settles.
- **BREAKING**: Rename the reported/displayed concept from "realized surprisal" to "revealed information" everywhere it's computed or shown.
- Revealed information is now computed and displayed for every reveal, not only frontier-cell reveals — a non-frontier or cascading reveal now shows a revealed-information value even when there is no predicted EIG to pair it with.
- Predicted EIG stays exactly as-is: single-cell, frontier-only, unchanged in scope or computation.
- Remove `realizedSurprisal` (`src/solver/frontierSolver.ts`) and the frontier-only branch in `computeRevealFeedback` (`src/game/revealFeedback.ts`) that returned `null` for non-frontier clicks, along with any tests exercising only that removed path.

## Capabilities

### Modified Capabilities
- `frontier-solver`: the "Realized Surprisal on Resolution" requirement is replaced by a "Revealed Information on Resolution" requirement, redefining the computation as a before/after total-joint-uncertainty difference and extending it to every reveal (frontier or non-frontier, cascading or not), not only frontier-cell outcomes.
- `information-visualization`: the "Predicted-vs-Realized Information Display" requirement changes so realized information is displayed for every reveal (previously gated to frontier reveals with a predicted EIG), while predicted EIG display stays gated to frontier reveals as before.

## Impact

- `src/solver/frontierSolver.ts`: remove `realizedSurprisal`; the replacement is computed by the caller as a difference of two `SolveResult.totalEntropyBits` values (no new solver export required).
- `src/game/revealFeedback.ts`: `computeRevealFeedback` (or its replacement) no longer returns `null` for a non-frontier reveal; it always reports revealed information, and reports predicted EIG only when the clicked cell was on the frontier.
- `src/main.ts`: reveal handler must resolve the post-cascade board state before computing the post-reveal solve, and update the readout text/formatting to the new "revealed information" label and its now-unconditional display.
- Existing tests in `src/game/revealFeedback.test.ts` and `src/solver/frontierSolver.test.ts`/`frontierSolver.spec.test.ts` covering `realizedSurprisal` need updating or removal.
