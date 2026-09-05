## Why

The project has no git repository, no GitHub remote, and no deploy pipeline, so it cannot be published anywhere yet. Several hardcoded root-absolute paths in the HTML/JS (explainer link, back-link, favicon references, generated illustration `<img>` tags) also assume the site is served from domain root, which breaks once it's hosted as a GitHub Pages project site at `/entropy-minesweeper/`.

## What Changes

- Initialize a git repository, make an initial commit, create a GitHub repo named `entropy-minesweeper`, and push.
- Set `base: '/entropy-minesweeper/'` in `vite.config.ts` so Vite-managed asset URLs resolve correctly under the project-page subpath.
- Fix hardcoded root-absolute references that Vite's build does not rewrite, so they resolve relative to the deployed base path instead of domain root:
  - `src/main.ts`: `explainerLink.href = '/explainer.html'`
  - `explainer.html`: the "Back to the game" anchor's `href="/index.html"`
  - the explainer illustration plugin's generated `<img src="/*.svg">` references
- Remove the `<link rel="icon" href="/favicon.svg">` tags from `index.html` and `explainer.html` (the referenced file doesn't exist; **BREAKING** in the sense that the tab icon reverts to the browser default rather than a custom one — no functional impact).
- Add a GitHub Actions workflow that on push to the default branch runs `npm ci`, `vitest run`, then `npm run build` (`tsc && vite build`), and deploys the resulting `dist/` to GitHub Pages via `actions/upload-pages-artifact` + `actions/deploy-pages`.

## Capabilities

### New Capabilities
- `deployment`: the project is published as a static site on GitHub Pages at a project-page subpath, with in-app navigation and assets resolving correctly under that subpath, and an automated CI pipeline that gates deployment on the test suite passing.

### Modified Capabilities
(none — no existing capability's behavior changes; navigation/link resolution under a subpath is new deployment-surface behavior, not a change to how the board, solver, or explainer already behave)

## Impact

- **Build config**: `vite.config.ts` (`base` option).
- **App code**: `src/main.ts`, `explainer.html`, `index.html`, `src/explainer/illustrations.ts` (or wherever illustration `<img>` URLs are generated).
- **New files**: `.github/workflows/deploy.yml`, `.git/` (repo init).
- **Manual one-time steps outside this change's automatable scope**: creating the GitHub repo itself via the web UI (no `gh` CLI available) before the first push can succeed, and enabling "GitHub Actions" as the Pages source in the repo's Settings > Pages UI.
