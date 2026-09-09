## Why

The site's palette is maintained twice by hand — six CSS custom properties in `explainer.html`'s `:root` block and seven exported constants in `src/render/probabilityColor.ts` — with identical hex values and no mechanism keeping them in step. Meanwhile `index.html` has no stylesheet at all (every game-page style is an inline assignment in `src/main.ts`), and several colors in `boardRenderer.ts` and `uncertaintyChart.ts` come from neither set. The result is that the game page and the explainer page do not read as one site.

## What Changes

- Add `src/design/tokens.ts` as the single source of truth for the site's color tokens, named semantically (`safe`, `mine`, `eig`, `clue`, `premise`, `ink`, `surface`, `page`, `rule`).
- Add `scripts/generate-tokens.mjs`, a plain Node script run from `predev` and `prebuild`, which derives `src/design/tokens.css` — a `:root` block of CSS custom properties — from `tokens.ts`. The generated file is committed and its freshness is asserted by a test. No new build-tool plugin is introduced, and no third-party token pipeline is adopted; see design.md — Decision 1.
- `probabilityColor.ts` imports its poles, midpoint, ramp endpoints, and highlight colors from `tokens.ts` instead of declaring local literals. Its exported `*_COLOR` names and its documented dataviz-palette provenance are preserved.
- Replace `explainer.html`'s hand-written `:root` block with the generated stylesheet.
- Give `index.html` a real stylesheet, and define the game page's CSS classes. **The inline-style assignments in `main.ts` are not removed here** — see Impact.
- Reconcile the colors that currently belong to no token set:
  - `uncertaintyChart.ts` series stroke `#2b6cb0` → the `safe` token
  - `boardRenderer.ts` revealed-mine fill `#e74c3c` and `#c0392b` → the `mine` token
  - `boardRenderer.ts` flagged `#7f8c8d` and unknown-probability `#95a5a6` → neutral-ramp tokens
  - `boardRenderer.ts` label/text `#1a1a1a` → the `ink` token
- Fix the stale comment in `boardRenderer.fillColorFor`, which cites `#f0efec` as the diverging scale's neutral midpoint when the actual `NEUTRAL_MIDPOINT` is `#c0c0c0`.

## Capabilities

### New Capabilities

- `design-system`: The site presents one visual language across all of its pages — a single named set of color tokens, used by both CSS-rendered chrome and canvas-rendered visualization, such that a color carrying a meaning on one page carries the same meaning and the same value on the other.

### Modified Capabilities

None. The `information-visualization` spec describes colors semantically ("safe pole", "neutral midpoint", "visually distinct") and never fixes a hex value, so reconciling the stray literals does not alter any stated requirement.

## Impact

- **New**: `src/design/tokens.ts` (source of truth), `scripts/generate-tokens.mjs`, `src/design/tokens.css` (generated, committed), `src/design/__tests__/` freshness test.
- **Modified**: `src/render/probabilityColor.ts`, `src/render/boardRenderer.ts`, `src/render/uncertaintyChart.ts`, `explainer.html`, `index.html`, `package.json` (`predev`/`prebuild` scripts).
- **Deliberately untouched**: `src/main.ts`. Its ~30 inline style assignments are removed by `port-game-ui-to-solid`, which rewrites that file wholesale; touching it twice would mean writing the same code twice. This change defines the classes that change consumes.
- **Visible change**: the chart series stroke, revealed-mine fill, flagged fill, and grid-label color all shift. No behavior changes.
- **Dependencies**: none added. Style Dictionary, Panda CSS, Vanilla Extract, StyleX, and `vite-plugin-css-export` were each evaluated and rejected; see design.md — Decision 1.
