## Why

Explaining a frontier cell's certainty currently requires leaving the app: copy the state-export JSON, paste it into an LLM chat, and ask why. For the common case — "why is this cell definitely safe/a mine?" — that round trip is slower and less immediate than the game itself, and it depends on an external LLM session the player may not have open. The solver already computes exact probabilities; the reasoning behind a p=0/p=1 result is derivable from a small, well-defined subset of the board without any external call.

## What Changes

- On hovering an unrevealed frontier cell whose mine probability is exactly 0 or exactly 1 (Bernoulli entropy H(p)=0), the board highlights the minimal set of cells that together justify that certainty.
- The explanation set is computed as a minimal sufficient subset of the hovered cell's frontier-component constraints (revealed numbered cells) — plus any unrevealed cells within that subset whose own forced mine/safe status is relied on as a premise (e.g., a neighbor already known to be a mine that satisfies a clue's count), without recursively re-explaining those premise cells' own certainty.
- Explanation sets for every certain frontier cell are computed once per solve (immediately after the existing probability/EIG pass, on every reveal), not recomputed per hover — hovering is a lookup into an already-computed result, not a fresh search.
- A flagged unrevealed cell may be surfaced as a premise "for free" (without pulling its own justifying clues into the explanation) when — and only when — it is *also* independently, globally forced mine/safe by the real deduction over its full frontier component. The flag is a filter on which already-true facts to admit as a given, never a substitute source of truth: the solver's probability/EIG computation and the definition of "certain" remain entirely flag-blind, consistent with flags having been removed from the underlying solver data model. Explanation sets are additionally recomputed on flag toggle (not just on reveal), since flag state is now a genuine input to which premises can be treated as given.
- Scoped to frontier cells only, consistent with the existing solver's frontier/non-frontier split; non-frontier certainty (which stems from global mine-count coupling across all components) is out of scope for this change.
- This is an additive, in-app alternative to the state-export → LLM explanation flow, not a replacement — `Copy state`, the chess-label export, and the `/minesweeper-state` skill are unchanged and remain the path for broader or free-form questions about the board.

## Capabilities

### New Capabilities
(none — this extends existing capabilities)

### Modified Capabilities
- `frontier-solver`: adds a computation, run once per solve alongside the existing probability/EIG pass, of a minimal sufficient subset of frontier-component constraints (and any relied-upon forced-cell premises within that subset) that reproduces the certainty of every frontier cell whose reported probability is exactly 0 or 1. Also adds an optional flagged-cell input so a globally-forced, flagged premise can be admitted as a given without its own justifying clues being pulled into the explanation.
- `information-visualization`: adds a hover behavior that highlights this minimal explanation set on the board when the hovered cell is an unrevealed frontier cell with mine probability exactly 0 or exactly 1.

## Impact

- `src/solver/frontierSolver.ts`: new exported function, run once per `solve()` call, that computes the minimal explanation set for every certain frontier cell (reuses existing constraint-building, component partitioning, and backtracking/trivial-deduction machinery — no new inference logic; see design.md for the search strategy). Also computes, per component, the real (untrimmed) forced-mine/forced-safe set already produced internally by `enumerateComponent`'s fixpoint, so it can be intersected with flagged cells rather than discarded.
- `src/render/boardRenderer.ts`: new rendering support for a highlighted-cell set, distinguishing clue cells from premise cells (exact visual treatment deferred to design.md).
- `src/main.ts`: hover handler extended to look up the precomputed explanation set (no computation at hover time) and pass it to the renderer when the hovered cell qualifies.
- `src/game/gameController.ts`: `toggleFlag()` now recomputes `latestExplanations` (reusing the existing `latestSolve`, no new `solveFn` call) since flag state affects which premises can be admitted as given; it still never calls `solveFn` and never advances `uncertaintyHistory`/`moveIndex` (flag toggles remain excluded from the uncertainty chart).
- No changes to `src/export/stateExport.ts` or the `/minesweeper-state` skill.
