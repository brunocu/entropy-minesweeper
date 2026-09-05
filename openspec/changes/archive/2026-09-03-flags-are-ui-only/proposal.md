## Why

Flags currently double as solver input: the frontier solver treats a flagged cell as a confirmed mine, which lets flagging change entropy/probabilities for other cells and (via that recompute) advance the move-index chart with a point that doesn't correspond to any revealed information. This conflates two different actions — "the player revealed a cell" vs. "the player left themselves a note" — under a single move counter, and lets a purely cosmetic action (or a no-op click on an already-revealed cell) masquerade as game progress on the uncertainty chart.

## What Changes

- **BREAKING**: Flags no longer influence the frontier solver. A flagged cell is solved exactly like any other unrevealed, unflagged cell — flagging becomes a pure UI bookmark with zero effect on probability, expected information gain, or total entropy.
- `GameController.toggleFlag` no longer re-runs the solver or records a move — since flags no longer change solver output, there is nothing new to record.
- `GameController.reveal` only records a move (advances `moveIndex`, appends an uncertainty-chart point) when the reveal actually changed board state. Clicking an already-revealed (or flagged, or post-game-over) cell is a true no-op: no re-solve, no chart point.
- `Board.reveal` / `Board.toggleFlag` report whether they mutated state, so `GameController` can distinguish a real move from a no-op without re-deriving the board's own guard conditions.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `frontier-solver`: The certainty-resolution requirement drops "or flagged" — a numbered cell's mine count is satisfied only by known (deduced/enumerated) mines, never by flags. Flagged cells are no longer distinguished from other unrevealed cells anywhere in the solve.
- `information-visualization`: Move index SHALL increment only for a reveal that actually changes board state. A flag toggle (in either direction) SHALL NOT advance move index or add a chart point. Redundant reveals (already-revealed, flagged, or post-game-over cells) SHALL NOT advance move index either.

## Impact

- `src/solver/frontierSolver.ts`: remove `SolverCell.flagged` and its uses (forced-mine seeding, the fixed-mine shortcut in component enumeration).
- `src/board/board.ts`: `reveal()`/`toggleFlag()` return a boolean indicating whether they mutated state.
- `src/game/gameController.ts`: `reveal()` gates `recordMove()` on that boolean; `toggleFlag()` drops the solver call and `recordMove()` entirely.
- `src/solver/frontierSolver.test.ts`: flagged (`'F'`) fixture cases must be rewritten to behave like unrevealed (`'?'`) cells.
- `src/game/gameController.test.ts`: the existing test asserting that two flag toggles advance `moveIndex` sequentially is now wrong and must be rewritten; add coverage for a no-op reveal on an already-revealed cell not advancing `moveIndex`.
- No change to `src/main.ts` UI wiring — flag toggles still redraw (to show the flag glyph), they just no longer trigger a solve or chart update.
