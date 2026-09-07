import { describe, expect, it } from 'vitest'
import { toLabel } from '../board/chessLabel.ts'
import { computeExplanations, solve, type SolveResult } from '../solver/frontierSolver.ts'
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

// The cell whose EIG the prose contrasts with the focus cell's: same probability, strictly
// less information, because its reading only ever answers one yes-or-no. Only the tests
// name it, so it lives here rather than in fixtures.ts.
const WORLDS_TREE_CONTRAST_CELL = { row: 0, col: 0 }

function frontierAt(result: SolveResult, row: number, col: number) {
  const found = result.frontier.find((f) => f.row === row && f.col === col)
  expect(found, `no frontier result at ${row},${col}`).toBeDefined()
  return found!
}

describe('trivial-deduction fixture', () => {
  // The introduction claims this board is the one-clue-at-a-time deduction: A3's `1` names A2
  // outright, and A2 as a premise makes A1 safe. If the fixture ever stops saying that, the
  // article's opening is telling a story about a picture that no longer shows it.
  const { result } = solve(TRIVIAL_BOARD, new Map())
  const { explanations } = computeExplanations(TRIVIAL_BOARD, result, new Set(), new Map())

  it('forces the focus cell to be a mine and the cell above it to be safe', () => {
    expect(frontierAt(result, TRIVIAL_FOCUS_CELL.row, TRIVIAL_FOCUS_CELL.col).probability).toBe(1)
    expect(frontierAt(result, 0, 0).probability).toBe(0)
  })

  it('needs one clue and no premise for the mine', () => {
    const explanation = explanations.get(`${TRIVIAL_FOCUS_CELL.row},${TRIVIAL_FOCUS_CELL.col}`)!
    expect(explanation.clueCells.length).toBe(1)
    expect(explanation.premiseCells).toEqual([])
  })

  it('leans on that mine as a premise for the safe cell', () => {
    const explanation = explanations.get('0,0')!
    expect(explanation.premiseCells).toContainEqual(TRIVIAL_FOCUS_CELL)
  })
})

describe('worlds-tree fixture (1.1)', () => {
  const { result } = solve(WORLDS_TREE_BOARD, new Map())

  it('solves without error, every frontier cell getting a real probability', () => {
    expect(result.frontier.length).toBe(5)
    for (const f of result.frontier) {
      expect(Number.isNaN(f.probability)).toBe(false)
      expect(f.probability).toBeGreaterThanOrEqual(0)
      expect(f.probability).toBeLessThanOrEqual(1)
    }
  })

  it('has a certain cell and uncertain cells', () => {
    const certain = result.frontier.filter((f) => f.probability === 0 || f.probability === 1)
    const uncertain = result.frontier.filter((f) => f.probability > 0 && f.probability < 1)
    expect(certain.map((f) => `${f.row},${f.col}`).sort()).toEqual(['2,0'])
    for (const f of certain) expect(f.probability).toBe(1)
    expect(uncertain.length).toBe(4)
    for (const f of uncertain) expect(f.probability).toBeCloseTo(1 / 2, 10)
  })

  it('keeps every unknown cell on the frontier, so the tree needs no extra levels', () => {
    expect(result.frontier.length).toBe(5)
    expect(result.nonFrontierCells).toEqual([])
  })

  it('gives the focus and contrast cells equal probability but clearly different EIG', () => {
    const focus = frontierAt(result, WORLDS_TREE_FOCUS_CELL.row, WORLDS_TREE_FOCUS_CELL.col)
    const contrast = frontierAt(result, WORLDS_TREE_CONTRAST_CELL.row, WORLDS_TREE_CONTRAST_CELL.col)
    expect(focus.probability).toBeCloseTo(contrast.probability, 10)
    // The focus cell's reading splits the four worlds three ways, H(1/2, 1/4, 1/4); the contrast
    // cell only answers one yes-or-no, H(1/2, 1/2). Same risk, half a bit apart.
    expect(focus.eig).toBeCloseTo(1.5, 10)
    expect(contrast.eig).toBeCloseTo(1, 10)
  })

  it('gives the focus cell outcome groups of differing size', () => {
    // The predicted-vs-realized demo is only worth running if the realized value varies, which
    // it does exactly when the outcomes leave differently-sized sets of worlds standing.
    const focus = frontierAt(result, WORLDS_TREE_FOCUS_CELL.row, WORLDS_TREE_FOCUS_CELL.col)
    const worlds = 2 ** result.totalEntropyBits
    const groupSizes = [...focus.outcomeProbabilities.values()].map((p) => Math.round(p * worlds))
    expect(groupSizes.length).toBeGreaterThanOrEqual(3)
    expect(new Set(groupSizes).size).toBeGreaterThanOrEqual(2)
  })
})

