## Context

The app is a single-page vanilla TypeScript + Canvas2D game with no framework and no router (`src/main.ts` builds the whole UI imperatively; see `vite.config.ts` / `tsconfig.json` for the plain Vite + TS setup). The frontier solver (`src/solver/frontierSolver.ts`) already enumerates weighted possible worlds internally per connected component (`enumerateComponentFull`, `ComponentAssignment[]`) and combines components with global mine-count weighting, but only exposes the aggregated result (`SolveResult`: per-cell probability, EIG, `outcomeProbabilities`, total entropy) — not the raw per-world list the proposal's worlds-tree demo needs to render. See `proposal.md` for why this explainer is needed and what it must cover.

## Goals / Non-Goals

**Goals:**
- Decide how the explainer is reached as a separate page without introducing a router/framework.
- Decide how the worlds-tree demo gets real per-world data without reimplementing solver math.
- Fix a component/reuse architecture for all five demos (worlds-tree x2 modes, certainty-explanation, predicted-vs-realized, uncertainty-chart) that reuses existing modules against fixed toy inputs.

**Non-Goals:**
- No possible-worlds visualization on the live game board (proposal explicitly excludes this; previously rejected as visually noisy).
- No change to the frontier solver's observable behavior, the live board's rendering, or any existing spec's requirements — only an internal API-surface addition for demo reuse.
- No general-purpose blog/CMS infrastructure; this is one static-content page with a handful of bespoke interactive widgets.

## Decisions

**1. Separate page via Vite multi-page entry, not a client-side router.**
Add a second HTML entry point (e.g. `explainer.html` with its own `src/explainer/main.ts`), wired into `vite.config.ts`'s `build.rollupOptions.input`. The main UI's new button is a plain link to it. Alternative considered: a hash-route toggle inside the existing `index.html`/`main.ts` — rejected because it would thread page-mode branching through the game's imperative setup code for no benefit, and would pull explainer-only code/dependencies into the game's bundle.

**2. Export a minimal per-world enumeration API from `frontierSolver.ts` for reuse.**
The worlds-tree demo needs the actual weighted world list, not just aggregates. Rather than reimplementing enumeration/weighting in the explainer (which risks the demo silently drifting from the real math), export a small function from `frontierSolver.ts` that returns the enumerated, weighted worlds for a given `SolverBoard` (reusing the existing component enumeration + mine-count weighting it already computes). This is an internal API-surface addition only — no change to existing exports' behavior, so no `frontier-solver` spec delta is needed. Keep the new export narrowly scoped and commented as demo-oriented, not a general public API.

**2a. Only the predicted-vs-realized demo runs the solver in the browser; the rest are precomputed at build time via a Vite plugin, not a standalone prebuild script.**
The worlds-tree (both modes), the certainty-explanation board, and the uncertainty chart always render the same fixed illustration of a fixed toy scenario — nothing about them changes at runtime. A small local Vite plugin (added in `vite.config.ts`) hooks `transformIndexHtml` for `explainer.html`: on each transform, it imports the real solver/highlight code from decision 2 and decision 6, runs it once against each toy fixture, and injects the resulting static markup (inline SVG) directly into the HTML. Only the predicted-vs-realized demo (decision 7), which genuinely needs fresh randomness per re-roll, ships `frontierSolver`/`computeRevealFeedback` to the browser and computes at runtime.

A standalone script (e.g. `scripts/generate-explainer-demos.ts` run before `vite build`) was considered and rejected for two reasons: it would only run for production builds, leaving the explainer's illustrations missing during `vite dev`, whereas `transformIndexHtml` runs on every dev-server request as well as at build time; and it would need its own TS execution tooling (`ts-node`/`tsx`, neither currently a dependency) to import `frontierSolver.ts`, whereas a Vite plugin runs inside Vite's own plugin pipeline, which already loads TS the same way `vite.config.ts` itself does. This keeps the explainer's shipped JS to roughly one small interactive widget instead of a full solver bundle plus four inert renders of it, with no new build-tooling dependency.

