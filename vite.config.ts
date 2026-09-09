import solidPlugin from 'vite-plugin-solid'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * `vite-plugin-solid` prepends the `browser` export condition whenever Vite's mode is `test`. That
 * is what resolves `solid-js` to its DOM build instead of its server one, so a component test gets
 * the runtime it expects - but it also sends every other package that ships a DOM build there,
 * including some reached through the Markdown toolchain, which touch `document` at import time. The
 * two halves of the suite therefore want different environments, so they are split into two Vitest
 * projects: components run under jsdom with the plugin whole, everything else under node with that
 * one hook removed.
 */
function solidTransformOnly(): Plugin {
  const { configEnvironment: _browserConditions, ...transformOnly } = solidPlugin() as Plugin
  return transformOnly
}

/**
 * Vitest only. The site itself is built by Astro (`astro.config.mjs`); this file exists for the test
 * runner, which needs the Solid transform and `base` (the game's explainer link is asserted against
 * `import.meta.env.BASE_URL`).
 */
export default defineConfig({
  base: '/entropy-minesweeper/',
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
})
