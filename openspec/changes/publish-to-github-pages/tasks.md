## 1. Base path plumbing

- [x] 1.1 Set `base: '/entropy-minesweeper/'` in `vite.config.ts`
- [x] 1.2 Add a `configResolved` hook to the `explainerIllustrations` plugin that captures `viteConfig.base`, and prefix each emitted `<img>` source URL referenced from `explainer.md` with it; verify by building and confirming `dist/explainer.html` contains `src="/entropy-minesweeper/assets/explainer/...svg"` (not a bare `/assets/...` path)
- [x] 1.3 Add a `configResolved` hook to the `explainerMarkdown` plugin (or otherwise thread `base` through `compileExplainer`) and use it to rewrite the "Back to the game" anchor's `href` in the compiled `explainer.html`; verify by building and confirming `dist/explainer.html`'s back-link points at `/entropy-minesweeper/index.html`
- [x] 1.4 Replace `explainerLink.href = '/explainer.html'` in `src/main.ts` with `import.meta.env.BASE_URL + 'explainer.html'`; verify by building and confirming `dist/assets/main-*.js` no longer contains the literal string `/explainer.html`

## 2. Favicon cleanup

- [x] 2.1 Remove the `<link rel="icon" ...>` tag from `index.html` and `explainer.html`; verify by confirming neither file references `favicon.svg`

## 3. Local verification of subpath behavior

- [ ] 3.1 Run `npm run build`, then `npm run preview -- --base /entropy-minesweeper/` (or equivalent), and manually confirm in a browser: the game page loads, the explainer link navigates correctly, the explainer page's diagrams render, and the back-link returns to the game — all under the `/entropy-minesweeper/` prefix
- [x] 3.2 Run `vitest run` and confirm the full suite still passes after the above changes

## 4. Git and GitHub repo setup

- [ ] 4.1 Run `git init`, stage the project (respecting the existing `.gitignore`), and make an initial commit
- [ ] 4.2 Stop and ask the user to create a GitHub repository named `entropy-minesweeper` via the web UI (no `gh` CLI available), then add it as the `origin` remote once they confirm it exists
- [ ] 4.3 Push the initial commit to the default branch and verify it appears on GitHub

## 5. CI/CD workflow

- [ ] 5.1 Add `.github/workflows/deploy.yml`: triggers on push to the default branch, runs `npm ci`, then `vitest run`, then `npm run build`, then uploads `dist/` via `actions/upload-pages-artifact` and deploys via `actions/deploy-pages`; verify by pushing and confirming the workflow run succeeds in the Actions tab
- [ ] 5.2 In the GitHub repo's Settings > Pages, set the Pages source to "GitHub Actions" (manual one-time step)
- [ ] 5.3 Verify the published site loads at `https://<username>.github.io/entropy-minesweeper/` with working navigation between the game and explainer pages
