// The numbers and cell labels the article quotes in its prose, computed from the real solver rather
// than typed in. This is the guarantee the explainer is built around: the article cannot drift from
// the code it describes, because every figure in it is a solve. The article reaches these by
// importing this module and interpolating `{figures['name']}`.
import { toLabel } from '../lib/board/chessLabel.ts'
import { computeExplanations } from '../lib/solver/explanation.ts'
import { key } from '../lib/solver/types.ts'
import { CERTAINTY_BOARD, CERTAINTY_FOCUS_CELL, WORLDS_TREE_BOARD, WORLDS_TREE_FOCUS_CELL } from './fixtures.ts'
import { solveFixture } from './solvedFixture.ts'
import { buildWorldsTreeModel } from './worldsTree.ts'

/** Every value the article quotes, keyed by the name it quotes it under. */
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
