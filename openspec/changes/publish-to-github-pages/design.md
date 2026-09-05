## Context

The project is a static Vite app (two HTML entries: `index.html`, `explainer.html`) with no git history yet. `vite.config.ts` has two custom plugins that generate content Vite's own asset pipeline doesn't see: `explainerMarkdown` (compiles `explainer.md` into `explainer.html`'s shell via raw string manipulation in `transformIndexHtml`) and `explainerIllustrations` (emits standalone `.svg` files referenced by root-absolute `<img src="/assets/explainer/*.svg">` URLs baked into `explainer.md`). Vite's HTML transform does not rewrite `<img src="/...">` or `<a href="/...">` to account for a non-default `base` — that rewriting only applies to asset references it resolves through its own module graph (e.g. `<script type="module" src="/src/main.ts">`, `<link>` stylesheets). Everything produced by these two plugins, plus the one literal `href` string in `src/main.ts`, is therefore invisible to `base` and needs to be fixed by hand. See proposal.md for why this matters now (project loses its "root of the domain" assumption once hosted at `/entropy-minesweeper/`).

## Goals / Non-Goals

**Goals:**
- Every in-app link and generated asset URL resolves correctly under a configured `base` of `/entropy-minesweeper/`, with no hardcoded assumption of domain-root hosting.
- Deployment is push-to-deploy via GitHub Actions, gated on `vitest run` passing.

**Non-Goals:**
- Custom domain or CNAME setup — out of scope until/unless the user wants it later.
- Preserving a favicon — the missing `favicon.svg` reference is removed, not replaced.
- Rewriting the illustration/markdown plugins' architecture — only their output URLs change.

## Decisions

**Base path propagation: read `base` from Vite's resolved config inside the custom plugins, rather than hardcoding `/entropy-minesweeper/` in multiple places.**
Both `explainerMarkdown` and `explainerIllustrations` already run as Vite plugins with access to a `configResolved` hook. Reading `viteConfig.base` there and using it to prefix the emitted `<img src>` and the back-link `href` means the base path is defined in exactly one place (`vite.config.ts`), and dev vs. build stay consistent automatically (`base` defaults to `/` in dev regardless of the build config unless `vite dev --base` is passed, which is fine — dev already works today at root). Alternative considered: string-replace `/entropy-minesweeper/` literally into `explainer.md` and `explainer.html` — rejected because it duplicates the base path as a magic string in content files and silently breaks if the repo is ever renamed.

**`src/main.ts`'s `explainerLink.href`: use `import.meta.env.BASE_URL` instead of a literal `/explainer.html`.**
This is genuine browser-side JS bundled by Vite, so `import.meta.env.BASE_URL` (Vite's built-in constant, set from `base` at build time) is the direct, idiomatic fix — no custom plumbing needed, unlike the two plugin cases above which run outside Vite's module graph.

**Favicon: delete the `<link rel="icon">` tags rather than add a placeholder icon.**
Per user decision — simplest fix, no new asset to design/maintain, browser falls back to its default tab icon.

**CI: single workflow, `vitest run` before `vite build`, using `actions/deploy-pages`.**
Runs on push to the default branch. `npm ci` for reproducible installs from the existing lockfile, then tests, then `npm run build` (which itself runs `tsc` before `vite build`), then upload `dist/` as a Pages artifact and deploy. Rejected alternative: committing `dist/` to a `gh-pages` branch — would require un-ignoring `dist` and a second local build step to stay in sync; the Actions artifact approach keeps `dist/` fully derived and gitignored as it is today.

## Risks / Trade-offs

- [Vite's dev server always uses `base: '/'` regardless of the build's `base`, unless explicitly overridden] → not a real risk here since the affected paths are computed dynamically (`configResolved`/`BASE_URL`), so dev continues serving correctly at root and production correctly at the subpath, with no manual toggling.
- [First deploy requires a manual one-time step: creating the GitHub repo and flipping Settings > Pages to "GitHub Actions" as the source] → cannot be automated from inside this change; call it out explicitly in tasks.md so it isn't missed.
- [Removing the favicon `<link>` tags changes the browser tab icon to the default] → acceptable per explicit user decision; easily reversed later by re-adding a real icon file + tag.

## Migration Plan

1. Fix the hardcoded paths and `vite.config.ts` `base` first, verify locally with `npm run build && npm run preview -- --base /entropy-minesweeper/` (or equivalent) so the subpath behavior is validated before any push.
2. `git init`, initial commit. No `gh` CLI available, so stop and ask the user to create the GitHub repo via the web UI before adding the remote and pushing to the default branch.
3. Add the Actions workflow in the same or a follow-up commit; enable Pages (source: GitHub Actions) in repo settings.
4. First push to the default branch triggers the workflow and publishes the site.

No rollback beyond reverting the commit/workflow — there's no prior deployed state to preserve.
