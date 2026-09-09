## Why

The repository grew one change at a time, and three migrations landed on top of a layout that predates all
of them: `unify-design-tokens` built a Node script for a repo with no build tool, `port-game-ui-to-solid`
added Solid components beside a Vite SPA entry point, and `migrate-explainer-to-astro-mdx` adopted Astro
without revisiting either. What is left works, but it carries a dead entry point, a hand-rolled Astro
integration reimplementing a cache the framework already has, a generated file committed to git with a test
policing its freshness, and directories whose names no longer describe what is in them.

Nothing here is a bug. The cost is that the tree no longer tells you where anything belongs — and two of the
three decisions above were made under constraints that Astro's adoption has since removed.

## What Changes

**Directory layout — four tiers, each with one meaning**

- `src/pages` `src/layouts` `src/components` `src/styles` — the site, on Astro's documented conventions
  (`src/pages` is the only directory Astro reserves; the rest are conventions worth following)
- `src/canvas` — the bespoke Canvas2D board renderer (`boardRenderer.ts` + `hitTest.ts`)
- `src/lib` — pure logic: no DOM, no filesystem (`board/ game/ solver/ scale/`, `tokens.ts`)
- `src/explainer` — build-time content generation only; runs in Node, never shipped to a browser

- `src/design/` is dissolved: `tokens.ts` and `renderTokensCss.ts` to `src/lib/`, the CSS to `src/styles/`
- `src/render/` is split along the line its contents already fall on: `probabilityColor.ts` and
  `cellSolverValues.ts` are pure and shared by three renderers, so they become `src/lib/scale/`;
  `boardRenderer.ts` and `hitTest.ts` are the forward and inverse of one coordinate transform and stay
  together as `src/canvas/`; `uncertaintyChart.ts` is a uPlot wrapper with exactly one consumer and moves
  beside it into `src/components/`
- `RevealDemo.tsx` moves out of `src/explainer/` into `src/components/` — it is a browser island, not a
  build-time generator

**Illustrations — an Astro endpoint replaces the custom integration**

- `src/explainer/illustrationsIntegration.ts` (103 lines) is replaced by a static file endpoint at
  `src/pages/assets/explainer/[name].svg.ts` (~15 lines). The generators themselves are untouched.
- The integration existed to make one URL answer in both `astro dev` and `astro build`. Endpoints do that by
  definition, and being inside Vite's module graph they get the invalidation the integration hand-rolled
  with `ssrLoadModule` and a module-identity check.
- Emitted URLs are unchanged, so nothing the article or the deployed site references moves, and the
  rendered site stays visually and functionally identical.

**Design tokens — the build-tool-independence constraint is retired**

- `unify-design-tokens` chose a plain Node script explicitly to avoid coupling to a build tool, in a repo
  that had none. Astro is now that build tool, and the constraint no longer buys anything.
- `scripts/generate-tokens.mjs`, the `predev`/`prebuild` hooks, the committed `src/design/tokens.css`, and
  the freshness test that policed it are all replaced by a small in-repo Vite plugin serving
  `virtual:tokens.css`. No new dependencies.
- `renderTokensCss.ts` — the actual derivation — is kept verbatim. It was never the problem.

**Test suite**

- Vitest projects are re-split by directory rather than by file extension, so the tier boundary and the
  environment boundary become the same line: `src/{lib,explainer}` under node, `src/{components,canvas}`
  under jsdom.
- Removed: `articleMarkup.test.ts` and `mathJaxLoading.test.ts` (lint rules in test form, asserting against
  source text), `illustrationsIntegration.test.ts` (tests code being deleted), `tokensCss.test.ts` (guards a
  generated artifact that no longer exists), `cachePerformance.test.ts` (unguarded performance assertions in
  CI, unlike its two siblings).
- Kept unchanged: `bottleneckProfile.test.ts` and `explanationSnapshot.test.ts` — manual investigation
  harnesses behind `PROFILE` / `SNAPSHOT`, valuable for future optimization work — and `instrumentation.ts`,
  which exists for them.
- Kept, rewired: `illustrationFiles.test.ts` (points at the endpoint instead of the integration) and
  `mathSyntax.test.ts` (unchanged; it parses every formula through MathJax's TeX grammar and catches math
  that would otherwise ship as red error text).

**Dead code**

- `src/main.tsx` — the Vite SPA entry point, orphaned when `index.astro` began mounting `<App>` itself.
  Zero importers.

## Capabilities

### New Capabilities

None. This change introduces no behavior.

### Modified Capabilities

None. Every requirement under `openspec/specs/` describes observable behavior — deployed URLs resolving
under the subpath, illustrations loading, deployment gated on tests — and all of them hold unchanged. The
`.openspec.yaml` sets `skip_specs: true`.

## Impact

**Moved:** every file under `src/` except `src/pages/*` and `src/layouts/*`. Import specifiers change
throughout; no module contents change except for import lines.

**Deleted:** `src/main.tsx`, `src/explainer/illustrationsIntegration.ts`,
`src/explainer/__tests__/illustrationsIntegration.test.ts`, `src/explainer/__tests__/articleMarkup.test.ts`,
`src/explainer/__tests__/mathJaxLoading.test.ts`, `src/design/__tests__/tokensCss.test.ts`,
`src/solver/__tests__/cachePerformance.test.ts`, `scripts/generate-tokens.mjs`, `src/design/tokens.css`,
and the `src/design/` and `scripts/` directories.

**Added:** `src/pages/assets/explainer/[name].svg.ts`, and one small Vite plugin module for
`virtual:tokens.css` — placed so both `astro.config.mjs` and `vite.config.ts` can import it, since Astro
does not read `vite.config.ts`.

**Config:** `astro.config.mjs` drops the `explainerIllustrations()` integration and gains the token plugin
under its `vite` key. `vite.config.ts` gains the token plugin and re-scoped test projects. `package.json`
drops `predev` and `prebuild`. `tsconfig.json` is unaffected (`include: ["src"]`).

**Dependencies:** unchanged. `mathjax-full` stays for `mathSyntax.test.ts`. No package is added.

**CI:** `.github/workflows/deploy.yml` is unaffected — `npm ci && npm test && npm run build` still holds,
and the build no longer depends on a `prebuild` hook having run.

**Risk:** the endpoint's emitted path under `build.format: 'file'` is documented but unproven here. Astro's
endpoint docs state the extension comes from the filename and scope `build.format` to page routes, so
`dist/assets/explainer/<name>.svg` is expected; `illustrationFiles.test.ts` plus a build check confirm it
before the integration is deleted.
