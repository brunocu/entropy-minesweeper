// Guards one MDX trap the migration walked straight into: a line whose entire content is a JSX
// element is parsed as *flow* content, not inline, so it closes the paragraph around it. An inline
// element written on its own line therefore lands between two `<p>`s instead of inside one -
//
//     In full: C1 is certainly safe ... given that</p><span class="term-premise">D1</span><p>must be a mine.
//
// which is a visibly broken paragraph on the live page. Nothing else notices: the build succeeds,
// the markup is well-formed, and the class is present, so every other assertion in this suite
// passes. It has to be caught by looking at the source.
//
// Raw HTML in the old Markdown pipeline was inline in this position, so this is a hazard MDX
// introduced rather than one the article always had.
import { describe, expect, it } from 'vitest'
import { readArticle } from './support/explainerSource.ts'

/**
 * Elements that belong inside a paragraph. Block-level tags (`figure`, `div`, `img`) are supposed
 * to sit on their own line - being flow content is the point there.
 */
const INLINE_TAGS = ['span', 'br', 'a', 'code', 'em', 'strong', 'sub', 'sup']

const LONE_ELEMENT = new RegExp(`^<(${INLINE_TAGS.join('|')})\\b[^>]*(/>|>[\\s\\S]*</\\1>)$`)

describe('MDX prose markup', () => {
  it('never leaves an inline element alone on its line, where MDX would make it block-level', async () => {
    const offenders = (await readArticle())
      .split('\n')
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => LONE_ELEMENT.test(line))
      .map(({ line, number }) => `line ${number}: ${line}`)

    expect(
      offenders,
      'these break the paragraph they are in - join them onto a line that has text on it',
    ).toEqual([])
  })
})
