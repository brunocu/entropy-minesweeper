## Context

See proposal.md - Why. Two independent bugs currently share one root cause: `GameController.reveal`/`toggleFlag` (`src/game/gameController.ts:30-40`) unconditionally re-solve and call `recordMove()`, and `frontierSolver.ts` treats `cell.flagged` as a forced mine, so a flag toggle is real solver work today, not a no-op. `Board.reveal`/`Board.toggleFlag` (`src/board/board.ts:107-158`) already know when they're a no-op (game over, already revealed, already flagged) but currently return `void`, discarding that information before it reaches the controller.

## Goals / Non-Goals

**Goals:**
- `moveIndex` (and the uncertainty chart) advances only for a reveal that actually changes board state.
- Flags carry zero solver influence — a flagged cell solves exactly like any unrevealed cell.
- Avoid duplicating `Board`'s no-op guard logic in `GameController`.

**Non-Goals:**
- No change to `Board`'s own reveal/flag rules (a flagged cell still blocks reveal; flagging a revealed cell still no-ops) — only how that outcome is *reported* to the controller.
- No change to the flag glyph/UI rendering path itself, beyond it no longer being solver-driven.
- Not addressing `minesweeper-board` spec wording — its existing "unflagged" reveal preconditions already describe this behavior correctly and don't reference the solver.

## Decisions

**`Board.reveal`/`Board.toggleFlag` return `boolean`.**
Each method already contains the authoritative guard (`board.ts:110`, `board.ts:156`). Returning whether it mutated state lets `GameController` gate `recordMove()` without re-deriving `cell.flagged || cell.revealed` (or the game-over check) itself, which would drift out of sync with `Board`'s own rules over time. Alternative considered: have `GameController` inspect cell state before/after calling `Board` — rejected as duplicate logic and fragile (diffing state is more code than returning a bool the callee already has).

**`GameController.toggleFlag` drops the solver call and `recordMove()` entirely, not just the move-index increment.**
Once flags don't affect `solve()`'s output, re-running it after a flag toggle is guaranteed to reproduce the same `latestSolve` — a wasted pass. Since nothing changes, there's also nothing meaningful to append to `uncertaintyHistory`, so there's no "record without incrementing" case to design for. Alternative considered: still solve and record but reuse the previous `moveIndex` — rejected as needless complexity for a value that would always be identical.

**`frontierSolver.ts` removes `flagged` as a solver concept rather than special-casing it as "unrevealed."**
`SolverCell.flagged` currently seeds `forcedMine` and short-circuits component enumeration. Deleting the field (rather than keeping it and forcing it to `false`) removes an entire disused signal path and matches the proposal's framing: flags are UI-only, so the solver's cell model shouldn't carry the concept at all.

## Risks / Trade-offs

- [Existing tests assert the old behavior] → `gameController.test.ts` (flag-toggle move-index sequence) and `frontierSolver.test.ts` (flagged `'F'` fixture cases) must be rewritten as part of this change, not left to fail; tracked in tasks.md.
- [Silent behavior change for players who used flags as a "mark as certain" solver trick] → Intentional per proposal (**BREAKING**); flags become a pure personal bookmark. No migration needed — this is client-side session state, not persisted/exported data.
