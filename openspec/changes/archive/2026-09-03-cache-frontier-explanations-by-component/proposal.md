## Why

On Expert boards (30x16, 99 mines), revealing or flagging a cell can hang the UI for a couple of seconds. `GameController` recomputes `computeExplanations` from scratch on every `reveal()` and `toggleFlag()`, and that function re-enumerates every frontier component's exact world assignments (exponential backtracking) even when a component's constraints haven't changed since the last call - which is the common case for `toggleFlag()` on a cell not in the frontier, and for the parts of the frontier untouched by a `reveal()`. It also independently re-enumerates the same components `solve()` just enumerated a moment earlier, duplicating the most expensive work of the pass.

## What Changes

- Cache frontier-component explanation results in `GameController`, keyed by a canonical signature of each component's own constraint structure (clue cells, required-mine counts, member cells) plus the flagged subset of its cells. A component whose signature matches a prior call reuses its cached explanations verbatim instead of re-enumerating.
- `toggleFlag()` on a cell outside the frontier becomes a full cache hit (no enumeration at all); `toggleFlag()` on a frontier cell only re-enumerates the one component containing it. `reveal()` only re-enumerates the component(s) whose constraints actually changed.
- Eliminate the duplicate world enumeration between `solve()` and `computeExplanations()`: both currently run `enumerateComponent`/`enumerateComponentFull` over the same per-component cell sets independently within a single `reveal()`. Thread the shared enumeration result through instead of computing it twice.
- Output is unchanged: `computeExplanations` must still return the same explanation set for the same board state as it does today (see `frontier-solver`'s "Explanation is deterministic for a fixed board state" and "Minimal Certainty Explanation" requirements) - this is a performance change, not a behavior change.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
(none - output behavior is unchanged; only the internal computation strategy changes)

## Impact

- `src/solver/frontierSolver.ts`: `computeExplanations` gains a cache parameter/return value and a component-signature helper; `computeBaseSolve`/`solve` and `computeExplanations` share one enumeration per component instead of two.
- `src/game/gameController.ts`: `GameController` owns and threads the explanation cache across `reveal()` and `toggleFlag()` calls alongside `latestExplanations`.
- No changes to `src/main.ts` or any consumer-facing API - `latestExplanations`'s shape and contents are unchanged.
- Existing solver/gameController test suites continue to assert on output, not internals, and should pass unmodified; new tests will cover cache-hit/cache-miss behavior directly.
