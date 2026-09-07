// Page-level wiring in the compiled explainer page that no other test covers: how MathJax is
// loaded.
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { compileExplainer } from '../compileExplainer.ts'

const SHELL = new URL('../../../explainer.html', import.meta.url)
const MARKDOWN = new URL('../../../explainer.md', import.meta.url)

async function readPage(): Promise<string> {
  const [shell, markdown] = await Promise.all([readFile(SHELL, 'utf8'), readFile(MARKDOWN, 'utf8')])
  return compileExplainer(shell, markdown)
}

describe('explainer.html MathJax loading', () => {
  it('loads MathJax from the CDN with a pinned version and integrity hash', async () => {
    const tag = (await readPage()).match(/<script\b[^>]*id="MathJax-script"[\s\S]*?><\/script>/)
    expect(tag, 'no MathJax script tag').not.toBeNull()
    // A floating version would silently invalidate the integrity hash on the next release.
    // `rehype-mathjax` depends on the mathjax-full v3 line, so the client CDN build (a separate
    // package from mathjax-full, at the v3-only `es5/` path) must match that major.
    expect(tag![0]).toMatch(/src="https:\/\/cdn\.jsdelivr\.net\/npm\/mathjax@3\.\d+\.\d+\/es5\/tex-svg\.js"/)
    expect(tag![0]).toMatch(/integrity="sha384-[A-Za-z0-9+/=]+"/)
    expect(tag![0]).toContain('crossorigin="anonymous"')
    expect(tag![0]).toContain('async')
  })

  it('configures MathJax before the bundle that reads the config', async () => {
    const page = await readPage()
    expect(page.indexOf('window.MathJax = {')).toBeLessThan(page.indexOf('id="MathJax-script"'))
  })

  it('uses delimiters that match what the page actually writes', async () => {
    const page = await readPage()
    expect(page).toContain("inlineMath: [['\\\\(', '\\\\)']]")
    expect(page).toContain("displayMath: [['\\\\[', '\\\\]']]")
  })

  it('ships no bundled MathJax of its own', async () => {
    const page = await readPage()
    expect(page).not.toContain('<mjx-container')
  })
})
