// The article quotes solver-computed numbers in its prose - probabilities, bit counts, cell labels.
// `computeFigureValues()` computes them from the real solver and the article interpolates them as
// `{figures['name']}`, so what can still go wrong is a name mismatch: a key computed and never
// quoted, or quoted and never computed (which renders as nothing at all). The values themselves are
// correct by construction, not by drift-checking against a second hand-typed copy.
import { describe, expect, it } from 'vitest'
import { decompose } from '../../solver/decomposition.ts'
import { solve } from '../../solver/probability.ts'
import { computeFigureValues } from '../figures.ts'
import {
  CERTAINTY_BOARD,
  CERTAINTY_FOCUS_CELL,
  WORLDS_TREE_BOARD,
  WORLDS_TREE_FOCUS_CELL,
} from '../fixtures.ts'
import { quotedFigureNames, readArticle } from './support/explainerSource.ts'

// The cell whose EIG the prose contrasts with the focus cell's: same probability, strictly
// less information, because its reading only ever answers one yes-or-no. Only the tests
// name it, so it lives here rather than in fixtures.ts.
const WORLDS_TREE_CONTRAST_CELL = { row: 0, col: 0 }

describe('figures quoted in the explainer article', () => {
  it('computes a non-empty value for every name', () => {
    const values = Object.entries(computeFigureValues())
    expect(values.length).toBeGreaterThan(0)
    for (const [name, value] of values) {
      expect(value, `${name} computed as an empty string`).not.toBe('')
    }
  })

  it('quotes every name it computes', async () => {
    const quoted = new Set(quotedFigureNames(await readArticle()))
    for (const name of Object.keys(computeFigureValues())) {
      expect(quoted, `figures['${name}'] is computed but the article never quotes it`).toContain(name)
    }
  })

  it('leaves no quoted name unaccounted for', async () => {
    // A name the article quotes but nothing computes interpolates as `undefined` - visible on the
    // page, invisible to the build.
    const computed = computeFigureValues()
    for (const name of quotedFigureNames(await readArticle())) {
      expect(computed, `the article quotes figures['${name}'] but nothing computes it`).toHaveProperty(name)
    }
  })

  it('holds up every quantitative claim the EIG argument makes', () => {
    // The prose spells these out in TeX, where an interpolated figure cannot reach. Pinning the
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
