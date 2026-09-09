## Context

See proposal.md — Why.

Four facts about the current setup constrain the design:

- **Illustrations are generated from the real solver at build time.** `buildIllustrationFiles()` runs `solveFixture()`, enumerates weighted worlds, and draws SVG from the actual result. `computeFigureValues()` does the same for the numbers quoted in the prose. This is the most valuable property of the explainer — the article cannot drift from the code it describes — and no migration may weaken it.
- **The document is math-heavy.** 168 `$` delimiters, i.e. 84 math spans. Math handling is not a detail here.
- **Dev and build must serve illustrations from the same URL.** The current Vite plugins achieve this two ways: `this.emitFile()` at build, and a `configureServer` middleware in dev.
- **Astro 7's default Markdown processor is Sätteri**, a Rust implementation that does not run remark or rehype plugins at all. `unified()` remains a supported processor choice.

Verified against current Astro documentation during exploration: `@astrojs/solid-js` and `@astrojs/mdx` are first-party; `.mdx` files may import Solid components and hydrate them with `client:*` directives; `markdown.remarkPlugins`/`rehypePlugins` are deprecated in favor of `markdown.processor`; `base` is **not** automatically prepended to `<a href>`.

## Goals / Non-Goals

**Goals:**

- Replace pipeline machinery with components wherever the machinery exists only to compensate for Markdown's lack of components.
- Preserve the build-time-generated-from-real-solver guarantee exactly, for both illustrations and quoted figures.
- One layout and one stylesheet serving both pages.
- Use Astro's documented extension points rather than carrying custom Vite plugins forward.

**Non-Goals:**

- Changing the explainer's prose, its argument, its illustrations, or the fixtures they are drawn from.
- Adding pages. The site remains the game and the explainer; no new content is planned, and none of this is justified by page count.
- Adopting Astro content collections, a router, or SSR. Both pages stay static.
- Server-side math typesetting. MathJax continues to typeset in the browser (Decision 2).

## Decisions

### 1. MDX rewrite, not a lift-and-shift of the `.md` pipeline

The alternative — keep `explainer.md` and its nine-plugin chain, run it under Astro, gain only a layout — is worse than it first appears. It would pin the project to a non-default processor while carrying every plugin, in exchange for very little.

MDX inverts that. Because `.mdx` parses `<` as JSX rather than as raw HTML, the 48 raw-HTML lines in the document *must* be converted — but they are precisely the lines that should stop being HTML anyway:

```
   TODAY                                 AFTER
  remark-directive          ---------->  <figure> <figcaption>
  remarkExplainerDirectives ---------->  <span class="term-safe"> etc.
  raw HTML + rehype-raw     ---------->  raw HTML (MDX parses it as JSX)
  substituteFigures() regex ---------->  {figures['focus-probability']}
  demo raw HTML + IDs       ---------->  <RevealDemo client:visible />
  remark-github-alerts      ---------->  <div class="callout">
  remark-rehype             ---------->  Astro
  rehype-stringify          ---------->  Astro
  rehypeStripAlertTitle     ---------->  (gone with the alerts plugin)

  remark-math               ---------->  remark-math      (kept)
  rehype-mathjax            ---------->  rehype-mathjax   (kept)
```

Nine plugins to two. The forced conversion is the migration's cost and its payoff at the same time.

The clearest single case is `substituteFigures()`, which today does `html.replace(/(data-figure="([^"]+)"[^>]*>)([^<]*)(<)/g, ...)` — parsing HTML with a regular expression to inject solver values into prose. Under MDX that becomes an import and an expression. The guarantee is identical; the mechanism stops being a liability.

### 2. `unified()` processor, not Sätteri

Not really a choice: Sätteri cannot run `remark-math`, and the document has 84 math spans.

**Confirmed against Astro 7.3.2** (docs.astro.build's Markdown guide, and `@astrojs/markdown-remark@7.3.1`'s own `dist/processor.d.ts`):

- The factory is named `unified`, but it comes from **`@astrojs/markdown-remark`**, not from the `unified` package. That package is no longer a dependency of `astro` — `astro@7.3.2` depends on `@astrojs/markdown-satteri` instead — so it is installed explicitly.
- Plugins are passed as **options to the factory**, not attached with `.use()`.

```js
import { unified } from '@astrojs/markdown-remark'
import rehypeMathjax from 'rehype-mathjax/browser'
import remarkMath from 'remark-math'

export default defineConfig({
  markdown: {
    processor: unified({ remarkPlugins: [remarkMath], rehypePlugins: [rehypeMathjax] }),
  },
})
```

`UnifiedProcessorOptions` also carries `remarkRehype`, `recmaPlugins`, `gfm` (default `true`) and `smartypants` (default `true`); none of the four need overriding here.

Worth recording the trade-off honestly: Astro is clearly steering toward Sätteri as the default, so this is the non-default path. It is a supported one, and the unified ecosystem is too widely depended upon for Astro to drop it soon. Reducing the plugin surface from nine to two also minimizes exposure — if Sätteri ever gains a math plugin, one plugin is what stands in the way.

