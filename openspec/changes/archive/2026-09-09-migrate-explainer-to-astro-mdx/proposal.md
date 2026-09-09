## Why

The explainer is authored through a bespoke pipeline: two hand-written Vite plugins, a nine-plugin `unified()` chain, a regular expression that rewrites the compiled HTML string to inject solver-computed values, and an interactive demo whose markup lives as raw HTML in the Markdown while its behavior lives in a separate module coupled to it by four element IDs. Every one of those pieces exists to work around the same limitation — Markdown cannot express a component. MDX can, which collapses most of the pipeline rather than porting it. Adopting Astro also gives the two pages a shared layout, which is what makes them read as one site rather than two.

## What Changes

- Adopt Astro with `@astrojs/mdx` and `@astrojs/solid-js`. `index.html` and `explainer.html` become Astro pages sharing one layout.
- Configure `markdown.processor` as `unified({ remarkPlugins: [remarkMath], rehypePlugins: [rehypeMathjax] })`. Astro 7's default Sätteri processor cannot run remark/rehype plugins, and the explainer contains 84 math spans. See design.md — Decision 2.
- Convert `explainer.md` to `explainer.mdx`, replacing markup scaffolding with components:
  - 24 `:::` block directives → `<Figure>` / `<Figcaption>` components; `remark-directive` and `src/explainer/directives.ts` are deleted.
  - 4 `:term-*` inline directives → `<Safe>` / `<Mine>` / `<Clue>` / `<Premise>` components.
  - ~16 lines of `<div class="root-board-panel">` / `<div class="figure-scroll">` wrappers → `<BoardFigure>` / `<WideFigure>`.
  - 11 `<span data-figure="...">` placeholders → `{figures['...']}` expressions reading a direct import. **`substituteFigures()`, which parses HTML with a regular expression, is deleted.**
  - The ~15-line raw-HTML demo block → `<RevealDemo client:visible />`.
- Convert `src/explainer/revealDemo.ts` into a Solid island, removing its coupling to `#demo-canvas`, `#demo-reset`, `#demo-narration`, `#demo-predicted`, `#demo-realized`.
- **BREAKING (internal)**: delete `src/explainer/compileExplainer.ts`, `src/explainer/directives.ts`, the `explainerMarkdown()` and `explainerIllustrations()` Vite plugins, and the `<!--explainer-content-->` shell mechanism.
- Move illustration generation from the custom Vite plugin's `this.emitFile()` to an Astro integration using Astro's documented build hooks. See design.md — Decision 3.
- Rewrite the explainer test suite against the new structure. The existing tests assert against compiled HTML strings produced by machinery this change removes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. Every requirement in the `explainer` spec is about content and reader-visible behavior — which sections exist, that eliminated branches are visually distinct, that the demo shows predicted alongside realized — and all of them hold identically after the rewrite. The `deployment` spec's subpath and CI requirements likewise hold: the site remains a static bundle published to GitHub Pages at `/entropy-minesweeper/`, gated on tests.

This change therefore has zero spec deltas and requires `skip_specs: true` in its `.openspec.yaml` for `openspec validate` to pass.

## Impact

- **New**: `astro`, `@astrojs/mdx`, `@astrojs/solid-js` dependencies; `astro.config.mjs`; a shared layout; explainer components; an Astro integration for illustrations.
- **Removed**: `src/explainer/compileExplainer.ts`, `src/explainer/directives.ts`, both Vite plugins in `vite.config.ts`, `remark-directive`, `remark-github-markdown-alerts`, `rehype-raw`, `rehype-stringify`, `remark-parse`, `remark-rehype` (the plugin surface drops from nine to two).
- **Retained**: `remark-math`, `rehype-mathjax`, `unified`, `mathjax-full`.
- **Modified**: `explainer.md` → `explainer.mdx`, `src/explainer/revealDemo.ts`, `src/explainer/main.ts`, `.github/workflows/deploy.yml` (build command), `package.json` scripts.
- **Unmodified**: `src/explainer/illustrations.ts`, `boardSvg.ts`, `certaintyBoard.ts`, `worldsTree.ts`, `predictedVsRealized.ts`, `uncertaintyChartSvg.ts`, `fixtures.ts`, `solvedFixture.ts`. The illustration and figure *generators* are unchanged; only how their output is published changes.
- **Depends on**: `port-game-ui-to-solid` (Solid components and `tsconfig` JSX settings) and `unify-design-tokens` (the shared stylesheet the layout serves).
- **Tests**: `explainerPage.test.ts`, `compileExplainer.test.ts`, and `directives.test.ts` are replaced. `figures.test.ts`, `illustrationFiles.test.ts`, `mathSyntax.test.ts`, and the generator tests survive, since they test modules this change does not touch.
