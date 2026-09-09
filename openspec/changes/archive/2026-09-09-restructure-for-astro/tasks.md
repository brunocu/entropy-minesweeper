## 1. Illustrations endpoint

Behavior-critical and verified against the current tree, so it lands before anything moves
(design.md — Migration Plan, step 1).

- [x] 1.1 Add `src/pages/assets/explainer/[name].svg.ts`: `getStaticPaths()` maps `buildIllustrationFiles()`
      to `{ params: { name }, props: { source } }` with the `.svg` suffix stripped from `name` (the extension
      comes from the filename, per design.md Decision 4); `GET` returns the source with
      `Content-Type: image/svg+xml` and `Cache-Control: no-cache`. Verify `npm run build` succeeds with the
      integration still registered.
- [x] 1.2 Verify the emitted paths: `ls dist/assets/explainer/` lists exactly the 7 `.svg` files
      `buildIllustrationFiles()` produces, as files and not as directories containing `index.html` — this is
      the `build.format: 'file'` risk in design.md — Risks, and the point at which it is settled.
- [x] 1.3 Verify the endpoint's output matches the integration's: with both registered, diff each emitted SVG
      against the integration's bytes. The generators are untouched, so any difference means the wiring is
      wrong.
- [x] 1.4 Verify dev serving: `npm run dev`, request each illustration URL under the configured `base`, and
      confirm 200 with `Content-Type: image/svg+xml`.
- [x] 1.5 Verify dev invalidation without a restart: edit a color in `src/explainer/boardSvg.ts`, refresh the
      illustration URL, confirm the change appears; then add a throwaway entry to `buildIllustrationFiles()`
      and confirm its new URL resolves (this exercises `getStaticPaths` re-evaluation, design.md Decision 4).
      Revert both edits.
- [x] 1.6 Remove `explainerIllustrations()` from `astro.config.mjs` and delete
      `src/explainer/illustrationsIntegration.ts` and `src/explainer/__tests__/illustrationsIntegration.test.ts`.
      Verify `npm run build` still emits the same 7 files and `npm test` passes.
- [x] 1.7 Keep `ILLUSTRATION_DIR` in `illustrations.ts` as the single name the article and tests use, and add
      an assertion to `illustrationFiles.test.ts` that it equals the endpoint's own directory — the endpoint's
      path is its filename and cannot read the constant, so this is a new duplication that needs pinning.
      Verify the test fails if either side is changed alone.

## 2. Design tokens via a virtual module

- [x] 2.1 Add a Vite plugin module resolving `virtual:tokens.css` through `renderTokensCss()`, placed where
      both `astro.config.mjs` and `vite.config.ts` can import it (Astro does not read `vite.config.ts` —
      design.md Decision 3). Verify it resolves by importing it in a scratch build.
- [x] 2.2 Register the plugin under `astro.config.mjs`'s `vite` key and in `vite.config.ts`, and change
      `src/layouts/Site.astro` to import `virtual:tokens.css`. Verify the built CSS carries every custom
      property from `tokens.ts` with the same values (order and whitespace may differ — design.md — Goals).
- [x] 2.3 Verify dev: `npm run dev` and confirm the game and explainer pages render with tokens applied, with
      no `predev` hook having run.
- [x] 2.4 Delete `scripts/generate-tokens.mjs`, the `predev` and `prebuild` entries in `package.json`,
      `src/design/tokens.css`, and `src/design/__tests__/tokensCss.test.ts`. Verify a clean build from a
      pristine tree: `rm -rf dist .astro && npm run build` succeeds with no pre-hook.

## 3. Move the logic tier to `src/lib/`

Tiers move in dependency order so a break is attributable to one tier (design.md — Risks).

- [x] 3.1 Move `src/board/`, `src/game/` and `src/solver/` (with their `__tests__/`) under `src/lib/`, and
      move `src/__tests__/support/` to `src/lib/__tests__/support/`. Update all import specifiers. Verify
      `npx tsc` is clean and `npm test` passes.
- [x] 3.2 Move `src/design/tokens.ts` and `src/design/renderTokensCss.ts` to `src/lib/`. Update importers
      (`boardRenderer.ts`, `uncertaintyChart.ts`, the token plugin). Verify `npx tsc` is clean.
- [x] 3.3 Create `src/lib/scale/` from `src/render/probabilityColor.ts` and `src/render/cellSolverValues.ts`
      with their tests. Update importers in `boardRenderer.ts`, `BoardCanvas.tsx`, `RevealDemo.tsx`,
      `boardSvg.ts` and `worldsTree.ts`. Verify `npm test` passes.