`rehype-mathjax/browser` continues to be used, leaving `\(...\)` delimiters for the CDN MathJax runtime to typeset client-side, exactly as today. Switching to build-time typesetting is a separate question and out of scope.

### 3. Illustrations move to an Astro integration using documented hooks

Explicit direction for this change: use Astro's documented route rather than carrying `explainerIllustrations()` forward as a raw Vite plugin. Astro accepts raw Vite plugins via `vite: { plugins: [...] }`, so keeping it *would* have worked — the decision is to prefer the framework's own extension points, accepting a cost.

The cost is real and should be recorded. Today the build side is `this.emitFile({ type: 'asset', fileName, source })` — one call, no filesystem access, Rollup handles placement. The Astro equivalent is the `astro:build:done` hook, which supplies `dir` as a URL, requiring `fileURLToPath()` and explicit `node:fs` writes. That is strictly more code for the same result.

Dev mode needs its own answer, because `astro:build:done` runs only at build:

- **Build**: `astro:build:done` writes the generated SVGs into the output directory.
- **Dev**: a server-setup hook adds middleware answering the same URLs from memory, mirroring the current `configureServer` behavior and preserving regeneration-per-request so edits to a fixture or generator show up on reload.

**Both hooks confirmed against `astro@7.3.2`'s `dist/types/public/integrations.d.ts`**, so the `public/` fallback below is not needed:

```ts
'astro:server:setup': (options: { server: ViteDevServer; logger; toolbar; refreshContent? }) => void | Promise<void>
'astro:build:done':   (options: { pages: { pathname: string }[]; dir: URL; assets: Map<string, URL[]>; logger }) => void | Promise<void>
```

`astro:server:setup` hands over the real `ViteDevServer`, so the existing `server.middlewares.use(...)` body ports across unchanged. `dir` is a `URL`, hence the `fileURLToPath()` in the build side.

*Alternative considered:* a `prebuild`/`predev` npm script that writes the SVGs into `public/`, which Astro then serves in both modes with no hooks at all. Simpler, and `public/` is as documented as it gets. Rejected because it puts generated files in the working tree — they need gitignoring, they go stale whenever a generator changes without the script rerunning, and the "regenerated per request in dev" property is lost. Worth revisiting if the two-hook integration proves awkward.

### 4. The demo becomes an island, hydrated with `client:visible`

`revealDemo.ts` currently reaches into the document for five IDs baked into raw HTML in the Markdown. As `<RevealDemo client:visible />` that coupling disappears — the markup and behavior live in one component, and the article references it by name.

`client:visible` rather than `client:load`: the demo sits well down a long article, it is the only interactive element on the page, and nothing above it depends on it being hydrated. Deferring until it scrolls into view keeps the page's initial cost near zero, which is the whole point of adopting an islands architecture for a prose page.

Note the props constraint: Astro serializes island props and **cannot pass functions**. The demo takes no props — it imports its fixture and solver directly — so this does not bite here, but it is a real constraint on any future island.

### 5. Figure values by direct import

The layout or the MDX file imports `computeFigureValues()` and exposes the result, and the prose interpolates `{figures['mine-count']}`. Same function, same solve, same guarantee as today — reached by an import instead of a post-processing pass over an HTML string.

### 6. Subpath handling stays manual

Astro's `base` is not automatically prepended to `<a href>`, so the game↔explainer links and any hard-coded asset URLs must continue to use `import.meta.env.BASE_URL`. This change buys no relief on the `deployment` spec's three subpath scenarios — they require exactly the same care as today. Recorded here precisely because it is easy to assume a framework handles it.

### 7. Tests are rewritten, not preserved

`compileExplainer.test.ts`, `directives.test.ts`, and `explainerPage.test.ts` assert against HTML strings produced by machinery this change deletes. They are replaced by tests against the new structure. The generator tests (`figures.test.ts`, `illustrationFiles.test.ts`, `boardSvg.test.ts`, `worldsTree.test.ts`, and the rest) test modules that do not change and must keep passing untouched — they are the regression net for the guarantee in Decision 5, and any change to them is a signal something went wrong.

## Risks / Trade-offs

- **MDX conversion of 48 raw-HTML lines is per-line manual work with a compile-time failure mode** → Unlike a silent behavior change, a mis-converted line fails the build, which is the good case. The genuine unknown is whether `class` attributes and the document's multi-line `<img>` tags pass cleanly through Astro's MDX JSX runtime; this was not verified during exploration. Mitigation: convert one figure first and confirm the build before doing the remaining 47 lines.
- **The illustration pipeline is rewritten, and it is the thing most worth not breaking** → `astro:build:done` plus dev middleware is more code than `this.emitFile()`, on a path with no test coverage of the *publishing* step (only of the generators). Mitigation: `illustrationFiles.test.ts` still pins the generated content; add a check that the built output contains every expected `.svg` before considering the change done.
- ~~**`astro:server:setup` was not explicitly confirmed during exploration**~~ → **Resolved (task 1.2).** The hook exists in `astro@7.3.2` and exposes the `ViteDevServer`. The `public/` fallback is not taken.
- **No headless browser in this environment** → Neither the math typesetting, the illustration layout, nor the hydrated demo can be verified here. This change alters how every visible thing on the explainer is produced, so human review of the rendered page is mandatory before it is called done.
- **Three frameworks' concepts at once** (Astro build, MDX authoring, Solid islands) → Landing this last, after Solid is already proven by `port-game-ui-to-solid`, means only Astro and MDX are new when it starts.
- **Adopting a meta-framework for two pages** → Astro's core competency is multi-page content authoring, which this project does not need; the justification is MDX-with-components and the shared layout, not page count. The honest alternative was wiring MDX to Solid outside Astro — rejected because that requires community-maintained glue (`solidjs-mdx` / `solid-jsx`) with no first-party backing, which is a poor dependency for a project meant to be shown to people.

