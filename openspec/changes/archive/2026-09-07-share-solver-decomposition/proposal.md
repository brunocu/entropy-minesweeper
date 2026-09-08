## Why

The same work is done twice, or once per frame, in five places. Most costly: `GameController` calls `solve` and then `computeExplanations` on the same board every move, and each independently runs the entire board-decomposition phase — `identifyFrontier`, `buildConstraints`, `computeComponents`, and then per component a cell set, a `constraints.filter(...)` scan, and a signature build. That filter is O(components x constraints x cells-per-constraint), paid twice per move. This is the same shape as the archived `reduce-explanation-setup-overhead` change, one level up the stack: there the per-certain-cell setup was rebuilt per cell; here the whole decomposition is rebuilt per consumer.

## What Changes

- **Shared decomposition (1a).** Introduce a `Decomposition` value — frontier coords/keys/set, constraints, components, and the per-component relevant-constraint slices — computed once from a board and consumed by both `solve` and `computeExplanations`. `GameController.toggleFlag` calls `computeExplanations` alone, so the decomposition cannot simply fold into `solve`; it becomes a value both take. It lives in `decomposition.ts`.
- **Frontier index on `SolveResult` (1e).** `SolveResult` gains a readonly keyed index of its frontier entries, built once where the frontier is built. This replaces seven hand-written `frontier.find(f => f.row === r && f.col === c)` linear scans (`main.ts`, `revealFeedback.ts` x2, `worldsTree.ts`, `predictedVsRealized.ts`, `revealDemo.ts`, `compileExplainer.ts`) and three hand-built probability/EIG map pairs (`main.ts`, `revealDemo.ts`, `boardSvg.ts`). Carrying a derived index on a result record is the codebase's existing convention — `WorldEnumeration` carries `frontierKeys`/`frontierSet`, and `ComponentIndex` is nothing but build-once lookup maps.
- **Single enumeration in `buildTree` (1b).** `worldsTree.ts:buildTree` calls `enumerateWeightedWorlds(board)` and `solve(board, new Map())` back to back — two full world enumerations of the same board — and uses the second only to read one frontier cell's probability. Derive that from the enumeration already in hand.
- **One solve per explainer fixture (1c).** `WORLDS_TREE_BOARD` is solved by five separate call sites during the explainer build and `CERTAINTY_BOARD` by two, each with its own `new Map()` cache. Thread one solve per fixture through the illustration pipeline. The argument here is coherence, not speed: seven independent solves of two fixed boards are seven chances to drift.
- **Guard the redraws in `main.ts` (1d).** `draw()` runs on every `mousemove` and repaints everything: the board canvas, and — via `uncertaintyChart.update` — a full uPlot `setData` and chart repaint, even though the history it plots only changes once per reveal. Moving the pointer across a single cell fires dozens of pixel-identical redraws. Add invalidation guards so `draw()` runs when something actually changed: skip when the pointer stays in the same cell, when a reveal was rejected (`changed === false`), when a right-click hit no cell or toggled nothing, and when `mouseleave` clears a highlight that was already null. Gate the chart update on the history having changed rather than calling it per draw.
- **`GameController.toggleFlag` reports whether it changed anything.** It currently returns `void` while `Board.toggleFlag` returns a boolean saying whether the flag moved. Propagating that is what lets the right-click handler skip a redraw for a no-op toggle.
- **One `toRenderBoard` (thread 4).** `main.ts` and `explainer/revealDemo.ts` hold near-identical `SolveResult` + board -> `RenderBoard` conversions differing only in revealed-cell handling; `boardSvg.ts` builds the same lookup maps a third time on its way to SVG. Consolidate the shared conversion.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. Every output value is unchanged — this removes duplicate paths to the same answers and adds a derived index over data already returned. No requirement under `openspec/specs/` changes. This change sets `skip_specs: true`.

## Impact

- **`SolveResult` gains a field**, so every construction site updates. Consumers that only read `frontier` keep working.
- **`solve` and `computeExplanations` change signature** to accept a shared decomposition. Their ~10 call sites across `game/`, `explainer/`, and tests update. Several explainer call sites currently pass `new Map()` as a throwaway cache and will pass a fresh decomposition the same way.
- **Correctness constraint to preserve:** `frontier-solver` spec requires that "flagged and unflagged cells with identical board state solve identically". The decomposition is shared between a flag-unaware `solve` and a flag-aware `computeExplanations`, so flag state must stay strictly outside the decomposition — it belongs only in the per-component signature and the flag givens. Getting this wrong is the main way this change could break behavior, and design.md addresses it.
- **Depends on `split-solver-modules`** having landed, so the decomposition has a module to live in rather than being added to the monolith and moved immediately after.
- **`GameController.toggleFlag` changes signature** from `void` to `boolean`, matching `Board.toggleFlag`. One production caller (`main.ts`'s `contextmenu` handler) and the controller's own tests.
- **Verification:** existing solver tests pin the outputs; the `cachePerformance` and `bottleneckProfile` call-counter tests pin that the work actually stops happening twice.
- **Manual verification required.** The redraw guards are the one part of this change no test in this repo covers — a missed guard shows as a stale screen, not a failing assertion, and this project has no headless browser. Before this change is considered done, someone must check in a real browser: hovering across cells updates the readout and highlight; hovering within one cell does not flicker; clicking a flagged cell leaves the screen unchanged; flagging and unflagging updates the mines-left count; mousing off the board clears the highlight; the uncertainty chart still advances on each reveal and resets on a new game.
