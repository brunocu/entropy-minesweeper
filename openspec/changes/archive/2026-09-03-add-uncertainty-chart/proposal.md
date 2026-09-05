## Why

The board already shows per-cell mine probability and expected information gain, but nothing shows how the game's overall uncertainty evolves as the player uncovers cells. A live chart of total board uncertainty vs. move index gives the player (and anyone studying the solver's behavior) direct visibility into how much information each move actually removed from the game.

## What Changes

- Frontier solver exposes a new, information-theoretically correct scalar: the joint Shannon entropy (in bits) of the full space of mine configurations consistent with the current board state, computed as `log2(Z)` where `Z` is the total count of consistent configurations already enumerated internally by `solve()`.
- Game controller records this value against a move index (0 at game start, incrementing on each reveal or flag toggle) for the duration of the current game session.
- A new line-chart panel, built with the `uplot` library, renders total uncertainty (bits) on the y-axis against move index on the x-axis, updating live as the player plays.
- The chart is a purely client-side, in-session visualization: it is not persisted, not included in the "Copy state" export, and resets whenever a new game starts.
- Adds `uplot` as the project's first runtime dependency.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `frontier-solver`: adds a requirement that `solve()` report the total joint Shannon entropy, in bits, of the full unrevealed-configuration space.
- `information-visualization`: adds a requirement for a live uncertainty-vs-move-index chart that tracks and renders this value across the current game session, resetting on new game.

## Impact

- `src/solver/frontierSolver.ts`: expose `Z`'s log2 as a new field on `SolveResult`.
- `src/game/gameController.ts`: record `(moveIndex, totalEntropyBits)` history, reset on new game.
- `src/main.ts`: mount a new chart panel/canvas element and wire it to controller updates.
- New module (e.g. `src/render/uncertaintyChart.ts`): wraps `uplot` to render/update the chart.
- `package.json`: add `uplot` as a runtime dependency (first one in the project).
- No change to `src/export/stateExport.ts` — history stays out of the exported snapshot.
