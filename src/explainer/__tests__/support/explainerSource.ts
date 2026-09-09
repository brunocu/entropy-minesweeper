// Reads the article the way the tests below need to see it.
//
// These used to read the *compiled* page, because the values and image URLs only existed after
// `compileExplainer()` had rewritten an HTML string. In MDX they are ordinary source constructs -
// `{figures['name']}` and `illustration('name')` - so the article itself is the thing to assert
// against, and no build has to run first. `npm test` gates `npm run build` in CI, so a test that
// needed `dist/` could not run there at all.
import { readFile } from 'node:fs/promises'

const ARTICLE = new URL('../../../pages/explainer.mdx', import.meta.url)

export async function readArticle(): Promise<string> {
  return readFile(ARTICLE, 'utf8')
}

/** Every `{figures['name']}` the prose interpolates, in source order. */
export function quotedFigureNames(article: string): string[] {
  return [...article.matchAll(/\bfigures\[(?:'([^']+)'|"([^"]+)")\]/g)].map((match) => match[1] ?? match[2])
}

/** Every `illustration('name')` the article loads, deduplicated. */
export function referencedIllustrations(article: string): Set<string> {
  return new Set([...article.matchAll(/\billustration\((?:'([^']+)'|"([^"]+)")\)/g)].map((m) => m[1] ?? m[2]))
}

/** Every `<img ... />` tag in the article, as written. */
export function imageTags(article: string): string[] {
  return [...article.matchAll(/<img\b[\s\S]*?\/>/g)].map((match) => match[0])
}
