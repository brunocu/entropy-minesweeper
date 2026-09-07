import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkDirective from 'remark-directive'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { remarkGitHubAlerts } from 'remark-github-markdown-alerts'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'
import { remarkExplainerDirectives, rehypeStripAlertTitle } from '../directives.ts'

function render(markdown: string): string {
  const file = unified()
    .use(remarkParse)
    .use(remarkDirective)
    .use(remarkExplainerDirectives)
    .use(remarkRehype)
    .use(rehypeStringify)
    .processSync(markdown)
  return String(file)
}

describe('remarkExplainerDirectives', () => {
  it('maps a figure container directive to <figure>', () => {
    expect(render(':::figure\nHello.\n:::\n')).toBe('<figure><p>Hello.</p></figure>')
  })

  it('passes a class shorthand through to the figure element', () => {
    expect(render(':::figure{.board-figure}\nHello.\n:::\n')).toBe('<figure class="board-figure"><p>Hello.</p></figure>')
  })

  it('maps a nested figcaption container directive to <figcaption>', () => {
    expect(render('::::figure\n:::figcaption\nCaption text.\n:::\n::::\n')).toBe(
      '<figure><figcaption><p>Caption text.</p></figcaption></figure>',
    )
  })

  it('maps :term-safe[...] to a span.term-safe', () => {
    expect(render('A :term-safe[safe] cell.\n')).toBe('<p>A <span class="term-safe">safe</span> cell.</p>')
  })

  it('maps :term-mine[...] to a span.term-mine', () => {
    expect(render('A :term-mine[mine] cell.\n')).toBe('<p>A <span class="term-mine">mine</span> cell.</p>')
  })

  it('maps :term-clue[...] to a span.term-clue', () => {
    expect(render('A :term-clue[clue] cell.\n')).toBe('<p>A <span class="term-clue">clue</span> cell.</p>')
  })

  it('maps :term-premise[...] to a span.term-premise', () => {
    expect(render('A :term-premise[premise] cell.\n')).toBe('<p>A <span class="term-premise">premise</span> cell.</p>')
  })

  it('throws on an unknown container directive name', () => {
    expect(() => render(':::mystery\nHello.\n:::\n')).toThrow(/unknown container directive/)
  })

  it('throws on an unknown text directive name', () => {
    expect(() => render('A :mystery[thing] here.\n')).toThrow(/unknown text directive/)
  })

  it('throws on an unknown leaf directive name', () => {
    expect(() => render('::mystery[thing]\n')).toThrow(/unknown leaf directive/)
  })
})

function renderAlert(markdown: string): string {
  const file = unified()
    .use(remarkParse)
    .use(remarkGitHubAlerts, { mode: 'component', defaultConfig: { classNames: { container: 'callout' } } })
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStripAlertTitle)
    .use(rehypeStringify)
    .processSync(markdown)
  return String(file)
}

describe('.callout alert configuration', () => {
  it('emits the existing .callout markup with no title bar', () => {
    const html = renderAlert('> [!NOTE]\n>\n> Some *note* text.\n')
    expect(html).toContain('class="callout callout-note"')
    expect(html).toContain('<em>note</em>')
    expect(html).not.toContain('markdown-alert-title')
    expect(html).not.toMatch(/>\s*Note\s*</)
  })

  it('preserves links and math inside the alert body', () => {
    const html = renderAlert('> [!NOTE]\n>\n> See the [link](https://example.com) and $x$.\n')
    expect(html).toContain('<a href="https://example.com">link</a>')
    expect(html).toContain('<code class="language-math math-inline">x</code>')
  })
})