**3. Toy scenarios are hand-authored fixed `SolverBoard` literals, one per teaching need, sized to stay legible.**
- One scenario for the worlds-tree (shared by probability mode and EIG mode): small enough (≤4 unknown cells) that the full pruned tree fits on screen, and chosen so it has a genuine mix of a certain cell, an uncertain cell, and a clear "informative vs. less-informative" contrast between two frontier cells for EIG mode to demonstrate.
- A separate, distinct scenario for the certainty-explanation demo, chosen specifically to produce at least one certain (0%/100%) cell with both a clue and a premise cell in its explanation set.
No random generation for any demo's underlying board — determinism is what makes the "watch this specific deduction happen" framing work.

**4. New standalone tree-rendering generator, not an extension of `BoardRenderer`.**
A branching tree (nodes, edges, struck-through dead branches) is a fundamentally different visual from the board's cell grid, and is only ever used on the explainer page. Build it as its own small SVG-emitting function (easy text labels and strike-through styling on dead branches), run at build time per decision 2a, rather than bending `boardRenderer.ts`'s Canvas2D grid-drawing loop to also draw trees. Keeps the live-game renderer untouched.

**5. One `WorldsTree` generator, two modes, same toy scenario and same underlying data, invoked once each at build time.**
The generator takes the enumerated worlds (from decision 2) plus a `mode: 'probability' | 'eig'` and a focus cell, and returns static SVG markup. Probability mode branches in a fixed cell order and highlights surviving leaves where the focus cell is a mine. EIG mode re-orders the tree so the focus cell branches first, grouping subtrees by that cell's outcome, so each subtree's narrower leaf-spread is visible next to the whole tree's. Both modes read the same enumeration output — no separate calculation path, mirroring how the real solver derives EIG from the same world list it uses for probability. The `transformIndexHtml` plugin (decision 2a) calls this generator once per mode and embeds the two resulting SVGs in the page.

**6. Certainty-explanation demo stays a separate, precomputed illustration reusing the existing highlight mechanism.**
Per explicit direction, this is not folded into `WorldsTree` — it demonstrates a different mechanism (`computeExplanations`'s clue/premise sets, already used by the live board). At build time, run `computeExplanations` against the dedicated toy fixture (decision 3) for its one certain cell, and emit a static board rendering with the clue/premise highlight already baked in, reusing the existing `CLUE_HIGHLIGHT_COLOR`/`PREMISE_HIGHLIGHT_COLOR` constants from `probabilityColor.ts`. No hover interaction — there is only the one illustrated cell/highlight to show.

**7. Predicted-vs-realized demo reuses `computeRevealFeedback` with a re-rollable weighted pick, at runtime.**
This is the one demo that ships solver code to the browser, since "re-roll" must produce fresh randomness each time: it picks among the toy scenario's possible outcomes weighted by their real solver-computed probabilities (not uniformly), then calls the same `computeRevealFeedback` the live game uses to get predicted EIG and realized information — so the demo's numbers are never hand-authored.

**8. Uncertainty-chart demo is a precomputed static inline SVG, not a live `uPlot` instance.**
A fixed `UncertaintyHistoryPoint[]` array is authored to contain one clear cliff and one flat stretch; at build time it's rendered once into a static inline SVG (plotted directly, not through `uPlot`) with the prose callouts' reference points baked in as annotations on the SVG itself. This keeps the explainer consistent with the other three static demos (no interactivity, no chart library shipped) and matches decision 2a's reasoning — the trace never changes, so there's nothing runtime interactivity would add.

## Risks / Trade-offs

- [Risk] Exporting internal enumeration logic widens `frontierSolver.ts`'s public surface for what is really a single demo-only consumer. → Mitigation: keep the new export minimal and documented as demo-oriented; it doesn't change any existing export's contract.
- [Risk] Hand-authored fixtures could quietly stop demonstrating what they're supposed to if the solver's math changes later. → Mitigation: every demo computes its displayed numbers live from the real solver/chart/highlight code against the fixture, rather than hardcoding expected outputs — a solver change would visibly break or change the demo instead of silently going stale.
- [Risk] SVG tree layout only stays legible for small scenarios. → Mitigation: this is deliberately a fixed, curated teaching demo capped at the sizes chosen in decision 3, not a general-purpose worlds visualizer meant to scale to arbitrary boards.
- [Risk] Two Vite entry points add a small amount of build config surface. → Mitigation: standard, well-documented Vite feature (`build.rollupOptions.input`); no additional tooling needed.

## Migration Plan

Purely additive: a new page, a new button on the existing UI, and a narrow new solver export. No persisted state, no existing behavior changes, nothing to migrate or roll back beyond removing the new files/button if reverted.
