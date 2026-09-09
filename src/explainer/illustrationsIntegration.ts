// Publishes the explainer's illustrations, which are generated from the real solver rather than
// authored (see `illustrations.ts`). The generators are the valuable part and are untouched here;
// this module is only the plumbing that puts their output at a URL.
//
// The explainer references one fixed URL per illustration, so the same path has to answer in both
// modes. That is two hooks, because Astro has no single one that covers both: `astro:build:done`
// writes the files into the output directory, and `astro:server:setup` adds dev middleware that
// answers from memory, regenerating when Vite invalidates the generators.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import { buildIllustrationFiles, ILLUSTRATION_DIR, type IllustrationFile } from './illustrations.ts'

/** Root-relative, the form `server.ssrLoadModule` resolves against the Vite project root. */
const ILLUSTRATIONS_MODULE = '/src/explainer/illustrations.ts'

export function explainerIllustrations(): AstroIntegration {
  // `astro:config:done` is the only hook that sees the resolved config, and the dev middleware
  // needs `base` to strip it off incoming request URLs.
  let base = '/'

  return {
    name: 'explainer-illustrations',

    hooks: {
      'astro:config:done': ({ config }) => {
        base = config.base.endsWith('/') ? config.base : `${config.base}/`
      },

      /**
       * `dir` arrives as a `URL`, so it has to be converted before `node:fs` can use it. This is
       * more code than the `this.emitFile()` the Vite plugin this replaces used, which is the
       * price of staying on Astro's own extension points.
       */
      'astro:build:done': async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir)
        const files = buildIllustrationFiles()
        for (const { fileName, source } of files) {
          const target = join(outDir, fileName)
          await mkdir(dirname(target), { recursive: true })
          await writeFile(target, source, 'utf8')
        }
        logger.info(`wrote ${files.length} illustrations to ${outDir}`)
      },

      'astro:server:setup': ({ server }) => {
        /**
         * The generated files, held until Vite re-executes the generator module.
         *
         * Freshness comes from `ssrLoadModule`, not from regenerating per request. Astro loads
         * `astro.config.mjs` once and never watches its transitive TypeScript imports, so the
         * statically imported `buildIllustrationFiles` above stays frozen at the version the server
         * booted with - it is fine for the build hook, which runs once, and silently serves stale
         * SVGs in dev. Going through Vite's module graph puts the generators, and everything they
         * import down to `boardSvg.ts`, under Vite's own invalidation: an edit anywhere in that
         * graph hands back a new module namespace on the next request, which is what this cache
         * keys on.
         *
         * Generation is deterministic - fixed fixtures, deterministic solve, output pinned
         * byte-for-byte by `illustrationFiles.test.ts` - so between two invalidations every call
         * returns identical bytes and one of them is enough.
         */
        let cache: { readonly module: object; readonly files: readonly IllustrationFile[] } | null = null

        const illustrations = async (): Promise<readonly IllustrationFile[]> => {
          const module = (await server.ssrLoadModule(ILLUSTRATIONS_MODULE)) as typeof import('./illustrations.ts')
          if (cache?.module !== module) {
            cache = { module, files: module.buildIllustrationFiles() }
          }
          return cache.files
        }

        // Connect ignores what a handler returns, so a rejection escaping this function would be an
        // unhandled one rather than a 500 - hence the `try` around the whole body. It has to cover
        // the synchronous part too: in an `async` function a synchronous throw is a rejection as
        // well, so Connect's own `try/catch` around the call no longer sees it.
        server.middlewares.use(async (request, response, next) => {
          try {
            const url = request.url?.split('?')[0]
            if (!url) return next()
            // The dev server serves everything under `base`, so a request arrives as e.g.
            // `/entropy-minesweeper/assets/explainer/foo.svg`, not the bare
            // `assets/explainer/foo.svg` fileName the illustrations are keyed by.
            const path = url.startsWith(base) ? url.slice(base.length) : url.replace(/^\//, '')
            // Every request to the dev server passes through here, so this bails out before the
            // first `await` - a page or asset request is not delayed by a microtask it has no use
            // for.
            if (!path.startsWith(`${ILLUSTRATION_DIR}/`)) return next()

            const file = (await illustrations()).find((candidate) => candidate.fileName === path)
            if (!file) return next()
            response.setHeader('Content-Type', 'image/svg+xml')
            response.setHeader('Cache-Control', 'no-cache')
            response.end(file.source)
          } catch (error) {
            next(error)
          }
        })
      },
    },
  }
}
