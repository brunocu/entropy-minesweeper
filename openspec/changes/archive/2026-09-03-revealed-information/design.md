## Context

See proposal.md - Why. Two existing pieces of machinery matter here:

- `SolveResult.totalEntropyBits` (`src/solver/frontierSolver.ts`) is already `log2(Z)`, where `Z` is the total count of full-board mine configurations consistent with all currently revealed numbers — a genuinely global, whole-board quantity, not a per-cell or per-frontier-component one.
- `realizedSurprisal(result, outcome)` looks up a single frontier cell's outcome probability from the pre-reveal solve and returns `-log2 P(outcome)`, evaluated only for the clicked cell.

Because the solver assumes a uniform prior over consistent mine configurations and reveals are deterministic given the true configuration (no noise beyond "which configuration is true"), conditioning that uniform prior on an observed outcome yields a uniform posterior over the surviving configurations. That makes `-log2 P(outcome) == H(before) - H(after)` an exact identity in this system, for any outcome — single cell or whole cascade — not an approximation. `H(after)` is just `totalEntropyBits` computed on the board state once the outcome (and any cascade it triggers) has been applied.

## Goals / Non-Goals

**Goals:**
- Compute realized information for a whole reveal (cascade included) as `totalEntropyBits` before minus `totalEntropyBits` after, using two `solve()` calls rather than any joint-outcome enumeration.
- Make the realized value available for every reveal, not gated on the clicked cell being on the frontier.
- Remove the now-superseded single-cell `realizedSurprisal` path and its dedicated tests.

**Non-Goals:**
- Making predicted EIG cascade-aware. It stays single-cell and frontier-only, unchanged from today.
- Changing `totalEntropyBits`'s own definition or the "Total Joint Uncertainty" requirement — it's reused as-is.
- Any new solver-level enumeration of joint cascade outcomes; the before/after diff makes that unnecessary.

## Decisions

**Compute realized information as a before/after `totalEntropyBits` diff, at the call site, after the reveal (including its cascade) settles.**
Alternative considered: extend `computeFrontierCellResult`-style outcome grouping to a joint distribution over the whole cascade pattern (chain rule across cascade cells, or single-shot joint-combo enumeration). Rejected: it requires giving non-frontier cells (most cascade-interior cells) an outcome-probability distribution they don't have today, and is strictly more expensive than two `solve()` calls for a quantity that's provably identical to the diff approach in this domain (see Context).

**Drop `realizedSurprisal` entirely rather than keeping it alongside the new value.**
The proposal's decision 1 already settled that "surprisal" and "revealed information" are the same number here, so keeping both would either show a duplicate or require maintaining two code paths that must always agree. `computeRevealFeedback` (or its replacement) becomes the single place that computes the realized value, from two `SolveResult`s rather than one `FrontierCellResult` and an outcome.

**Realized information no longer requires a frontier-cell lookup, so `computeRevealFeedback` stops returning `null` for non-frontier reveals.**
Predicted EIG remains `null`/absent for non-frontier reveals (there is no frontier `FrontierCellResult` to read an EIG from), but the realized-information half of the return value is now always computable, since it only needs the pre- and post-reveal `SolveResult`s.

**The call site (`src/main.ts`) must obtain the post-reveal `SolveResult` only after any cascade has fully settled.**
`controller.reveal()` already runs `floodReveal` synchronously to completion before returning, so the existing "reveal, then re-solve" sequencing already satisfies this — no new synchronization is needed, just re-solving on the post-reveal board (whatever `main.ts` already does to get `controller.latestSolve` updated) before computing the diff.

## Risks / Trade-offs

- **Extra `solve()` call per reveal** → the call site already re-solves after every reveal to update the heatmap and hover readouts; this change requires capturing that post-reveal `SolveResult` for the diff rather than only using it for rendering. No net-new solve is added beyond what's already computed for display.
- **Losing the single-cell surprisal number some players may have found useful as a distinct "how rare was this number" readout** → per the proposal's resolved discussion, it's mathematically identical to revealed information in this domain, so nothing is actually lost, only relabeled and generalized to cascades.
