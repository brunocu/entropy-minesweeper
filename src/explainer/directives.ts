// Maps the article's six `remark-directive` names to their hast output (design.md decision 2).
// `remark-directive` only parses `:::`/`::`/`:` syntax into generic directive nodes - "directives
// don't handle themselves" per its own README - so this plugin is the part that says what HTML
// each one becomes. Anything outside these six names throws: a typo in `explainer.md` should fail
// the build loudly rather than silently rendering as nothing.
import type { Element, Root } from 'hast'
import type { Root as MdastRoot } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

const CONTAINER_TAGS: Record<string, string> = {
  figure: 'figure',
  figcaption: 'figcaption',
}

const TERM_SPAN_CLASSES: Record<string, string> = {
  'term-safe': 'term-safe',
  'term-mine': 'term-mine',
  'term-clue': 'term-clue',
  'term-premise': 'term-premise',
}

/** Remark plugin mapping `figure`/`figcaption` container directives and the four `term-*` text
 * directives to their hast tag/class, via `data.hName`/`data.hProperties` (the mechanism
 * `remark-rehype` reads to turn a directive node into a real element). */
export const remarkExplainerDirectives: Plugin<[], MdastRoot> = () => (tree) => {
  visit(tree, (node) => {
    if (node.type !== 'containerDirective' && node.type !== 'leafDirective' && node.type !== 'textDirective') return

    const name = (node as { name: string }).name
    const data = (node.data ||= {})

    if (node.type === 'containerDirective') {
      const tagName = CONTAINER_TAGS[name]
      if (!tagName) throw new Error(`unknown container directive ":::${name}" in explainer.md`)
      data.hName = tagName
      const className = (node as { attributes?: Record<string, string | null | undefined> }).attributes?.class
      data.hProperties = className ? { className: className.split(/\s+/) } : {}
      return
    }

    if (node.type === 'textDirective') {
      const className = TERM_SPAN_CLASSES[name]
      if (!className) throw new Error(`unknown text directive ":${name}" in explainer.md`)
      data.hName = 'span'
      data.hProperties = { className: [className] }
      return
    }

    throw new Error(`unknown leaf directive "::${name}" in explainer.md`)
  })
}

/** Strips the title element `remark-github-markdown-alerts` always renders (design.md decision
 * 2: its `tags`/`classNames` options rename the title node but never omit it - confirmed against
 * the installed package's source, which unconditionally builds a title element). Runs on the hast
 * tree, after the alert's raw HTML has been parsed back in by `rehype-raw`. */
export const rehypeStripAlertTitle: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (node: Element, index, parent) => {
    if (index === undefined || !parent) return
    const classes = node.properties?.className
    const isAlertTitle = Array.isArray(classes) && classes.includes('markdown-alert-title')
    if (!isAlertTitle) return
    parent.children.splice(index, 1)
    return index
  })
}