describe('certainty-explanation fixture (1.2)', () => {
  const { result } = solve(CERTAINTY_BOARD, new Map())
  const { explanations } = computeExplanations(CERTAINTY_BOARD, result, new Set(), new Map())
  const focusKey = `${CERTAINTY_FOCUS_CELL.row},${CERTAINTY_FOCUS_CELL.col}`

  it('makes the focus cell certainly safe', () => {
    expect(frontierAt(result, CERTAINTY_FOCUS_CELL.row, CERTAINTY_FOCUS_CELL.col).probability).toBe(0)
  })

  it('explains the focus cell with both clue and premise cells', () => {
    const explanation = explanations.get(focusKey)
    expect(explanation).toBeDefined()
    expect(explanation!.clueCells.length).toBeGreaterThan(0)
    expect(explanation!.premiseCells.length).toBeGreaterThan(0)
  })

  it('picks out the two-step chain the illustration narrates', () => {
    const explanation = explanations.get(focusKey)!
    // Both `1`s next to the premise (E1 and E2) pin it down on their own, so either pairs with
    // D2 into an equally minimal chain; the article's prose narrates whichever one is highlighted.
    expect(explanation.clueCells.map((c) => `${c.row},${c.col}`).sort()).toEqual(['0,4', '1,3'])
    expect(explanation.premiseCells.map((c) => `${c.row},${c.col}`)).toEqual(['0,3'])
  })
})

describe('fixture boards are positions a real game could produce', () => {
  const boards = [
    { name: 'trivial', board: TRIVIAL_BOARD },
    { name: 'worlds-tree', board: WORLDS_TREE_BOARD },
    { name: 'certainty', board: CERTAINTY_BOARD },
  ]

  for (const { name, board } of boards) {
    it(`${name}: no revealed blank sits next to an unrevealed cell`, () => {
      // Revealing a cell with no adjacent mines cascades into its neighbours (Board.floodReveal),
      // so a revealed 0 always ends up fully surrounded by revealed cells. A board that shows a
      // 0 touching an unknown is unreachable, and a reader who knows minesweeper spots it.
      const violations: string[] = []
      for (let row = 0; row < board.height; row++) {
        for (let col = 0; col < board.width; col++) {
          const cell = board.cells[row][col]
          if (!cell.revealed || cell.adjacentMines !== 0) continue
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const r = row + dr
              const c = col + dc
              if (r < 0 || r >= board.height || c < 0 || c >= board.width) continue
              if (!board.cells[r][c].revealed) {
                violations.push(`blank ${toLabel(row, col)} touches unrevealed ${toLabel(r, c)}`)
              }
            }
          }
        }
      }
      expect(violations).toEqual([])
    })
  }
})

describe('fixture boards carry no dead space', () => {
  // A row or column of revealed blanks constrains nothing and is never worth explaining, but a
  // reader still tries to read meaning into it. Every line of an illustrated board must earn
  // its place: hold an unknown cell, or a clue that constrains one.
  const boards = [
    { name: 'trivial', board: TRIVIAL_BOARD },
    { name: 'worlds-tree', board: WORLDS_TREE_BOARD },
    { name: 'certainty', board: CERTAINTY_BOARD },
  ]

  function lineIsInformative(cells: readonly { revealed: boolean; adjacentMines: number }[]): boolean {
    return cells.some((cell) => !cell.revealed || cell.adjacentMines > 0)
  }

  for (const { name, board } of boards) {
    it(`${name}: every row says something`, () => {
      board.cells.forEach((row, index) => {
        expect(lineIsInformative(row), `row ${index + 1} is all revealed blanks`).toBe(true)
      })
    })

    it(`${name}: every column says something`, () => {
      for (let col = 0; col < board.width; col++) {
        const column = board.cells.map((row) => row[col])
        expect(lineIsInformative(column), `column ${col + 1} is all revealed blanks`).toBe(true)
      }
    })
  }
})

describe('uncertainty-chart trace (1.3)', () => {
  const drops = UNCERTAINTY_TRACE.slice(1).map(
    (point, i) => UNCERTAINTY_TRACE[i].totalEntropyBits - point.totalEntropyBits,
  )

  it('decreases monotonically, as real total uncertainty does', () => {
    for (const drop of drops) expect(drop).toBeGreaterThanOrEqual(0)
  })

  it('has a cliff at the annotated move that dwarfs the annotated flat stretch', () => {
    const cliffIndex = UNCERTAINTY_TRACE.findIndex((p) => p.moveIndex === UNCERTAINTY_CLIFF_MOVE)
    const cliffDrop =
      UNCERTAINTY_TRACE[cliffIndex - 1].totalEntropyBits - UNCERTAINTY_TRACE[cliffIndex].totalEntropyBits

    const [flatStart, flatEnd] = UNCERTAINTY_FLAT_SPAN
    const startPoint = UNCERTAINTY_TRACE.find((p) => p.moveIndex === flatStart)!
    const endPoint = UNCERTAINTY_TRACE.find((p) => p.moveIndex === flatEnd)!
    const flatTotalDrop =
      UNCERTAINTY_TRACE[UNCERTAINTY_TRACE.indexOf(startPoint) - 1].totalEntropyBits - endPoint.totalEntropyBits

    expect(flatEnd - flatStart).toBeGreaterThanOrEqual(2)
    expect(cliffDrop).toBeGreaterThan(flatTotalDrop * 10)
    expect(cliffDrop).toBe(Math.max(...drops))
  })
})
