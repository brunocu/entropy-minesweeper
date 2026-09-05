## Context

Greenfield repository — no existing code, stack, or specs to integrate with. See proposal.md for motivation and scope (Tier 0 + Tier 2 exact solver, entropy heatmap over all unopened cells, EIG + predicted-vs-realized bits for frontier cells only, no possible-worlds view, no Tier 1 mode). This document picks the stack and architecture needed to build that scope as a single-player, client-side interactive web app.

## Goals / Non-Goals

**Goals:**
- Pick a stack simple enough that the solver's math stays the readable, central part of the codebase, not buried under framework ceremony.
- Keep solver computation exact (per proposal) while keeping the UI responsive even on frontier states that are combinatorially larger than typical.
- Define the data flow from "board state" to "enumerated worlds" to "heatmap colors / EIG numbers" as one clear pipeline, since it's re-run after every reveal.

**Non-Goals:**
- No backend/server, no multiplayer, no accounts, no persistence beyond (optionally) local browser storage for board-size preference.
- No mobile-native build; responsive desktop-first browser app is sufficient.
- No solver generality beyond minesweeper's specific constraint shape (i.e., not building a general CSP/#SAT library).

## Decisions

**1. Client-only single-page app, TypeScript, no backend.**
The entire feature — board, solver, visualization — is self-contained, stateless across sessions, and computationally light enough (bounded frontier sizes) to run entirely in-browser. A backend would add deployment/hosting surface for zero benefit here. TypeScript over plain JS for the solver code specifically: the enumerated-worlds data model (components, assignments, weights) benefits from static typing to keep the probability math from silently going wrong.

**2. Rendering: Canvas grid, not a DOM-per-cell or heavyweight framework.**
Plain Canvas2D: one surface, draw loop redraws cell fills from a `Float64[]` of per-cell H(p) values, negligible overhead even at expert board size (30x16). Click hit-testing is simple grid-coordinate math, no framework needed. No reactive framework is pulled in; a small hand-rolled render-on-state-change loop is enough for this scope.

Alternatives considered, evaluated specifically against "grid of ~500 cells, per-cell continuous-color fill recomputed every move, simple coordinate-math hit-testing, small numeric text overlays, minor click-resolve transitions":
- **React with a `<div>`/`<svg>` per cell**: easy event handling, but 400-900+ reactive DOM nodes for larger boards, and re-render churn on every solver pass is wasteful for something that's fundamentally a pixel grid with a color function.
- **PixiJS** (WebGL-based, ~120 KB gzipped, actively maintained, first-party TS types): built for many moving/animated sprites (games); a static/rarely-animated grid doesn't exercise its strengths, and the WebGL layer adds weight and indirection for no payoff here.
- **Konva.js** (canvas scene graph, ~55 KB gzipped, actively maintained, first-party TS types): built-in per-shape hit-testing is the main draw, but a regular grid's hit-testing is already trivial `(x,y) -> row,col` arithmetic — the scene-graph abstraction buys nothing and adds an object-per-cell overhead a flat draw loop avoids.
- **Fabric.js** (~90 KB gzipped, actively maintained, first-party TS types): oriented toward interactive object manipulation (drag, resize, transform), none of which this board needs.
- **Plain SVG (no framework)**: viable at ~500 elements, but each cell is a DOM node, so frequent per-cell fill-color updates (every solver pass) repaint across the document tree — slower than a flat Canvas redraw for this update pattern.

None of these change the verdict: a minesweeper board's regularity means hand-rolled Canvas2D has effectively zero overhead versus any library wrapping the same coordinate math in an abstraction layer. Revisit only if scope grows to need draggable elements or complex multi-layer z-ordering (e.g., a reconsidered possible-worlds view) — Konva's scene graph would pay for itself then, but not for current scope.

**3. Solver runs in a Web Worker, off the main thread.**
Tier 2 enumeration is exact backtracking search per frontier component — worst case exponential in component size. Typical minesweeper frontiers stay small (tens of cells) and resolve in milliseconds, but pathological boards can produce larger connected components. Rather than cap correctness (which would silently contradict the "exact, no Tier 1" scope), isolate the search in a Worker so a slow enumeration degrades to "heatmap takes a moment to update" instead of freezing clicks/rendering.

**4. Solver data model: components -> enumerated assignments -> weighted worlds -> per-cell marginals.**
Pipeline, re-run after every reveal:
```
board state
  -> identify frontier (unopened cells adjacent to a revealed number)
  -> partition frontier into connected components (union-find over
     "shares a numbered neighbor")
  -> per component: backtracking search with constraint propagation
     (Tier 0 forced values applied first as fixed assignments, then
     branch-and-bound with early constraint checking, not naive
     full enumeration) -> list of valid assignments
  -> combine assignments across components, weighted by the number of
     ways the remaining mines fit the non-frontier cells (binomial
     coefficient) -> weighted world list
  -> per-cell marginal probability = sum of weights of worlds where
     that cell is a mine, normalized
  -> per-frontier-cell EIG = H(worlds) - E[H(worlds | click outcome)],
     grouping the same world list by each cell's predicted outcome
     (mine, or safe+number) per world — no separate search needed
```
This keeps EIG a derived view over the same object the heatmap reads, per proposal's intent that they share one computation.

**5. Heatmap color encoding: diverging scale keyed to mine probability p in [0, 1].**
All unopened cells (frontier and non-frontier) map through the same p -> color function; only frontier cells additionally get the EIG/click readout. Palette values from the dataviz skill's documented diverging pair (blue/red poles, neutral gray midpoint).

Revised from an initial sequential-H(p) design: H(p) treats p=0 and p=1 as identical (both zero entropy), which hides exactly the distinction a player needs mid-game — "is the solver certain this is safe, or certain it's a mine?" A diverging scale keyed to p directly makes p=0 and p=1 visually opposite poles, with p=0.5 (peak uncertainty) as the neutral midpoint in between. EIG and realized surprisal (frontier-solver capability) remain the place entropy/information-theoretic quantities are shown directly; the heatmap now shows probability itself.

**6. Board generation: standard first-click-safe.**
Mines are placed only after the first click, excluding the clicked cell and its 8 neighbors, using the classic convention (guarantees an opening, not just a safe first cell) so the solver always starts from a real frontier rather than a trivial edge case.

## Risks / Trade-offs

- **[Risk] A large connected frontier component causes slow/exponential backtracking, stalling the heatmap update.** → Mitigation: Worker isolation (Decision 3) keeps the UI responsive regardless; add Tier 0 propagation and constraint-ordered branch pruning (standard CSP speedups) inside the backtracking search, which keeps real minesweeper frontiers fast in practice even without approximation.
- **[Risk] Canvas hand-rolled rendering is less familiar/extensible than a component framework if this project grows scope later (e.g., possible-worlds view gets reconsidered).** → Mitigation: acceptable trade-off given current scope explicitly excludes that view; the render loop is small and isolated enough to swap later if scope changes.
- **[Risk] Flood-fill reveals (opening a zero-region) touch many cells at once and could make the solver re-run mid-cascade look janky.** → Mitigation: resolve the full flood-fill first, then run one solver pass on the settled board state, rather than re-solving per revealed cell.

## Open Questions

- Exact color palette values and accessibility (colorblind-safe) tuning — deferred to implementation using the `dataviz` skill, doesn't change this design.
- Whether to persist last-used board size/difficulty in `localStorage` — small UX nicety, doesn't affect specs or architecture either way.
