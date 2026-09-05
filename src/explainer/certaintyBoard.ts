// The explainer's certainty-explanation illustration (design.md decision 6): the fixed toy
// board with one certain cell's explanation set already highlighted, since a still picture has
// no hover to ask for it. The drawing itself is `boardSvg.ts`; this module's job is to run the
// real `computeExplanations` against the fixture and turn its answer into that drawing's inputs.
import { toLabel } from '../board/chessLabel.ts'
import { computeExplanations, solve, type Coord, type SolverBoard } from '../solver/frontierSolver.ts'
import { renderBoardSvg } from './boardSvg.ts'

export function renderCertaintyBoard(board: SolverBoard, focusCell: Coord): string {
  const { result } = solve(board, new Map())
  const { explanations } = computeExplanations(board, result, new Set(), new Map())
  const focusLabel = toLabel(focusCell.row, focusCell.col)
  const explanation = explanations.get(`${focusCell.row},${focusCell.col}`)
  if (!explanation) throw new Error(`certainty fixture has no explanation for ${focusLabel}`)

  return renderBoardSvg(board, {
    clueCells: explanation.clueCells,
    premiseCells: explanation.premiseCells,
    focusCell,
    className: 'certainty-board',
    ariaLabel: `Toy board with ${focusLabel}'s certainty explanation highlighted`,
  })
}
