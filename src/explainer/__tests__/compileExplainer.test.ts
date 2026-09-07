import { describe, expect, it } from 'vitest'
import { compileExplainer, computeFigureValues, EXPLAINER_PLACEHOLDER } from '../compileExplainer.ts'

const SHELL = `<!doctype html><html><head><title>t</title></head><body><main id="explainer">${EXPLAINER_PLACEHOLDER}</main></body></html>`

describe('compileExplainer', () => {
  it('renders markdown prose and injects it into the shell placeholder', () => {
    const html = compileExplainer(SHELL, '# Title\n\nSome *emphasis* and a [link](https://example.com).\n')
    expect(html).toContain('<main id="explainer">')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<em>emphasis</em>')
    expect(html).toContain('<a href="https://example.com">link</a>')
    expect(html.startsWith('<!doctype html>')).toBe(true)
  })

  it('passes embedded raw HTML straight through, unsanitized', () => {
    const html = compileExplainer(SHELL, 'Para.\n\n<div class="callout">\n<p>raw <strong>html</strong></p>\n</div>\n')
    expect(html).toContain('<div class="callout">')
    expect(html).toContain('<p>raw <strong>html</strong></p>')
  })

  it('renders a figure directive with a nested figcaption as real Markdown', () => {
    const html = compileExplainer(
      SHELL,
      ':::figure{.board-figure}\n<img src="/a.svg" alt="a" />\n\n:::figcaption\nA **bold** caption with a [link](https://example.com).\n:::\n:::\n',
    )
    expect(html).toContain('<figure class="board-figure">')
    expect(html).toContain('<img src="/a.svg" alt="a">')
    expect(html).toContain('<figcaption><p>A <strong>bold</strong> caption with a <a href="https://example.com">link</a>.</p></figcaption>')
  })

  it('renders a callout alert with no title bar, preserving nested markdown', () => {
    const html = compileExplainer(SHELL, '> [!NOTE]\n>\n> A [note](https://example.com).\n')
    expect(html).toContain('class="callout callout-note"')
    expect(html).toContain('<p>A <a href="https://example.com">note</a>.</p>')
    expect(html).not.toContain('markdown-alert-title')
  })

  it('renders a term-span directive', () => {
    const html = compileExplainer(SHELL, 'A :term-safe[safe] cell.\n')
    expect(html).toContain('<span class="term-safe">safe</span>')
  })

  it('renders inline and display math as bare MathJax-delimited text', () => {
    const html = compileExplainer(SHELL, 'Inline $x = \\{0, 1\\}$ math.\n\n$$\ny = 2\n$$\n')
    expect(html).toContain('Inline \\(x = \\{0, 1\\}\\) math.')
    expect(html).toContain('\\[y = 2\\]')
  })

  it('substitutes data-figure spans with the real computed values', () => {
    const values = computeFigureValues()
    const html = compileExplainer(SHELL, 'Mines: <span data-figure="mine-count">?</span>.\n')
    expect(html).toContain(`<span data-figure="mine-count">${values['mine-count']}</span>`)
  })

  it('throws if the shell has no placeholder to replace', () => {
    expect(() => compileExplainer('<html></html>', '# hi')).toThrow()
  })
})
