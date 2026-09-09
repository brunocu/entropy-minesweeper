## Why

`src/main.ts` is 282 lines that build the entire game UI imperatively and then hand-roll a reactive system on top of it: four module-level `let` bindings acting as signals, a `draw()` function acting as a renderer, and five hand-written "should I repaint?" bailouts braided into the event handlers. The bailouts encode real and valuable knowledge — repaint on cell transition rather than per pointer pixel, skip `uPlot.setData` unless the history actually grew — but because they sit inside the handlers, the game logic cannot be read without also reading the optimization. A declarative UI layer expresses the same optimizations as properties of the state rather than as branches in the handlers.

## What Changes

- Add `solid-js` and `vite-plugin-solid`; set `jsx: "preserve"` and `jsxImportSource: "solid-js"` in `tsconfig.json`; register the plugin in `vite.config.ts` and in the Vitest config.
- Replace `src/main.ts` with Solid components: a toolbar (difficulty select, new-game button, mines-left readout, explainer link), a board canvas, a readout panel (hover, reveal, status, entropy), and an uncertainty-chart wrapper.
- Convert the four module-level `let`s into signals, and `draw()` into effects that track only what they read.
- Express the five manual repaint bailouts as signal equality and derived state rather than as early returns (see design.md — Decision 3).
- Keep canvas and uPlot rendering imperative, driven from effects behind element refs. `BoardRenderer`, `createUncertaintyChart`, `probabilityColor`, and `hitTest` are not modified.
- Apply the game-page CSS classes introduced by `unify-design-tokens`, removing the inline style assignments.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change alters how the game page's DOM is constructed, not what it displays or how it behaves. Every requirement in `information-visualization` and `minesweeper-board` holds before and after, with the same observable output.

This change therefore has zero spec deltas and requires `skip_specs: true` in its `.openspec.yaml` for `openspec validate` to pass.

## Impact

- **New**: `solid-js`, `vite-plugin-solid` dependencies; Solid component modules under `src/ui/`.
- **Modified**: `src/main.ts` (replaced), `tsconfig.json`, `vite.config.ts`, `index.html`.
- **Unmodified**: everything under `src/solver/`, `src/board/`, `src/game/`, and `src/render/`. The rendering primitives keep their current imperative interfaces; only their caller changes.
- **Not in scope**: `src/explainer/revealDemo.ts`, which has the same ID-coupled imperative shape in miniature. It is converted by `migrate-explainer-to-astro-mdx`, where it becomes an island in the rewritten explainer.
- **Tests**: `src/game/__tests__/` and `src/render/__tests__/` are unaffected — they test modules this change does not touch. No existing test covers `main.ts`.
- **Deliberately pinned to Solid 1.x**, not the 2.0 release candidate. See design.md — Decision 5.
