// Guards the article's TeX. Formulas are typeset by MathJax in the reader's browser, so nothing in
// the build notices a malformed one - it ships and renders as red error text. This runs the same
// TeX parser over every formula and fails the suite instead.
//
// Reads the `.mdx` source rather than the built page: `remark-math` copies the TeX between the `$`
// delimiters through verbatim, so the source carries the same grammar, and a test needing `dist/`
// could not run in CI where `npm test` gates `npm run build`.
//
// `mathjax-full` is a devDependency for this test alone - the page loads its own copy from a CDN.
// It is the same package and major version `rehype-mathjax` depends on, so this validates against
// the grammar the page's own pipeline expects.
import type { LiteDocument } from 'mathjax-full/js/adaptors/lite/Document.js'
import type { LiteElement } from 'mathjax-full/js/adaptors/lite/Element.js'
import type { LiteText } from 'mathjax-full/js/adaptors/lite/Text.js'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js'
import 'mathjax-full/js/input/tex/base/BaseConfiguration.js'
import { mathjax } from 'mathjax-full/js/mathjax.js'
import { SVG } from 'mathjax-full/js/output/svg.js'
import { describe, expect, it } from 'vitest'
import { readArticle } from './support/explainerSource.ts'

/** How the article writes math: `remark-math`'s `$...$` and `$$...$$` delimiters. */
const DISPLAY_MATH = /\$\$([\s\S]*?)\$\$/g
const INLINE_MATH = /(?<![$\\])\$(?!\$)([^$\n][\s\S]*?)(?<!\\)\$(?!\$)/g

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
}

/**
 * The TeX packages `tex-svg.js` registers by default, which is what the page gets at runtime.
 * Validating against a wider set here would pass on macros the reader's browser cannot render.
 */
const CDN_DEFAULT_PACKAGES = ['base', 'ams']

async function typesetErrors(formulas: readonly { tex: string; display: boolean }[]): Promise<string[]> {
  const adaptor = liteAdaptor()
  RegisterHTMLHandler(adaptor)
  const document = mathjax.document('', {
    InputJax: new TeX<LiteElement, LiteText, LiteDocument>({ packages: CDN_DEFAULT_PACKAGES }),
    OutputJax: new SVG<LiteElement, LiteText, LiteDocument>({ fontCache: 'local' }),
  })

  const failures: string[] = []
  for (const { tex, display } of formulas) {
    const node = document.convert(tex, { display }) as LiteElement
    const markup = adaptor.outerHTML(node)
    // MathJax reports a bad expression as an merror node rather than throwing.
    if (markup.includes('data-mml-node="merror"')) failures.push(tex)
  }
  return failures
}

/** Display math first, so its `$$` bodies are out of the way before inline `$` matching runs. */
function formulasIn(article: string): { tex: string; display: boolean }[] {
  const display = [...article.matchAll(DISPLAY_MATH)].map((m) => ({
    tex: decodeEntities(m[1]).trim(),
    display: true,
  }))
  const inline = [...article.replace(DISPLAY_MATH, '').matchAll(INLINE_MATH)].map((m) => ({
    tex: decodeEntities(m[1]).trim(),
    display: false,
  }))
  return [...display, ...inline]
}

describe('explainer TeX', () => {
  it('parses every formula in the article without error', async () => {
    const formulas = formulasIn(await readArticle())
    expect(formulas.length).toBeGreaterThan(0)
    expect(await typesetErrors(formulas)).toEqual([])
  })

  it('numbers each display equation exactly once, in order', async () => {
    const tags = [...(await readArticle()).matchAll(/\\tag\{(\d+)\}/g)].map((m) => Number(m[1]))
    expect(tags).toEqual([...tags].sort((a, b) => a - b))
    expect(new Set(tags).size).toBe(tags.length)
  })
})
