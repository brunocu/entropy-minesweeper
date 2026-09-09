// Serves `virtual:tokens.css` from `renderTokensCss()`. At the repo root because both configs
// import it - Astro does not read `vite.config.ts`.
import type { Plugin } from 'vite'
import { renderTokensCss } from './src/lib/renderTokensCss.ts'

const VIRTUAL_ID = 'virtual:tokens.css'
// Rollup's "this id belongs to a plugin" prefix. The `.css` suffix survives it, which is what makes
// Vite treat the result as a stylesheet.
const RESOLVED_ID = `\0${VIRTUAL_ID}`

export function tokensCss(): Plugin {
  return {
    name: 'tokens-css',
    resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : null),
    load: (id) => (id === RESOLVED_ID ? renderTokensCss() : null),
  }
}
