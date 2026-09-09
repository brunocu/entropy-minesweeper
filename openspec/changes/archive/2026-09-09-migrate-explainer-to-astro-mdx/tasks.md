## 1. Astro alongside the existing build

- [x] 1.1 Confirm the `markdown.processor` contract against Astro 7's configuration reference before writing any config: which package supplies the processor (`@astrojs/markdown-remark` is no longer installed with `astro` since Sätteri became the default), what its factory is called, and whether plugins are passed as arguments or attached with `.use()`. Verified by recording the exact import and call signature in design.md — Decision 2, which currently guesses `unified({ remarkPlugins: [...], rehypePlugins: [...] })`.
- [x] 1.2 Confirm whether Astro exposes a dev-server integration hook that can register middleware (design.md names `astro:server:setup`, unverified). Verified by recording either the confirmed hook name in design.md — Decision 3 or the decision to fall back to that decision's `public/` alternative. Do this before 3.1, since it determines the integration's shape.
- [x] 1.3 Install `astro`, `@astrojs/mdx`, `@astrojs/solid-js`, and the processor package identified in 1.1. Verified by `npm install` succeeding and `npx astro --version` reporting 7.x.
- [x] 1.4 Add `astro.config.mjs` with `site`, `base: '/entropy-minesweeper/'`, the two integrations, and the `markdown.processor` from 1.1 carrying only `remark-math` and `rehype-mathjax` (`rehype-mathjax/browser`, matching today's client-side typesetting). Leave `vite.config.ts` and both `.html` entries in place. Verified by `npx astro build` completing on the empty page set.
- [x] 1.5 Add `astro` dev/build/preview scripts under distinct names so the Vite build still runs, keeping the `generate-tokens.mjs` pre-step on each. Verified by both build commands succeeding from a clean `dist/`.

## 2. Shared layout and the game page

- [x] 2.1 Add the shared layout serving `src/design/tokens.css`, the page chrome, and the MathJax config plus CDN script (with its `integrity` hash) currently inlined in `explainer.html`. Verified by an Astro build emitting a page whose `<head>` carries the token stylesheet and the MathJax script tag.
- [x] 2.2 Port `index.html` to an Astro page using the layout, mounting the Solid game as an island. Verified by loading the dev server and playing a move — reveal, flag, and the uncertainty chart all respond.
- [x] 2.3 Route the game↔explainer links through `import.meta.env.BASE_URL` rather than the current `/index.html` (design.md — Decision 6). Verified by the built page containing `/entropy-minesweeper/` in both links, and by `astro preview` navigating between the two pages without a 404.
- [x] 2.4 Decide whether the explainer's prose styles live in the layout or stay page-scoped (design.md — Open Question 2), based on what `unify-design-tokens` already lifted. Verified by the chosen file containing them and no rule being duplicated across both.

## 3. Illustrations through an Astro integration

- [x] 3.1 Write the integration's build side: an `astro:build:done` hook that resolves `dir` with `fileURLToPath()` and writes every entry of `buildIllustrationFiles()` into the output directory under `ILLUSTRATION_DIR`. Verified by a build producing each expected `.svg` at the same path the current Vite plugin emits.
- [x] 3.2 Write the dev side using the hook confirmed in 1.2 — middleware answering the same URLs from `buildIllustrationFiles()` in memory, regenerating per request. Verified by requesting an illustration URL from the dev server, editing a generator, and seeing the change on reload without a restart.
- [x] 3.3 Add a build-output assertion that every filename `buildIllustrationFiles()` yields exists in the built bundle. Verified by the new test failing when an entry is removed from the integration's write loop and passing with it restored.

## 4. MDX conversion

- [x] 4.1 **(superseded — the components were built, then dropped as one-line wrappers; see design.md, Resolved during implementation. The article writes the elements directly and `proseComponents.test.tsx` is gone with them.)** Add the explainer components — `<Figure>`, `<Figcaption>`, `<BoardFigure>`, `<WideFigure>`, `<Safe>`, `<Mine>`, `<Clue>`, `<Premise>` — emitting the same elements and classes the current directives and raw HTML produce. Verified by unit tests rendering each component and asserting its class list.
- [x] 4.2 Rename `explainer.md` to `explainer.mdx`, wire it to the layout, and convert exactly one figure — one carrying both a `class` attribute and a multi-line `<img>` — then build. Verified by the build succeeding and the emitted markup matching the current output for that figure; this is the cheap settlement of the JSX-attribute risk before the remaining 47 lines.
- [x] 4.3 Convert the remaining 24 `:::` block directives and 4 `:term-*` inline directives to components. Verified by the build succeeding and no `:::` or `:term-` sequence remaining in `explainer.mdx`.
- [x] 4.4 **(kept as raw `<div>`s — see 4.1)** Convert the `<div class="root-board-panel">` and `<div class="figure-scroll">` wrappers to `<BoardFigure>` / `<WideFigure>`. Verified by the built page carrying the same wrapper classes as the current output.
- [x] 4.5 Replace the 11 `<span data-figure="...">` placeholders with `{figures['...']}` expressions reading a direct import of `computeFigureValues()` (design.md — Decision 5). Verified by the built page quoting the same numbers as the current build, and by `figures.test.ts` continuing to pass untouched.
- [x] 4.6 **(resolved: plugin dropped, article writes `<div class="callout">`)** Decide the two GitHub alerts (design.md — Open Question 1): a `<Callout>` component or keeping `remark-github-markdown-alerts` in the processor. Verified by the built page rendering both callouts with the `.callout` class either way.
- [x] 4.7 Confirm math survives the conversion. Verified by the built page containing `\(`/`\[`-delimited TeX for all 168 `$` delimiters' worth of formulas, and by `mathSyntax.test.ts` passing against the new source.

## 5. The demo island

- [x] 5.1 Convert `src/explainer/revealDemo.ts` into a `<RevealDemo />` Solid component owning its own canvas, reset button, narration, and the predicted/realized readouts, dropping the five element IDs it currently queries. Verified by a component test driving a reveal and asserting the readouts update.
- [x] 5.2 Replace the raw-HTML demo block in `explainer.mdx` with `<RevealDemo client:visible />` and delete `src/explainer/main.ts`. Verified in the browser: the demo is inert until scrolled to, then reveals cells and shows predicted alongside realized.

## 6. Removal and test rewrite

- [x] 6.1 Delete `src/explainer/compileExplainer.ts`, `src/explainer/directives.ts`, `explainer.html`, `index.html`, and the `explainerMarkdown()` / `explainerIllustrations()` plugins from `vite.config.ts`, keeping the file's Vitest projects and Solid test plumbing intact. Verified by `npm test` running with both projects still configured.
- [x] 6.2 Uninstall `remark-directive`, `rehype-raw`, `rehype-stringify`, `remark-parse`, `remark-rehype`, and `remark-github-markdown-alerts` if 4.6 dropped it. Verified by `npm run build` succeeding with those absent from `package.json`.
- [x] 6.3 Delete `compileExplainer.test.ts`, `directives.test.ts`, and `explainerPage.test.ts`, replacing them with tests against the new structure — the components from 4.1 and the built page's structure. Verified by `npm test` passing with the new tests present and the generator tests (`figures.test.ts`, `illustrationFiles.test.ts`, `mathSyntax.test.ts`, `boardSvg.test.ts`, `worldsTree.test.ts`, and the rest) unmodified.

## 7. Deployment

- [x] 7.1 Point `package.json`'s `dev`/`build`/`preview` at Astro as the primary scripts, keeping the `generate-tokens.mjs` pre-step, and `tsc` in the build gate. Verified by `npm run build` producing `dist/` with both pages and every illustration.
- [x] 7.2 (no change needed — the build command is still `npm run build`) Update `.github/workflows/deploy.yml`'s build command if 7.1 changed it, leaving the `npm test` gate and `dist` artifact path. Verified by the workflow's build and test steps running locally in sequence without error.
- [x] 7.3 Human review of the rendered explainer at the deployed subpath — math typesetting, every illustration, figure captions, the quoted figures, and the demo. Verified by explicit sign-off; this environment has no headless browser and cannot check any of it, and this change alters how every visible thing on the page is produced.