## Migration Plan

1. Add Astro and the two integrations alongside the existing build; configure `processor: unified({...})`, `site`, and `base`. Do not remove anything yet.
2. Port `index.html` to an Astro page with the shared layout. The game is already Solid components by this point, so it becomes an island. Verify the game works, including the explainer link under `base`.
3. Build the illustration integration and confirm both dev and build serve every SVG at the same URLs as today.
4. Convert one figure in `explainer.mdx` and build, to settle the `class`/multi-line-`<img>` question cheaply.
5. Convert the remainder: directives, wrappers, figure spans, alerts.
6. Convert the demo to `<RevealDemo client:visible />`.
7. Delete `compileExplainer.ts`, `directives.ts`, the two Vite plugins, and the now-unused dependencies. Rewrite the affected tests.
8. Update `deploy.yml` and `package.json` scripts.

Rollback: through step 6 the old pipeline still exists and the change reverts cleanly. Step 7 is the point of no return; it should be its own commit, taken only after the rendered page has been reviewed by a human.

## Open Questions

- ~~Whether `<Callout>` replaces `remark-github-markdown-alerts` or the plugin is kept for two alerts.~~ **Resolved (task 4.6): the plugin goes.** It unconditionally renders a title element that `rehypeStripAlertTitle` existed only to delete, and its `'html'` mode silently flattened the alert body — two dependencies and a tree walk to produce a `<div class="callout">`, twice. The article now writes that `<div>` directly (see below); the processor is down to `remark-math` and `rehype-mathjax`.
- ~~Whether the shared layout also absorbs the explainer's prose styles or keeps them page-scoped.~~ **Resolved (task 2.4): page-scoped**, as `src/design/explainer.css`. `unify-design-tokens` lifted the *tokens* and left `game.css` as the game page's own chrome; the explainer gets the symmetric treatment. `Site.astro` serves `tokens.css` and the document scaffolding, each page brings its own stylesheet, and no rule is duplicated.

## Resolved during implementation

- **The dev middleware reaches the generators through `server.ssrLoadModule`, not the static import.** Astro loads `astro.config.mjs` once and does not watch its transitive TypeScript imports, so a statically imported `buildIllustrationFiles` stayed frozen at the version the dev server booted with — confirmed empirically: editing a generator kept serving the old SVG with no restart. Going through Vite's module graph puts the generators under Vite's own invalidation and restores the regenerate-per-request property the Vite plugin had.
- **Pages build with `build.format: 'file'`**, so they stay at `index.html` and `explainer.html` rather than moving to Astro's default directory URLs. The game's explainer link and any existing bookmarks already point there.
- **There is no prose-component layer at all.** The plan called for `<Figure>`, `<Figcaption>`, `<BoardFigure>`, `<WideFigure>`, `<Callout>` and four term spans. All nine were built and then dropped: every one was a single-line wrapper emitting a fixed tag and class, and MDX parses a raw `<figure class="board-figure">` exactly the way it parses a component — markdown children, math and `{figures[...]}` expressions all included (verified; the built page is byte-identical either way). `<Figure>` and `<Figcaption>` renamed an HTML element to itself, and `<BoardFigure>` emitting `.root-board-panel` beside a separate `.board-figure` class was actively misleading. So the article writes the elements, `src/explainer/components/` does not exist, and `<RevealDemo>` — the one thing that genuinely needs to be a component — is the only one left.

  The premise still holds: what MDX bought was not *these* components, it was the ability to have any at all, which is what killed `remark-directive`, `rehype-raw`, the alerts plugin, `directives.ts` and the `substituteFigures()` regex. Wrapping `<figcaption>` in `<Figcaption>` was not part of the payoff.
- **Three "untouched" tests had to be retargeted.** `figures.test.ts`, `illustrationFiles.test.ts` and `mathSyntax.test.ts` all imported `compileExplainer()` and read `explainer.html`/`explainer.md`, which tasks 4.5 and 6.3 required to keep passing unmodified while 6.1 deletes exactly what they import. They now assert against the `.mdx` source (`{figures['name']}`, `illustration('name')`, the `$`-delimited TeX) — no build required, which also matters because `npm test` gates `npm run build` in CI. Their assertions are preserved; only what they read changed.
