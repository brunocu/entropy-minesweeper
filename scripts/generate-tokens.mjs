// Derives `src/design/tokens.css` from `src/design/tokens.ts`, so the CSS custom properties the
// HTML pages use and the JS values the canvas renderers use can never disagree: there is one
// representation and one derivation of it. Run from `predev`/`prebuild`; the output is committed,
// so a fresh clone works with no build step, and a test asserts the committed file is current.
//
// Deliberately plain Node with no build-tool coupling — nothing here knows whether Vite or
// anything else is running the build (unify-design-tokens design.md, decision 1).
import { writeFile } from 'node:fs/promises'
import { renderTokensCss } from '../src/design/renderTokensCss.ts'

await writeFile(new URL('../src/design/tokens.css', import.meta.url), renderTokensCss())
