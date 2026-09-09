## Context

See proposal.md — Why. Three facts about the current tree shape every decision below.

**Astro reserves almost nothing.** `src/pages/` is the only reserved directory; `components/`, `layouts/`
and `styles/` are documented conventions, and Astro offers no guidance at all on where non-component
TypeScript modules go. "Follow Astro's recommended structure" therefore constrains only the site edge of
the tree. Everything else is a judgement this project has to make on its own merits.

**The existing dependency graph is already correct.** `board <- game <- ui`, `solver <- explainer`, no
cycles, no upward edges. The problem is not the graph, it is that directory names stopped matching what
the modules do — so the graph's correctness is invisible and unenforced.

**Two prior decisions were made under constraints that no longer exist.**
`unify-design-tokens` design.md decision 1 chose "deliberately plain Node with no build-tool coupling"
in a repo that had no build tool. `migrate-explainer-to-astro-mdx` chose to stay on Astro's own extension
points, and paid 103 lines for it, because it read `astro:build:done` as the way to emit generated files.
Astro's integration reference contradicts that reading directly: the hook "is not for generating new content
into output — it's for post-processing what was already built." Both decisions are revisited here, and both
are revisited because their premises changed, not because they were wrong when made.

## Goals / Non-Goals

**Goals:**

- Directory names that predict a module's runtime: browser, Node-at-build-time, or neither.
- The tier boundary enforced mechanically by the test runner, not by convention or review.
- Delete plumbing the framework already provides, keeping the code that carries real logic.
- A visually and functionally identical site: same URLs, same rendered pages, same illustrations. Byte-level
  differences in generated CSS or markup are acceptable where nothing observable changes.

**Non-Goals:**

- No behavior change of any kind. Every requirement in `openspec/specs/` holds unchanged; the change sets
  `skip_specs: true` for that reason.
- No changes to solver, board, or game logic. Those modules move and their import lines change; nothing
  else in them does.
- No new dependencies, and no adoption of a design-token framework (see Decision 3).
- Not a test-coverage change. Tests are removed only where they assert against source text rather than
  behavior, or where the code under test is deleted.
- Content collections (`src/content/`) are not adopted. There is one article; a collection would add a
  schema and a query layer to serve a single file.

## Decisions

### Decision 1: Four tiers, split by runtime rather than by feature

```
   src/pages  layouts  styles  components     the site        (browser + Astro)
   src/canvas                                 the renderer    (browser, needs Canvas2D)
   src/lib                                    the logic       (pure: no DOM, no fs)
   src/explainer                              the content     (Node, build time only)
```

The frontend/logic line is drawn where the *runtime* actually differs, and mapping it against the code shows
the current `src/render/` is the only directory straddling it:

| module | touches | tier |
| --- | --- | --- |
| `probabilityColor.ts` | tokens, hex arithmetic | pure |
| `cellSolverValues.ts` | `SolveResult` only | pure |
| `hitTest.ts` | integer arithmetic | pure |
| `boardRenderer.ts` | `CanvasRenderingContext2D` | browser |
| `uncertaintyChart.ts` | `HTMLElement`, uPlot, a CSS import | browser |

`board/`, `game/` and `solver/` touch no browser API at all and move to `lib/` unchanged.

*Alternative considered — two tiers, `lib/` and everything else.* Rejected because `explainer/` is neither.
It is pure Node that runs during the build and ships nothing to a browser, and folding it into `lib/` loses
exactly the distinction the split exists to make. Three runtimes, three homes, plus the site.

*Alternative considered — `src/client/` mirroring `src/lib/` for symmetry.* Rejected: it would displace
`src/components/`, an Astro convention, for the sake of a naming pattern.

### Decision 2: `src/canvas/` keeps the renderer whole; only the pure vocabulary leaves

`boardRenderer.ts` and `hitTest.ts` are the forward and inverse of one transform:

```
   boardRenderer:  (row, col), cellSize  -->  pixels     paint
   hitTest:        pixels,     cellSize  -->  (row, col) unpaint
```

Splitting them across tiers would put a coordinate system's two halves in different places for a purity
technicality. They stay together, and the directory is named for the surface they require — a
`CanvasRenderingContext2D` — which is what defines the tier.

`probabilityColor.ts` and `cellSolverValues.ts` are *not* renderer internals. `cellSolverValues.ts` says so
in its own header: three renderers — the live canvas, the explainer's runtime demo, and the explainer's
static SVGs — "must agree on it, or one of them shows a different heatmap for the same position." They are
shared value-to-visual-channel mappings, which is `scale` in d3's vocabulary, hence `src/lib/scale/`.

