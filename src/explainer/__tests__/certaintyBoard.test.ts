import { describe, expect, it } from 'vitest'
import { CLUE_HIGHLIGHT_COLOR, PREMISE_HIGHLIGHT_COLOR } from '../../render/probabilityColor.ts'
import { computeExplanations } from '../../solver/explanation.ts'
import { renderCertaintyBoard } from '../certaintyBoard.ts'
import { CERTAINTY_BOARD, CERTAINTY_FOCUS_CELL } from '../fixtures.ts'
import { solveFixture } from '../solvedFixture.ts'

describe('certainty-explanation board generator', () => {
  const fixture = solveFixture(CERTAINTY_BOARD)
  const svg = renderCertaintyBoard(fixture, CERTAINTY_FOCUS_CELL)
  const { decomposition, result } = fixture
  const { explanations } = computeExplanations(decomposition, result, new Set(), new Map())
  const explanation = explanations.get(`${CERTAINTY_FOCUS_CELL.row},${CERTAINTY_FOCUS_CELL.col}`)!

  /** The one `<rect>` carrying this cell's explanation highlight, or undefined. */
  function highlightFor(cellKey: string): string | undefined {
    return (svg.match(/<rect class="explanation-highlight[^>]*>/g) ?? []).find((tag) =>
      tag.includes(`data-highlight-cell="${cellKey}"`),
    )
  }

  it('highlights every clue cell with the clue color', () => {
    for (const clue of explanation.clueCells) {
      const tag = highlightFor(`${clue.row},${clue.col}`)
      expect(tag, `no highlight for clue ${clue.row},${clue.col}`).toBeDefined()
      expect(tag).toContain(`stroke="${CLUE_HIGHLIGHT_COLOR}"`)
    }
  })

  it('highlights every premise cell with the visually distinct premise color', () => {
    expect(CLUE_HIGHLIGHT_COLOR).not.toBe(PREMISE_HIGHLIGHT_COLOR)
    for (const premise of explanation.premiseCells) {
      const tag = highlightFor(`${premise.row},${premise.col}`)
      expect(tag, `no highlight for premise ${premise.row},${premise.col}`).toBeDefined()
      expect(tag).toContain(`stroke="${PREMISE_HIGHLIGHT_COLOR}"`)
    }
  })

  it('highlights nothing outside the explanation set', () => {
    const highlighted = (svg.match(/data-highlight-cell="([^"]+)"/g) ?? []).map((m) => m.slice('data-highlight-cell="'.length, -1))
    const expected = [...explanation.clueCells, ...explanation.premiseCells].map((c) => `${c.row},${c.col}`)
    expect(highlighted.sort()).toEqual(expected.sort())
  })

  it('marks the explained cell as certain with the live board’s certainty ring', () => {
    expect(result.frontier.find((f) => f.row === CERTAINTY_FOCUS_CELL.row && f.col === CERTAINTY_FOCUS_CELL.col)!.probability).toBe(0)
    expect(svg).toContain('class="certainty-ring"')
    expect(svg).toContain('class="focus-marker"')
  })

  it('draws one rect per board cell', () => {
    const cellRects = svg.match(/data-cell="/g) ?? []
    expect(cellRects.length).toBe(CERTAINTY_BOARD.width * CERTAINTY_BOARD.height)
  })
})
