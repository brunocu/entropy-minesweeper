// The article quotes solver-computed numbers in its prose - probabilities, bit counts, cell
// labels. `compileExplainer()` computes them from the real solver and injects them into the
// `data-figure` spans at compile time (see `computeFigureValues`), so this checks the injection
// actually lands the right value in the right place rather than, say, dropping a name or
// mismatching a span - the values themselves are correct by construction, not by drift-checking
// against a second hand-typed copy.
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { decompose } from '../../solver/decomposition.ts'
import { solve } from '../../solver/probability.ts'
import { compileExplainer, computeFigureValues } from '../compileExplainer.ts'
import {
  CERTAINTY_BOARD,
  CERTAINTY_FOCUS_CELL,
  WORLDS_TREE_BOARD,
  WORLDS_TREE_FOCUS_CELL,
} from '../fixtures.ts'

// The cell whose EIG the prose contrasts with the focus cell's: same probability, strictly
// less information, because its reading only ever answers one yes-or-no. Only the tests
// name it, so it lives here rather than in fixtures.ts.
const WORLDS_TREE_CONTRAST_CELL = { row: 0, col: 0 }

const SHELL = new URL('../../../explainer.html', import.meta.url)
const MARKDOWN = new URL('../../../explainer.md', import.meta.url)

async function compiledPage(): Promise<string> {
  const [shell, markdown] = await Promise.all([readFile(SHELL, 'utf8'), readFile(MARKDOWN, 'utf8')])
  return compileExplainer(shell, markdown)
}

function figuresInPage(page: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const match of page.matchAll(/data-figure="([^"]+)"[^>]*>([^<]*)</g)) {
    found.set(match[1], match[2].trim())
  }
  return found
}

describe('figures quoted in the compiled explainer page', () => {
  it('carry the values computed from the fixtures', async () => {
    const found = figuresInPage(await compiledPage())
    for (const [name, expected] of Object.entries(computeFigureValues())) {
      expect(found.get(name), `data-figure="${name}" is missing from the compiled page`).toBeDefined()
      expect(found.get(name)).toBe(expected)
    }
  })

  it('leaves no figure in the page unaccounted for', async () => {
    const found = figuresInPage(await compiledPage())
    const expected = computeFigureValues()
    for (const name of found.keys()) {
      expect(expected, `data-figure="${name}" is in the page but nothing computes it`).toHaveProperty(name)
    }
  })

  it('holds up every quantitative claim the EIG argument makes', () => {
    // The prose spells these out in TeX, where a data-figure span cannot reach. Pinning the
    // relationships instead means a fixture change fails here and forces the prose to be
    // revisited, rather than leaving the article quietly arguing something untrue.
    const { result: treeSolve } = solve(decompose(WORLDS_TREE_BOARD), new Map())
    const focus = treeSolve.frontier.find(
      (f) => f.row === WORLDS_TREE_FOCUS_CELL.row && f.col === WORLDS_TREE_FOCUS_CELL.col,
    )!
    const contrast = treeSolve.frontier.find(
      (f) => f.row === WORLDS_TREE_CONTRAST_CELL.row && f.col === WORLDS_TREE_CONTRAST_CELL.col,
    )!
    // "all carry exactly the same 1/2 risk"
    expect(contrast.probability).toBeCloseTo(focus.probability, 10)
    expect(focus.probability).toBeCloseTo(0.5, 10)
    // "its reading can only ever answer a single yes-or-no ... H(1/2, 1/2) = 1 bit"
    expect(contrast.outcomeProbabilities.size).toBe(2)
    expect(contrast.eig).toBeCloseTo(1, 10)
    // "Three answers, unevenly weighted ... = 1.5 bits"
    expect(focus.outcomeProbabilities.size).toBe(3)
    expect(focus.eig).toBeCloseTo(1.5, 10)
    // "Identical probability, half a bit more information"
    expect(focus.eig - contrast.eig).toBeCloseTo(0.5, 10)
  })
})

describe('captions live in the page, not baked into the images', () => {
  it('leaves no prose text inside the generated SVGs', async () => {
    // Text in an SVG cannot be selected, translated, or read at a sensible size, and it was
    // overflowing the viewBox. Short labels stay - the longest legitimate one is a five-cell
    // branch plus "— ruled out" - but a sentence belongs in the figcaption.
    const { renderWorldsTree } = await import('../worldsTree.ts')
    const { renderCertaintyBoard } = await import('../certaintyBoard.ts')
    const { solveFixture } = await import('../solvedFixture.ts')
    const worldsTree = solveFixture(WORLDS_TREE_BOARD)
    const svgs = [
      renderWorldsTree(worldsTree, WORLDS_TREE_FOCUS_CELL, 'probability'),
      renderWorldsTree(worldsTree, WORLDS_TREE_FOCUS_CELL, 'eig'),
      renderCertaintyBoard(solveFixture(CERTAINTY_BOARD), CERTAINTY_FOCUS_CELL),
    ]
    for (const svg of svgs) {
      for (const match of svg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)) {
        const text = match[1].replace(/<[^>]+>/g, '')
        expect(text.split(/\s+/).filter(Boolean).length, `sentence baked into SVG: ${text}`).toBeLessThanOrEqual(10)
      }
    }
  })
})
