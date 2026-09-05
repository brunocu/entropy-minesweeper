## Context

See proposal.md - Why. Relevant current state:

- `solve()` in `src/solver/frontierSolver.ts` already enumerates, per combination of frontier-component assignments and non-frontier mine-count split, a `weight = binomial(K, remaining)` and accumulates `Z = sum(weight)` (the normalizing constant used to turn weights into probabilities). `Z` is computed but never exposed on `SolveResult`.
- `GameController` (`src/game/gameController.ts`) re-runs `solve()` synchronously after every `reveal`/`toggleFlag` and stores only the latest result (`latestSolve`); there is no history and no move counter anywhere in the codebase.
- `main.ts` builds the UI imperatively with `document.createElement`, no framework. The only existing visualization is a hand-rolled Canvas2D heatmap in `src/render/boardRenderer.ts`.
- The project currently has zero runtime dependencies (`package.json` lists only `vite`/`vitest`/`typescript` as devDependencies).

## Goals / Non-Goals

**Goals:**
- Expose the already-computed `Z` as `totalEntropyBits = log2(Z)` on `SolveResult`, at no additional enumeration cost.
- Track `(moveIndex, totalEntropyBits)` history for the current game session only, reset on new game.
- Render that history as a live-updating line chart using `uplot`.

**Non-Goals:**
- Persisting history across page reloads or between games.
- Including history in the "Copy state" export.
- Supporting a wall-clock-time x-axis (move index only, per proposal).
- Reworking `main.ts`'s imperative DOM style into a framework — the chart panel follows the existing pattern.

## Decisions

**Compute `totalEntropyBits` as `Math.log2(Z)` inside `solve()`.** `Z` is the total weighted count of full-board configurations consistent with all constraints, already summed at frontierSolver.ts:461-476. Because frontier components share the global `remainingMines` budget, they are not independent, so summing per-component entropies would be wrong; `log2(Z)` is correct by construction since it's computed over the already-coupled combination, with no independence assumption. Alternative considered: sum `shannonEntropy` per component plus non-frontier `n·H(p)` — rejected as mathematically incorrect per the investigation (overstates/misstates uncertainty when components are coupled through the shared mine budget).

**Track history in `GameController`, not in `Board` or `main.ts`.** `GameController` already owns the reveal/flag mutation points and the `latestSolve` snapshot, making it the natural single place to append a new `(moveIndex, totalEntropyBits)` sample after each mutation and to clear history when a new game starts. Alternative considered: track history in `main.ts` by observing controller output — rejected because it would duplicate the "what counts as a move" logic that `GameController` already owns.

**Use `uplot` for rendering.** Zero further dependencies, ~15KB min+gzip, MIT-licensed, Canvas-based, and sized for exactly this case (a single growing time-series line with an integer x-axis). Alternatives considered: hand-rolled SVG/Canvas (rejected per user decision — more code for an equivalent result once a suitable zero-dependency library exists) and heavier libraries (`chart.js`, `lightweight-charts`) (rejected as unnecessarily large for a single-line chart with no additional feature requirements).

**New module `src/render/uncertaintyChart.ts`.** Wraps `uplot` construction and `setData` updates behind a small interface (e.g. `create(container)`, `update(history)`, `reset()`), mirroring how `src/render/boardRenderer.ts` and `src/render/probabilityColor.ts` separate rendering concerns from `main.ts`'s orchestration.

## Risks / Trade-offs

- [Adding the project's first runtime dependency] -> Mitigated by `uplot`'s small size (~15KB), zero further transitive dependencies, and permissive MIT license; the alternative (hand-rolling) was explicitly declined by the user as more code for the same result.
- [`totalEntropyBits` could be large/small in ways that make default chart scaling awkward, e.g. a huge initial value on large boards dwarfing later small values] -> Not addressed by this change; `uplot`'s default linear auto-scaling is used, and log-scale or normalization can be revisited later if it proves confusing in practice.
- [Move index counts both reveals and flag toggles, which don't always change board information the same way a reveal does] -> Matches the proposal's explicit definition. Flagging does constrain the solver (a flagged frontier cell is forced-mine during enumeration, and a flagged non-frontier cell reduces `remainingMines`), so a flag toggle can change `totalEntropyBits` just like a reveal can - the chart will show a step whenever a toggle actually narrows the consistent-configuration count, and a flat segment when it doesn't (e.g. re-flagging a cell already forced-mine by deduction).
