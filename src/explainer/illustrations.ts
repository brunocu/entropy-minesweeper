// Composes the explainer's static illustrations from the fixed fixtures and the generators.
// Runs at build time behind the endpoint that serves them; nothing here reaches the browser.
import { toLabel } from '../lib/board/chessLabel.ts'
import { type Coord, type SolverBoard } from '../lib/solver/types.ts'
import { renderBoardSvg } from './boardSvg.ts'
import { renderCertaintyBoard } from './certaintyBoard.ts'
import {
  CERTAINTY_BOARD,
  CERTAINTY_FOCUS_CELL,
  TRIVIAL_BOARD,
  TRIVIAL_FOCUS_CELL,
  UNCERTAINTY_CLIFF_MOVE,
  UNCERTAINTY_FLAT_SPAN,
  UNCERTAINTY_TRACE,
  WORLDS_TREE_BOARD,
  WORLDS_TREE_FOCUS_CELL,
} from './fixtures.ts'
import { solveFixture, type SolvedFixture } from './solvedFixture.ts'
import { renderUncertaintyChart, type ChartAnnotation } from './uncertaintyChartSvg.ts'
import { renderWorldsTree } from './worldsTree.ts'

export const UNCERTAINTY_ANNOTATIONS: readonly ChartAnnotation[] = [
  {
    span: UNCERTAINTY_FLAT_SPAN,
    label: 'flat stretch: three reveals that confirmed what was already known',
  },
  {
    span: [UNCERTAINTY_CLIFF_MOVE, UNCERTAINTY_CLIFF_MOVE],
    label: 'cliff: one reveal, most of the board',
  },
]

/**
 * The position each worlds tree is enumerating, drawn above it. Without this the tree's leaves
 * are labels with nothing to point at; with it the reader can check a branch against the board.
 */
export function renderWorldsTreeRootBoard(fixture: SolvedFixture, focusCell: Coord): string {
  const focusLabel = toLabel(focusCell.row, focusCell.col)
  return renderBoardSvg(fixture.board, fixture.result, {
    focusCell,
    labelUnrevealedCells: true,
    className: 'root-board',
    ariaLabel: `The toy board the worlds tree enumerates, with ${focusLabel} marked`,
  })
}

/**
 * A position drawn the way a player meets it, before any of this machinery has run: covered cells
 * are covered. The introduction asks the reader to do two deductions by hand, and both figures
 * would give their own answers away if they carried the heatmap.
 */
export function renderUnsolvedBoard(board: SolverBoard, focusCell: Coord | undefined, ariaLabel: string): string {
  return renderBoardSvg(board, null, {
    focusCell,
    labelUnrevealedCells: true,
    className: 'unsolved-board',
    ariaLabel,
  })
}

/**
 * Directory the illustrations are served from, relative to the site root. The endpoint's path is
 * its filename and cannot read this, so `illustrationFiles.test.ts` pins the two together.
 */
export const ILLUSTRATION_DIR = 'assets/explainer'

export interface Illustration {
  /** URL name, bare: no directory, no extension. e.g. `worlds-tree-eig`. */
  readonly name: string
  /** Complete, standalone SVG document. */
  readonly source: string
}

/**
 * Every illustration the explainer page loads, as its own SVG file - separately cacheable, and the
 * worlds-tree root board is one file referenced twice, which inlining could not do.
 */
export function buildIllustrationFiles(): Illustration[] {
  const file = (name: string, source: string): Illustration => ({ name, source })

  // One solve per fixture for the whole build: the root board, both worlds trees and the
  // certainty board below are all drawn from these, so they cannot disagree.
  const worldsTree = solveFixture(WORLDS_TREE_BOARD)
  const certainty = solveFixture(CERTAINTY_BOARD)

  return [
    file(
      'intro-trivial-board',
      renderUnsolvedBoard(
        TRIVIAL_BOARD,
        TRIVIAL_FOCUS_CELL,
        'A covered board where the 1 at A3 is adjacent to exactly one unknown cell, A2, which is ringed',
      ),
    ),
    file(
      'intro-open-board',
      renderUnsolvedBoard(
        WORLDS_TREE_BOARD,
        undefined,
        'The same covered board the rest of the article uses, where no single clue has only one way to be satisfied',
      ),
    ),
    file('worlds-tree-board', renderWorldsTreeRootBoard(worldsTree, WORLDS_TREE_FOCUS_CELL)),
    file('worlds-tree-probability', renderWorldsTree(worldsTree, WORLDS_TREE_FOCUS_CELL, 'probability')),
    file('worlds-tree-eig', renderWorldsTree(worldsTree, WORLDS_TREE_FOCUS_CELL, 'eig')),
    file('certainty-board', renderCertaintyBoard(certainty, CERTAINTY_FOCUS_CELL)),
    file('uncertainty-chart', renderUncertaintyChart(UNCERTAINTY_TRACE, UNCERTAINTY_ANNOTATIONS)),
  ]
}
