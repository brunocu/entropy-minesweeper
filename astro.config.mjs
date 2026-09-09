// Astro build for the two pages (the game and the explainer). The explainer is authored as MDX so
// its figures, terms and demo can be components rather than raw HTML plus a directive plugin; the
// game and the demo hydrate as Solid islands.
import { unified } from '@astrojs/markdown-remark'
import mdx from '@astrojs/mdx'
import solid from '@astrojs/solid-js'
import { defineConfig } from 'astro/config'
import rehypeMathjax from 'rehype-mathjax/browser'
import remarkMath from 'remark-math'
import { tokensCss } from './tokensCssPlugin.ts'

// https://astro.build/config
export default defineConfig({
  site: 'https://brunocu.github.io',
  base: '/entropy-minesweeper/',

  integrations: [mdx(), solid()],

  vite: {
    plugins: [tokensCss()],
    build: {
      sourcemap: true,
    },
  },

  compressHTML: false,

  build: {
    format: 'file',
  },

  /**
   * Astro 7 defaults to Sätteri, which cannot run remark or rehype plugins at all, and the
   * explainer uses tex math extensively - so it takes the `unified()` processor instead (design.md
   * decision 2). `unified` here is the factory from `@astrojs/markdown-remark`, not the `unified`
   * package's own export, and plugins are options to it rather than `.use()` calls.
   *
   * Two plugins, where the standalone pipeline this replaces needed nine. `rehype-mathjax/browser`
   * leaves bare `\(...\)`/`\[...\]`-delimited TeX for the CDN MathJax runtime the layout loads to
   * typeset client-side, exactly as before.
   */
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeMathjax],
    }),
  },
})
