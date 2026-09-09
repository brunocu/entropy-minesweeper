// Page-level wiring no other test covers: how MathJax is loaded, and whether it is told to look for
// the delimiters the article actually writes. This used to assert against the compiled explainer
// page; the tags now live in the shared layout, so that is what it reads.
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const LAYOUT = new URL('../../layouts/Site.astro', import.meta.url)

async function layout(): Promise<string> {
  return readFile(LAYOUT, 'utf8')
}

describe('MathJax loading', () => {
  it('loads MathJax from the CDN with a pinned version and integrity hash', async () => {
    const source = await layout()
    // A floating version would silently invalidate the integrity hash on the next release.
    // `rehype-mathjax` depends on the mathjax-full v3 line, so the client CDN build (a separate
    // package from mathjax-full, at the v3-only `es5/` path) must match that major.
    expect(source).toMatch(/src="https:\/\/cdn\.jsdelivr\.net\/npm\/mathjax@3\.\d+\.\d+\/es5\/tex-svg\.js"/)
    expect(source).toMatch(/integrity="sha384-[A-Za-z0-9+/=]+"/)
    expect(source).toContain('crossorigin="anonymous"')
    expect(source).toContain('async')
  })

  it('configures MathJax before the bundle that reads the config', async () => {
    const source = await layout()
    expect(source.indexOf('window.MathJax = {')).toBeGreaterThan(-1)
    expect(source.indexOf('window.MathJax = {')).toBeLessThan(source.indexOf('id="MathJax-script"'))
  })

  it('uses delimiters that match what the article actually writes', async () => {
    // `rehype-mathjax/browser` emits bare `\(...\)` / `\[...\]` text for the runtime to find.
    const source = await layout()
    expect(source).toContain("inlineMath: [['\\\\(', '\\\\)']]")
    expect(source).toContain("displayMath: [['\\\\[', '\\\\]']]")
  })

  it('marks both script tags `is:inline` so Astro ships them as written', async () => {
    // Without it Astro would bundle and hash the config script, which has to run as a plain global
    // assignment before the CDN bundle reads it, and would strip the integrity attribute.
    const source = await layout()
    expect([...source.matchAll(/is:inline/g)]).toHaveLength(2)
  })
})
