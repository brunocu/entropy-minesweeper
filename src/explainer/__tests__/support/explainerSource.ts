// Reads the article the way the tests need to see it. `{figures['name']}` and `illustration('name')`
// are ordinary MDX source constructs, so the article itself is what gets asserted against and no
// build has to run first - which matters because `npm test` gates `npm run build` in CI.
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
