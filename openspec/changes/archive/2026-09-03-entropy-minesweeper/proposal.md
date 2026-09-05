## Why

Minesweeper's constraint structure is an unusually clean, tangible way to see Shannon information theory in action: every unopened cell has a real probability, every probability has a real entropy, and every click is a real experiment whose predicted information gain can be compared against what it actually delivers. This change builds an interactive minesweeper web app whose primary purpose is to make that machinery visible, as a personal exploration of what "information" means in an intuitive setting rather than an abstract one.

## What Changes

- New playable minesweeper board (standard rules, first-click-safe) rendered as a single interactive web app.
- New exact probabilistic solver over the board's "frontier" (unopened cells adjacent to a revealed number):
  - Tier 0 trivial deduction (fully-satisfied/fully-mined numbers resolve their neighbors with certainty).
  - Tier 2 exact joint enumeration: frontier split into independent connected components, each enumerated by backtracking, combined across components and weighted by the global remaining-mine count to produce exact per-cell mine probabilities — including a correct, non-uniform-over-time probability for non-frontier cells (uniform among themselves at any instant, shifting as frontier deductions consume/free mines).
  - No Tier 1 (naive independent-constraint) approximation shipped as a mode.
- New entropy heatmap overlay covering every unopened cell (frontier and non-frontier), colored by `H(p) = -p*log2(p) - (1-p)*log2(1-p)`.
- New expected-information-gain (EIG) readout for frontier cells only: `EIG(x) = H(W) - E[H(W | outcome)]`, i.e. mutual information between a cell's click outcome and the enumerated-worlds distribution `W`. Non-frontier cells are excluded from EIG (clicking one can flood-fill cascade, which does not have a single well-defined "outcome" in scope for this change).
- New predicted-vs-realized information display on click: before resolving, show the predicted EIG; after resolving, show the realized surprisal of the actual outcome, `-log2 P(outcome)`. Both numbers derive from the same enumerated-worlds object the solver already computes, no separate calculation path.
- Explicitly out of scope: a "possible worlds" swarm/superposition visualization (rejected as visually noisy); rigorous EIG for non-frontier cells; any naive/Tier-1 probability mode.

## Capabilities

### New Capabilities
- `minesweeper-board`: Core game engine — board generation, first-click-safe guarantee, cell reveal (including flood-fill for zero-adjacency cells), flagging, win/loss detection.
- `frontier-solver`: Exact probabilistic inference over the board state — Tier 0 deduction, frontier component decomposition, joint world enumeration, global mine-count-weighted per-cell probability, and world-derived expected information gain per frontier cell.
- `information-visualization`: UI layer translating solver output into the entropy heatmap (all unopened cells) and the EIG / predicted-vs-realized bits display (frontier cells, on click).

### Modified Capabilities
- None — greenfield project, no existing specs.

## Impact

- New web app codebase (framework/stack to be settled in design.md); no existing code or specs are affected since the repository currently contains only OpenSpec scaffolding.
- No external dependencies or systems beyond what the chosen web stack requires (to be resolved in design.md).
