import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'
import { compileExplainer } from './src/explainer/compileExplainer.ts'
import { buildIllustrationFiles, ILLUSTRATION_DIR } from './src/explainer/illustrations.ts'

const EXPLAINER_HTML = resolve(import.meta.dirname, 'explainer.html')
const EXPLAINER_MD = resolve(import.meta.dirname, 'explainer.md')

/**
 * Compiles `explainer.md` into `explainer.html`'s shell (compile-explainer-from-markdown
 * design.md decision 2). `transformIndexHtml` fires per-entry in both `vite dev` and
 * `vite build`, so one hook covers both without a separate dev-middleware path; it's scoped to
 * the explainer entry via `ctx.filename` so `index.html` is untouched.
 */
function explainerMarkdown(): Plugin {
  let base = '/'

  return {
    name: 'explainer-markdown',

    configResolved(viteConfig) {
      base = viteConfig.base
    },

    async transformIndexHtml(html, ctx) {
      if (ctx.filename !== EXPLAINER_HTML) return html
      const markdown = await readFile(EXPLAINER_MD, 'utf8')
      const compiled = compileExplainer(html, markdown)
      return compiled.replace('href="/index.html"', `href="${base}index.html"`)
    },

    /**
     * `explainer.md` is read via `readFile` above, not imported as a module, so it never enters
     * Vite's module graph and editing it triggers nothing by default. Watching it explicitly and
     * forcing a full reload re-runs `transformIndexHtml` on the client's next request, the same
     * way editing `explainer.html` itself already does.
     */
    configureServer(server) {
      server.watcher.add(EXPLAINER_MD)
      server.watcher.on('change', (file) => {
        if (file === EXPLAINER_MD) server.hot.send({ type: 'full-reload', path: '*' })
      })
    },
  }
}

/**
 * Generates the explainer's illustrations from the real solver code and publishes them as
 * standalone `.svg` files (add-explainer-page design.md decision 2a). `explainer.html` links to
 * them by a fixed URL, so the same path has to work in both modes: a build writes the files
 * into `dist/`, and the dev server answers for them from memory.
 *
 * Because this config imports the generators, editing one restarts the dev server, which
 * regenerates on the next request.
 */
function explainerIllustrations(): Plugin {
  let base = '/'

  return {
    name: 'explainer-illustrations',

    configResolved(viteConfig) {
      base = viteConfig.base
    },

    buildStart() {
      // Only a real build has a bundle to emit into; in dev the middleware below serves these.
      if (this.meta.watchMode) return
      for (const { fileName, source } of buildIllustrationFiles()) {
        this.emitFile({ type: 'asset', fileName, source })
      }
    },

    /**
     * Runs after `explainerMarkdown`'s default-order hook has already injected the compiled
     * article (with its raw `src="/assets/explainer/*.svg"` references) into the shell, so there's
     * HTML here to rewrite. `order: 'post'` is what guarantees that ordering regardless of the
     * plugins array position.
     */
    transformIndexHtml: {
      order: 'post',
      handler(html: string, ctx) {
        if (ctx.filename !== EXPLAINER_HTML) return html
        return html.replaceAll(`src="/${ILLUSTRATION_DIR}/`, `src="${base}${ILLUSTRATION_DIR}/`)
      },
    },

    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = request.url?.split('?')[0]
        if (!url) return next()
        // The dev server serves everything under `base`, so a request for an emitted illustration
        // arrives as e.g. `/entropy-minesweeper/assets/explainer/foo.svg`, not the bare
        // `assets/explainer/foo.svg` fileName the illustrations are keyed by.
        const path = url.startsWith(base) ? url.slice(base.length) : url.replace(/^\//, '')
        // Regenerated per request so a change to a fixture or generator shows up on reload.
        const file = buildIllustrationFiles().find((candidate) => candidate.fileName === path)
        if (!file) return next()
        response.setHeader('Content-Type', 'image/svg+xml')
        response.setHeader('Cache-Control', 'no-cache')
        response.end(file.source)
      })
    },
  }
}

/**
 * `vite-plugin-solid` prepends the `browser` export condition whenever Vite's mode is `test`. That
 * is what resolves `solid-js` to its DOM build instead of its server one, so a component test gets
 * the runtime it expects - but it also sends every other package that ships a DOM build there,
 * including `decode-named-character-reference` (reached through remark), which touches `document`
 * at import time. The two halves of the suite therefore want different environments, so they are
 * split into two Vitest projects: components run under jsdom with the plugin whole, everything else
 * under node with that one hook removed.
 */
function solidTransformOnly(): Plugin {
  const { configEnvironment: _browserConditions, ...transformOnly } = solidPlugin() as Plugin
  return transformOnly
}

export default defineConfig({
  base: '/entropy-minesweeper/',
  plugins: [solidPlugin(), explainerIllustrations(), explainerMarkdown()],
  worker: {
    format: 'es',
  },
  test: {
    projects: [
      {
        plugins: [solidTransformOnly()],
        test: {
          name: 'unit',
          /* No DOM by design: `boardRenderer.test.ts` and friends stub the Canvas2D surface they
           * need, and several tests read fixtures through `import.meta.url`, which jsdom rewrites
           * to an `http:` URL they cannot open. */
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        plugins: [solidPlugin()],
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
        },
      },
    ],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        explainer: resolve(import.meta.dirname, 'explainer.html'),
      },
    },
  },
})
