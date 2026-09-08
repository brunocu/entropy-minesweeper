// Compiles `explainer.md` into the final explainer page through a `unified()` pipeline:
// `remark-parse` reads the Markdown, `remark-github-markdown-alerts`
// turns `> [!NOTE]` into the `.callout` markup, `remark-directive` plus `remarkExplainerDirectives`
// turn `::: figure`/`:term-safe[...]`-style syntax into real elements, `remark-math` parses
// `$...$`/`$$...$$`, `remark-rehype` (with raw-HTML passthrough for the figure images and the demo
// widget) hands off to `rehype-raw` and `rehype-mathjax/browser` (which leaves bare `\(...\)`/
// `\[...\]`-delimited text for the client-side MathJax runtime to find and typeset - no wrapper
// element needed, MathJax scans the page for the delimiters directly), and `rehype-stringify`
// prints the result. `computeFigureValues()`/`substituteFigures()` (the `data-figure` injection)
// run as post-processing on the final HTML string.
import rehypeMathjax from 'rehype-mathjax/browser'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import { remarkGitHubAlerts } from 'remark-github-markdown-alerts'
import remarkDirective from 'remark-directive'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { toLabel } from '../board/chessLabel.ts'
import { computeExplanations } from '../solver/explanation.ts'
import { key } from '../solver/types.ts'
import { solveFixture } from './solvedFixture.ts'
import { rehypeStripAlertTitle, remarkExplainerDirectives } from './directives.ts'
import {
  CERTAINTY_BOARD,
  CERTAINTY_FOCUS_CELL,
  WORLDS_TREE_BOARD,
  WORLDS_TREE_FOCUS_CELL,
} from './fixtures.ts'
import { buildWorldsTreeModel } from './worldsTree.ts'

/**
 * The marker `explainer.html`'s shell carries, inside `<main id="explainer">`, in place of the
 * compiled article. It sits alongside the back-link rather than replacing the whole `<main>`
 * element, so the back-link stays inside `#explainer`'s centered, max-width column: a
 * shell-level sibling of `<main>` sits flush against the body instead of aligned with the prose.
 */
export const EXPLAINER_PLACEHOLDER = '<!--explainer-content-->'

/**
 * `mode: 'component'` despite its name is what's needed here, not `'html'`: `'html'` mode
 * serializes the alert body through `mdast-util-to-string` before any other plugin sees it,
 * silently dropping every link, math span, and inline emphasis inside `.callout` down to plain
 * text (confirmed empirically this session). `'component'` mode keeps the body as real mdast
 * nodes, which `remark-math`, `remark-rehype`, etc. below then process normally.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGitHubAlerts, { mode: 'component', defaultConfig: { classNames: { container: 'callout' } } })
  .use(remarkDirective)
  .use(remarkExplainerDirectives)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeStripAlertTitle)
  .use(rehypeMathjax)
  .use(rehypeStringify)

/** Every `data-figure="name"` value the article quotes, computed from the real solver. */
export function computeFigureValues(): Record<string, string> {
  // One solve per fixture here too, so the numbers quoted in the prose come from the same solve
  // the figures beside them are drawn from.
  const worldsTree = solveFixture(WORLDS_TREE_BOARD)
  const treeSolve = worldsTree.result
  const focus = treeSolve.frontierByKey.get(key(WORLDS_TREE_FOCUS_CELL.row, WORLDS_TREE_FOCUS_CELL.col))!
  const eigModel = buildWorldsTreeModel(worldsTree, WORLDS_TREE_FOCUS_CELL, 'eig')

  const treeCertain = treeSolve.frontier.find((f) => f.probability === 1)!
  const treeExplanation = computeExplanations(
    worldsTree.decomposition,
    treeSolve,
    new Set(),
    new Map(),
  ).explanations.get(`${treeCertain.row},${treeCertain.col}`)!

  const certainty = solveFixture(CERTAINTY_BOARD)
  const certaintySolve = certainty.result
  const { explanations } = computeExplanations(certainty.decomposition, certaintySolve, new Set(), new Map())
  const explanation = explanations.get(`${CERTAINTY_FOCUS_CELL.row},${CERTAINTY_FOCUS_CELL.col}`)!

  return {
    'mine-count': String(WORLDS_TREE_BOARD.mineCount),
    'unknown-count': String(treeSolve.frontier.length),
    'unknown-labels': treeSolve.frontier
      .map((f) => toLabel(f.row, f.col))
      .sort()
      .join(', '),
    'world-count': String(eigModel.tips.filter((t) => t.surviving).length),
    'focus-probability': `${(focus.probability * 100).toFixed(1)}%`,
    'open-board-certain-cell': toLabel(treeCertain.row, treeCertain.col),
    'open-board-certain-clues': treeExplanation.clueCells
      .map((c) => toLabel(c.row, c.col))
      .sort()
      .join(', '),
    'certainty-focus': toLabel(CERTAINTY_FOCUS_CELL.row, CERTAINTY_FOCUS_CELL.col),
    'certainty-clues': explanation.clueCells.map((c) => toLabel(c.row, c.col)).join(' and '),
    'certainty-premises': explanation.premiseCells.map((c) => toLabel(c.row, c.col)).join(' and '),
  }
}

/** Replaces every `data-figure="name">...<` span's contents with its computed value. */
function substituteFigures(html: string, values: Record<string, string>): string {
  return html.replace(/(data-figure="([^"]+)"[^>]*>)([^<]*)(<)/g, (match, open, name, _text, close) => {
    if (!(name in values)) return match
    return `${open}${values[name]}${close}`
  })
}

/**
 * Compiles the explainer page: runs `markdown` through the `unified()` pipeline above,
 * substitutes the real `data-figure` values, and injects the result into `shellHtml`'s placeholder.
 */
export function compileExplainer(shellHtml: string, markdown: string): string {
  const article = String(processor.processSync(markdown))
  const withFigures = substituteFigures(article, computeFigureValues())
  if (!shellHtml.includes(EXPLAINER_PLACEHOLDER)) {
    throw new Error(`explainer shell is missing the placeholder ${EXPLAINER_PLACEHOLDER}`)
  }
  return shellHtml.replace(EXPLAINER_PLACEHOLDER, withFigures)
}