*Alternative considered — `lib/heatmap/`.* Reads better but over-narrows: `probabilityColor.ts` also exports
the pole colors `worldsTree.ts` uses for tree branches, which is no heatmap.

*Alternative considered — keeping the name `render/`.* Rejected: `components/` also renders, and that
collision is the ambiguity the rename exists to remove.

`uncertaintyChart.ts` is a uPlot wrapper, a different renderer with one consumer, `UncertaintyChart.tsx`.
It moves beside it into `components/` rather than into `canvas/`, which it has nothing to do with.

### Decision 3: Tokens through an in-repo Vite virtual module, not a design-token framework

The derivation is eighteen lines and already correct. What goes is the apparatus around it: a Node script,
two npm lifecycle hooks, a committed `tokens.css`, and a test asserting that committed file is current.
`Site.astro` imports `virtual:tokens.css` instead.

The freshness test disappears as a consequence rather than a decision — there is no longer an artifact that
*can* go stale.

*Alternative considered — vanilla-extract* (actively maintained, official Astro support). Rejected on a
directional mismatch. Its JS side returns CSS variable *references*, not values, and this project needs
values in three places that would each fail:

```js
ctx.fillStyle = tokens.mine   // Canvas2D: invalid value, silently ignored
probabilityColor(0.5)         // mixes hex arithmetically — cannot interpolate a var()
renderBoardSvg(...)           // standalone SVG, in Node, at build time — no :root exists
```

The last is decisive and already pinned by `illustrationFiles.test.ts`, which asserts each generated SVG
stands alone with "no external CSS applies." A `var(--safe)` inside one resolves to nothing. The
`createGlobalTheme(':root', tokens)` workaround exists but yields hashed variable names, so the hand-written
`game.css` and `explainer.css` — which reference plain `--safe`, `--mine` — would need a
`createGlobalThemeContract` with a naming function. Two dependencies and a contract to replace one
`Object.entries().map()`.

*Alternative considered — style-dictionary.* Active, but has no Vite plugin; it would leave the build script
this change is removing.

The plugin module is placed so both `astro.config.mjs` and `vite.config.ts` can import it. Astro does not
read `vite.config.ts` — it has its own `vite` key — and without a single shared module the plugin becomes
two copies that drift.

### Decision 4: A static file endpoint replaces the illustrations integration

```
   src/pages/assets/explainer/[name].svg.ts

   getStaticPaths()  ->  buildIllustrationFiles().map(f => ({ params, props }))
   GET({ props })    ->  new Response(props.source, { headers: { ... } })
```

Astro's endpoint documentation supplies the mechanics: "The `.js` or `.ts` extension will be removed during
the build process, so the name of the file should include the extension of the data you want to create."
The extension comes from the filename, not from a Content-Type header, and `getStaticPaths` params carry no
extension — `{ name: 'worlds-tree-eig' }`, not `{ name: 'worlds-tree-eig.svg' }`.

The integration's central problem was that `astro.config.mjs` is loaded once and its transitive TypeScript
imports are never watched, so `buildIllustrationFiles` was frozen at server boot. It solved this by calling
back into Vite through `server.ssrLoadModule` and caching on module identity. An endpoint is a route module
inside that graph already, and Astro's own route cache performs the identical check — from
`core/render/route-cache.ts`: "After HMR, `mod` is a new object from a fresh `import()`. If the cached entry
was produced by a previous module instance, treat it as stale so `getStaticPaths()` is re-called." Combined
with recursive invalidation of importers, editing a generator invalidates the endpoint, which yields a new
module instance, which re-calls `getStaticPaths` — so adding or removing an illustration works in dev with
no restart. The hand-rolled cache is deleted rather than ported because the framework performs it.

`Cache-Control: no-cache` is set explicitly on the `Response`, matching what the middleware sets today.
Astro only falls back to that header when validators are present, and dev behavior should not change.

*Alternative considered — generating into `public/` from a script*, converging with the token script instead
of against it. Rejected once Decision 3 removed that script: it would have reintroduced a committed
generated tree and a second freshness test, and `public/` is documented as "copied into the build folder
untouched," which is a poor fit for output derived from the solver.

*Alternative considered — keeping the integration and only moving files.* Rejected: it preserves 103 lines
whose entire purpose is reimplementing framework behavior, and the proposal's aim is the minimum actually
needed.

### Decision 5: Vitest projects scoped by directory, making the tier boundary executable

```
   before                          after
   ------                          -----
   node  : src/**/*.test.ts        node  : src/{lib,explainer}/**/*.test.*
   jsdom : src/**/*.test.tsx       jsdom : src/{components,canvas}/**/*.test.*
```

Today the split is by file extension, a proxy for "is this a component." After the move it is by directory,
and it means something enforceable: anything under `lib/` or `explainer/` that reaches for `document` fails
in the environment that proves it, immediately, without anyone reviewing for it.

