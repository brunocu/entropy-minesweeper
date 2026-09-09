// The certainty-explanation illustration: the toy board with one certain cell's explanation set
// already highlighted, since a still picture has no hover to ask for it. `boardSvg.ts` draws it;
// this module runs the real `computeExplanations` and turns its answer into that drawing's inputs.
import { toLabel } from '../lib/board/chessLabel.ts'
import { computeExplanations } from '../lib/solver/explanation.ts'
import type { Coord } from '../lib/solver/types.ts'
import { renderBoardSvg } from './boardSvg.ts'
import type { SolvedFixture } from './solvedFixture.ts'

export function renderCertaintyBoard(fixture: SolvedFixture, focusCell: Coord): string {
  const { board, decomposition, result } = fixture
  const { explanations } = computeExplanations(decomposition, result, new Set(), new Map())
  const focusLabel = toLabel(focusCell.row, focusCell.col)
  const explanation = explanations.get(`${focusCell.row},${focusCell.col}`)
  if (!explanation) throw new Error(`certainty fixture has no explanation for ${focusLabel}`)

  return renderBoardSvg(board, result, {
    clueCells: explanation.clueCells,
    premiseCells: explanation.premiseCells,
    focusCell,
    className: 'certainty-board',
    ariaLabel: `Toy board with ${focusLabel}'s certainty explanation highlighted`,
  })
}
