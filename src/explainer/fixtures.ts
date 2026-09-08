// Hand-authored, fixed toy scenarios for the explainer page's illustrations
// Every fixture is a real, self-consistent minesweeper position:
// each revealed cell's number is its true adjacent-mine count for the layout the scenario
// describes, so the solver's answers about them are the answers a player would really get.
//
// Determinism is the point - "watch this specific deduction happen" only works if the
// scenario never changes. No random generation anywhere in this module.
import type { Coord, SolverBoard } from '../solver/types.ts'
import type { UncertaintyHistoryPoint } from '../render/uncertaintyChart.ts'

/**
 * Parses a compact grid literal into a `SolverBoard`: `?` is an unrevealed cell, a digit is
 * a revealed cell showing that adjacent-mine count. Keeps the fixtures below readable as
 * pictures of the board rather than as nested object literals.
 */
function parseSolverBoard(rows: readonly string[], mineCount: number): SolverBoard {
  const cells = rows.map((row) =>
    [...row].map((char) =>
      char === '?' ? { revealed: false, adjacentMines: 0 } : { revealed: true, adjacentMines: Number(char) },
    ),
  )
  return { width: rows[0].length, height: rows.length, mineCount, cells }
}

/**
 * The introduction's trivial deduction: the smallest position where a clue has exactly one way
 * to be satisfied. A3's `1` touches a single unknown, A2, so A2 is a mine; take that as a
 * premise and B1's `1` is already accounted for, so A1 is safe. Two cells, no counting, no
 * search - the deduction almost every flag in an ordinary game comes from.
 *
 * Drawn without solver output, because the point of the figure is the deduction the reader
 * makes, not the answer the solver would paint on it.
 */
export const TRIVIAL_BOARD: SolverBoard = parseSolverBoard(['?1', '?1', '11'], 1)

/** The forced mine the trivial deduction lands on, ringed in the introduction's figure. */
export const TRIVIAL_FOCUS_CELL: Coord = { row: 1, col: 0 }

/**
 * Worlds-tree scenario, shared by the probability and information-gain
 * illustrations. Five unknown cells; the pruned search over them ends in 12 tips, four of which
 * are consistent worlds.
 *
 * The deduction: B1's `1` sees only A1 and A2, so exactly one of that pair is a mine; C2's `1`
 * sees only B3 and C3, so exactly one of that pair is too; B2's `3` sees all five unknowns, and
 * with those two mines accounted for, A3 must be the third. What is left is two independent
 * coin-flips - four worlds, two bits.
 *
 * The focus cell A2 is the one worth clicking. It borders A1, A3 and B3, so its reading splits
 * the four worlds three ways (mine, or a 2, or a 3); A1 borders only A2, so its reading is a
 * single yes-or-no. Identical 50% risk, half a bit more information - the contrast the article
 * is built on - and A2's outcome groups differ in size, so the predicted-vs-realized demo gets
 * a realized value that actually varies between rolls.
 *
 * C1 is the only revealed blank, and every one of its neighbours is revealed: a 0 cascades, so
 * a board showing one next to an unknown is a position no game could reach. See the cascade-rule
 * test in fixtures.test.ts.
 */
export const WORLDS_TREE_BOARD: SolverBoard = parseSolverBoard(['?10', '?31', '???'], 3)

/** The cell the worlds-tree illustrations single out, in both probability and EIG mode. */
export const WORLDS_TREE_FOCUS_CELL: Coord = { row: 1, col: 0 }

/**
 * Certainty-explanation scenario, deliberately distinct from
 * the worlds-tree scenario because it demonstrates a different mechanism.
 *
 * The `1` at E2 has exactly one unrevealed neighbor, D1, so D1 must be the mine; the `1` at
 * D2 sees only D1 and C1, so with D1 spoken for, C1 is certainly safe. That two-step chain is
 * what the illustration's clue/premise highlighting shows: two clue cells and one premise cell.
 *
 * Trimmed to the informative rows for the same reason as the worlds-tree board: the two rows of
 * revealed blanks below these imposed no constraint and explained nothing.
 */
export const CERTAINTY_BOARD: SolverBoard = parseSolverBoard(['????1', '?2211'], 3)

/** The certainly-safe cell whose explanation the certainty illustration highlights. */
export const CERTAINTY_FOCUS_CELL: Coord = { row: 0, col: 2 }

/**
 * Canned uncertainty trace. Move 3 is the cliff - one reveal that
 * cascades and collapses most of the board's remaining uncertainty; moves 3 through 6 are the
 * flat stretch, three reveals that each confirm something the solver had largely pinned down.
 */
export const UNCERTAINTY_TRACE: readonly UncertaintyHistoryPoint[] = [
  { moveIndex: 0, totalEntropyBits: 42.0 },
  { moveIndex: 1, totalEntropyBits: 38.5 },
  { moveIndex: 2, totalEntropyBits: 35.2 },
  { moveIndex: 3, totalEntropyBits: 12.4 },
  { moveIndex: 4, totalEntropyBits: 11.9 },
  { moveIndex: 5, totalEntropyBits: 11.6 },
  { moveIndex: 6, totalEntropyBits: 11.5 },
  { moveIndex: 7, totalEntropyBits: 8.2 },
  { moveIndex: 8, totalEntropyBits: 5.1 },
  { moveIndex: 9, totalEntropyBits: 4.7 },
  { moveIndex: 10, totalEntropyBits: 2.0 },
  { moveIndex: 11, totalEntropyBits: 0.0 },
]

/** The move index the trace's "cliff" annotation points at (the decrease *into* this move). */
export const UNCERTAINTY_CLIFF_MOVE = 3

/** The inclusive move-index span the trace's "flat stretch" annotation brackets. */
export const UNCERTAINTY_FLAT_SPAN: readonly [number, number] = [4, 6]
