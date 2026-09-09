// Composes the explainer's static illustrations from the fixed fixtures and the generators.
// Everything here runs at build or dev-server time inside the Astro integration
// (`illustrationsIntegration.ts`); nothing in this module is shipped to the browser.
import { toLabel } from '../board/chessLabel.ts'
import { type Coord, type SolverBoard } from '../solver/types.ts'
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
 * Directory the illustrations are emitted into, relative to the site root. Deliberately the
 * same path in dev and in a build: the dev server serves these from memory and the build writes
 * them to `dist/`, and the article references one URL either way.
 */
export const ILLUSTRATION_DIR = 'assets/explainer'

export interface IllustrationFile {
  /** Path relative to the site root, e.g. `assets/explainer/worlds-tree-eig.svg`. */
  readonly fileName: string
  /** Complete, standalone SVG document. */
  readonly source: string
}

/**
 * Every illustration the explainer page loads, as its own SVG file.
 *
 * Emitted as files rather than inlined into the HTML so the browser can cache them separately
 * from the article and so the page stays legible to read and edit. The worlds-tree root board
 * appears above both trees and is one file referenced twice, which inlining could not do.
 */
export function buildIllustrationFiles(): IllustrationFile[] {
  const file = (name: string, source: string): IllustrationFile => ({
    fileName: `${ILLUSTRATION_DIR}/${name}.svg`,
    source,
  })

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