- [x] 3.4 Move the `UncertaintyHistoryPoint` interface out of `uncertaintyChart.ts` into `src/lib/`, closing
      the leak where build-time code imports a type from a module that side-effect-imports uPlot's CSS.
      Update `explainer/fixtures.ts`, `explainer/uncertaintyChartSvg.ts` and `UncertaintyChart.tsx`. Verify
      no module under `src/lib/` or `src/explainer/` imports from `src/components/`.

## 4. Move the renderer tier to `src/canvas/`

- [x] 4.1 Move `src/render/boardRenderer.ts` and `src/render/hitTest.ts` with their tests to `src/canvas/`.
      Keep `boardRenderer.test.ts`'s Canvas2D stub — it records `fillStyle` per `fillRect` and is the test's
      instrument, not an environment workaround (design.md Decision 5). Update importers in `App.tsx`,
      `Readouts.tsx`, `BoardCanvas.tsx` and `RevealDemo.tsx`. Verify `npm test` passes.
- [x] 4.2 Verify `src/render/` is now empty and remove it.

## 5. Move the site tier to `src/components/` and `src/styles/`

- [x] 5.1 Move `src/ui/*` to `src/components/` (`App.tsx`, `BoardCanvas.tsx`, `Toolbar.tsx`, `Readouts.tsx`,
      `UncertaintyChart.tsx`, `boardQueries.ts`, and `__tests__/boardUi.test.tsx`). Update
      `src/pages/index.astro`. Verify `npm test` passes and `npm run build` succeeds.
- [x] 5.2 Move `src/render/uncertaintyChart.ts` to `src/components/`, beside its one consumer. Update
      `UncertaintyChart.tsx` and its test. Verify `npm test` passes.
- [x] 5.3 Move `src/explainer/RevealDemo.tsx` and `src/explainer/__tests__/revealDemo.test.tsx` to
      `src/components/`. Update the import in `src/pages/explainer.mdx`. Verify the explainer page still
      hydrates the demo in `npm run dev`.
- [x] 5.4 Move `src/design/game.css` and `src/design/explainer.css` to `src/styles/`. Update the imports in
      `src/pages/index.astro` and `src/layouts/Explainer.astro`. Verify both pages render with their styling
      intact in a built preview.
- [x] 5.5 Verify `src/design/` and `src/ui/` no longer exist and that `src/explainer/` contains only
      build-time generators (no `.tsx`, nothing importing `solid-js`).

## 6. Re-scope the test runner

- [x] 6.1 Re-scope the Vitest projects in `vite.config.ts` from extension globs to directory globs:
      node covers `src/{lib,explainer}`, jsdom covers `src/{components,canvas}` (design.md Decision 5).
      Correct the file's header comment, which no longer describes a Vitest-only config.
- [x] 6.2 Verify both projects collect the files they should: the collected count across both projects equals
      the total test file count, and no test file is silently uncollected by falling outside every glob.
- [x] 6.3 Verify the boundary is enforced rather than declared: temporarily add a `document.title` reference
      to a module under `src/lib/`, confirm its test fails under the node project, then revert.

## 7. Remove dead code and non-behavioral tests

- [x] 7.1 Delete `src/main.tsx`. Verify nothing imports it (`grep -r "main.tsx" src astro.config.mjs
      vite.config.ts package.json` is empty) and `npm run build` succeeds.
- [x] 7.2 Delete `src/explainer/__tests__/articleMarkup.test.ts` and
      `src/explainer/__tests__/mathJaxLoading.test.ts`, and drop from
      `__tests__/support/explainerSource.ts` any helper left with no callers. Verify `npm test` passes and
      `mathSyntax.test.ts` and `illustrationFiles.test.ts` still run.
- [x] 7.3 Delete `src/lib/solver/__tests__/cachePerformance.test.ts`. Verify `instrumentation.ts` still has
      importers (`bottleneckProfile.test.ts` and others) and `npx tsc` is clean.
- [x] 7.4 Verify the kept harnesses are untouched and still runnable: `PROFILE=1 npm test` exercises
      `bottleneckProfile.test.ts` and `SNAPSHOT=1 npm test` exercises `explanationSnapshot.test.ts`, while a
      plain `npm test` skips both.

## 8. Final verification

- [x] 8.1 Verify the full gate the CI workflow runs: `npm ci && npm test && npm run build` from a clean
      checkout, with no `predev`/`prebuild` hooks present.
- [x] 8.2 Verify the site is visually and functionally identical: build and preview, then check the game page
      (board renders, difficulty switch, reveal, flag, uncertainty chart, hover readouts) and the explainer
      page (all 7 illustrations load, MathJax typesets, figures interpolate, the reveal demo hydrates, and
      both cross-page links resolve under the configured `base`).
- [x] 8.3 Verify the tier graph has no upward edges: nothing in `src/lib/` imports from `src/components/`,
      `src/canvas/`, `src/pages/` or `src/explainer/`, and nothing in `src/explainer/` imports from
      `src/components/` or `src/canvas/`.
