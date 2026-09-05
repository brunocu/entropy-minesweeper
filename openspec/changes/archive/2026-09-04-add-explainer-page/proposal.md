## Why

The live game currently exposes raw solver output (probability heatmap colors, EIG bits, an entropy chart) with zero explanation anywhere in the app or repo. A visitor who already knows Minesweeper has no way to learn what the color scale, the certainty marker, EIG, or the uncertainty chart mean, or why the project computes them the way it does. This change adds a dedicated explainer so the project can actually be understood, not just played.

## What Changes

- New "What does any of this mean?" button on the main game UI that navigates to a separate explainer page (not a modal — the content is long-form and carries several demos).
- The explainer page is written blog-style (prose sections, not a numbered checklist), covering: the project's pitch, the frontier/non-frontier split (making explicit that pooling non-frontier cells is mathematically identical to solving them individually, not an approximation), how to read the probability heatmap, what expected information gain means, the predicted-vs-realized comparison on reveal, the certainty-explanation highlight, and how to read the uncertainty chart.
- A reusable **worlds tree** illustration: enumerates and renders the frontier solver's weighted possible-worlds for a small, fixed, hand-picked toy scenario as a pruned binary decision tree (branch per unknown cell, dead branches struck through where inconsistent with the clue). Used twice, in different modes, on the same toy scenario, precomputed once at build time since neither mode changes at runtime:
  - Probability mode: surviving leaves where a chosen cell is a mine are highlighted; their weights visibly sum to that cell's probability.
  - EIG mode: the same tree re-rooted by the outcome of a chosen cell; each outcome subtree's narrower spread of surviving leaves visualizes the entropy reduction that is being reported as expected information gain.
- A separate, smaller **certainty-explanation illustration**: a small toy board (distinct fixed scenario) reproducing the live game's clue/premise highlight (aqua/green) at a legible scale, precomputed at build time since it always shows the same one certain cell's explanation — this relies on a different mechanism (explanation-set highlighting) than the worlds tree.
- The one genuinely **interactive demo, predicted-vs-realized**: a re-rollable toy reveal showing predicted EIG and realized information side by side, recomputed live in the browser for a fresh random outcome on each re-roll.
- A **canned uncertainty chart example**: a fixed example trace, precomputed at build time into a static inline illustration, with inline prose annotations pointing out a "cliff" (informative reveal) and a "flat stretch" (uninformative reveal).
- All demos derive their numbers from real project code (frontier solver, `probabilityColor`/EIG color scales, the uncertainty-chart data model) driven by small fixed toy inputs, rather than hand-authoring or faking the underlying math. Three of the four are precomputed once at build time and served as static markup, since only the predicted-vs-realized demo needs to change at runtime.
- Explicitly out of scope: any live "possible worlds" view on the actual game board (previously rejected as visually noisy — see `openspec/changes/archive/2026-09-03-entropy-minesweeper/proposal.md`); this change only introduces the worlds-tree visualization as a teaching demo on a toy scenario, not on live gameplay.

## Capabilities

### New Capabilities
- `explainer`: A dedicated, separate-page explanation of the project's motivation and solving mechanisms, including the worlds-tree, certainty-explanation, predicted-vs-realized, and uncertainty-chart teaching demos, reachable from the main game UI.

### Modified Capabilities
- `minesweeper-board`: Adds the "What does any of this mean?" entry-point control to the main game UI, navigating to the explainer page.

## Impact

- New `explainer` page/route, a build-time generator for its three static toy-scenario illustrations (new solver-driven tree-rendering code, reused `probabilityColor`/EIG color scale constants), and the one runtime interactive demo (reusing `computeRevealFeedback`).
- Build tooling: a new local Vite plugin (hooking `transformIndexHtml`) that generates the static illustrations at dev-server-request and build time, plus a second Vite HTML entry point for the explainer page itself.
- Main game UI (`src/main.ts` or wherever the toolbar lives): adds one new button and navigation to the explainer page.
- No changes to live gameplay, the frontier solver's runtime behavior, or the existing information-visualization requirements — the explainer only reads/reuses that code against fixed toy data, and only ships solver code to the browser for the one interactive demo.