`boardRenderer.test.ts` moves into the jsdom project as a consequence of the directory rule, and its
hand-rolled Canvas2D stub stays. jsdom does not implement `getContext('2d')` without the optional `canvas`
package, so the existing jsdom test `revealDemo.test.tsx` already monkey-patches
`HTMLCanvasElement.prototype.getContext` for the same reason. The stub is also not merely a shim: it records
the `fillStyle` in effect at each `fillRect`, which is how the test recovers per-cell colors, so it would be
needed against a real context too. No environment change removes it.

The two-project split itself is unchanged and still necessary — `vite-plugin-solid` prepends the `browser`
export condition in test mode, which sends Markdown-toolchain packages to DOM builds that touch `document`
at import time. Only the `include` globs change.

### Decision 6: Test removals are scoped to non-behavioral assertions

Removed because they assert against source *text* rather than behavior, and would need rewriting against
moved files without becoming more useful: `articleMarkup.test.ts` (regexes the MDX for lone inline JSX) and
`mathJaxLoading.test.ts` (greps `Site.astro` for `integrity=` and counts `is:inline`). Both are lint rules in
test form.

Removed because the code under test is gone: `illustrationsIntegration.test.ts`, `tokensCss.test.ts`.

Removed for inconsistency: `cachePerformance.test.ts` runs unguarded in CI, asserting call counts from a
scan of an Expert board, while its two siblings sit behind `PROFILE` and `SNAPSHOT`.

Explicitly kept: `bottleneckProfile.test.ts` and `explanationSnapshot.test.ts` remain valuable for future
optimization work and are already guarded out of CI, so `instrumentation.ts` stays in full.
`mathSyntax.test.ts` stays untouched — it runs every formula through MathJax's actual TeX grammar, catching
math that would otherwise ship as red error text on the live page. `illustrationFiles.test.ts` stays and is
rewired to the endpoint; it is what pins generated output byte-for-byte and catches an article referencing
an illustration nothing generates.

## Risks / Trade-offs

**Endpoint output path under `build.format: 'file'` is documented but unproven here** → Astro's config
reference scopes `build.format` to page routes and the endpoint guide derives the extension from the
filename, so `dist/assets/explainer/<name>.svg` is expected. The known issues on this axis (#7422, #11575)
concern the *sitemap integration* emitting wrong URLs, and #9674 concerns `trailingSlash: 'always'` — this
project runs neither. Mitigation: the endpoint is added and a build verified against `dist/` *before* the
integration is deleted, so the fallback is simply not deleting it.

**A large mechanical move can silently drop a file or leave a stale import** → `tsc` runs in `npm run build`
with `noUnusedLocals`, and the full suite runs before it in CI. Mitigation: move in tier order —
`lib/` first, then `canvas/`, then `components/`, then `explainer/` — running `npm test` after each, so a
break is attributable to one tier rather than to the whole reshuffle.

**Git history becomes harder to follow across renamed paths** → unavoidable for a restructure of this size,
and `git log --follow` handles pure renames. Mitigation: move files and rewrite imports in commits separate
from any content edit, so renames stay detectable as renames.

**Client-side auto-reload for an endpoint-only edit is undocumented** → editing a module the article does not
also import (`boardSvg.ts`, `certaintyBoard.ts`, `uncertaintyChartSvg.ts`) refreshes the server but pushes
nothing to the browser, so an `<img>` needs a manual refresh. This is identical to today's middleware, which
is also outside any HMR graph — it is not a regression, and it should be recorded as observed behavior
rather than a guarantee.

**The virtual module makes `vite.config.ts` no longer "Vitest only"**, contradicting its own header comment →
the shared plugin module is imported by both configs and the comment is corrected as part of the move.

## Migration Plan

1. Add the endpoint alongside the still-registered integration; build; confirm the SVGs land at
   `dist/assets/explainer/*.svg`. The generators are untouched, so a byte comparison is the cheapest way to
   check this one — not because the bytes matter, but because any difference means the wiring is wrong.
   Only then delete the integration and its test.
2. Add the token virtual module; point `Site.astro` at it; delete the script, the hooks, the committed
   `tokens.css`, and the freshness test. The emitted CSS need only carry the same custom properties with the
   same values; declaration order and whitespace are free to differ.
3. Move tiers in dependency order — `lib/`, `canvas/`, `components/`, `explainer/` — running `npm test`
   between each.
4. Re-scope the Vitest project globs; confirm both projects still collect the files they should.
5. Delete `src/main.tsx` and the tests listed in Decision 6.

Rollback is `git revert` at any step; no published output, deployment configuration, or data is touched.
