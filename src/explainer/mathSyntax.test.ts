// Guards the article's TeX. The page's formulas are typeset by MathJax in the reader's browser,
// so nothing in the build would notice a malformed one - it would ship and render as red error
// text on the live page. This runs the same TeX parser over every formula in the compiled
// explainer page and fails the suite instead.
//
// `mathjax-full` is a devDependency for this test alone: it is never imported by the app, the
// build, or the page, which loads its own copy from a CDN. It's the same package (and major
// version) `rehype-mathjax` itself depends on, so this validates against the same TeX grammar the
// compiler's own math pipeline expects.
import { readFile } from 'node:fs/promises'
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
import { compileExplainer } from './compileExplainer.ts'

const SHELL = new URL('../../explainer.html', import.meta.url)
const MARKDOWN = new URL('../../explainer.md', import.meta.url)

async function compiledPage(): Promise<string> {
  const [shell, markdown] = await Promise.all([readFile(SHELL, 'utf8'), readFile(MARKDOWN, 'utf8')])
  return compileExplainer(shell, markdown)
}

/** How the page writes math: bare, MathJax-delimited TeX (`rehype-mathjax/browser`'s output -
 * see `compileExplainer.ts` - has no wrapper element to key a regex off of instead). */
const INLINE_MATH = /\\\(([\s\S]*?)\\\)/g
const DISPLAY_MATH = /\\\[([\s\S]*?)\\\]/g

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

describe('explainer.html TeX', () => {
  it('parses every formula on the page without error', async () => {
    const page = await compiledPage()
    const formulas = [
      ...[...page.matchAll(DISPLAY_MATH)].map((m) => ({ tex: decodeEntities(m[1]).trim(), display: true })),
      ...[...page.matchAll(INLINE_MATH)].map((m) => ({ tex: decodeEntities(m[1]).trim(), display: false })),
    ]
    expect(formulas.length).toBeGreaterThan(0)
    expect(await typesetErrors(formulas)).toEqual([])
  })

  it('numbers each display equation exactly once, in order', async () => {
    const page = await compiledPage()
    const tags = [...page.matchAll(/\\tag\{(\d+)\}/g)].map((m) => Number(m[1]))
    expect(tags).toEqual([...tags].sort((a, b) => a - b))
    expect(new Set(tags).size).toBe(tags.length)
  })
})
