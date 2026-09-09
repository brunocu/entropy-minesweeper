import solidPlugin from 'vite-plugin-solid'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { tokensCss } from './tokensCssPlugin.ts'

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
 * The test runner's config. `tokensCss()` appears here and in `astro.config.mjs`, which does not
 * read this file. `base` backs the `import.meta.env.BASE_URL` the game's explainer link asserts.
 */
export default defineConfig({
  base: '/entropy-minesweeper/',
  test: {
    projects: [
      {
        plugins: [tokensCss(), solidTransformOnly()],
        test: {
          name: 'unit',
          /* No DOM by design, and several of these read fixtures through `import.meta.url`, which
           * jsdom rewrites to an `http:` URL they cannot open. */
          environment: 'node',
          /* Pure logic and build-time generators - the tiers that touch no browser API. */
          include: ['src/{lib,explainer}/**/*.test.?(c|m)[jt]s?(x)'],
        },
      },
      {
        plugins: [tokensCss(), solidPlugin()],
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/{components,canvas}/**/*.test.?(c|m)[jt]s?(x)'],
        },
      },
    ],
  },
})
