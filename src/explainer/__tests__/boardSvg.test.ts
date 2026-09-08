import { describe, expect, it } from 'vitest'
import { toLabel } from '../../board/chessLabel.ts'
import { TRIVIAL_BOARD, TRIVIAL_FOCUS_CELL, WORLDS_TREE_BOARD, WORLDS_TREE_FOCUS_CELL } from '../fixtures.ts'
import { renderUnsolvedBoard, renderWorldsTreeRootBoard } from '../illustrations.ts'
import { solveFixture } from '../solvedFixture.ts'

describe('worlds-tree root board', () => {
  const fixture = solveFixture(WORLDS_TREE_BOARD)
  const result = fixture.result
  const svg = renderWorldsTreeRootBoard(fixture, WORLDS_TREE_FOCUS_CELL)

  it('draws every cell of the position the tree enumerates', () => {
    const cells = svg.match(/data-cell="/g) ?? []
    expect(cells.length).toBe(WORLDS_TREE_BOARD.width * WORLDS_TREE_BOARD.height)
  })

  it('labels each unknown cell so the tree’s branches can be matched to the board', () => {
    const labels = (svg.match(/class="cell-label"[^>]*>([A-Z]+\d+)</g) ?? []).map((m) => m.match(/>([A-Z]+\d+)</)![1])
    const unknowns: string[] = []
    for (let row = 0; row < WORLDS_TREE_BOARD.height; row++) {
      for (let col = 0; col < WORLDS_TREE_BOARD.width; col++) {
        if (!WORLDS_TREE_BOARD.cells[row][col].revealed) unknowns.push(toLabel(row, col))
      }
    }
    expect(labels.sort()).toEqual(unknowns.sort())
  })

  it('marks the focus cell the tree singles out', () => {
    expect(svg).toContain('class="focus-marker"')
    expect(svg).toContain(toLabel(WORLDS_TREE_FOCUS_CELL.row, WORLDS_TREE_FOCUS_CELL.col))
  })

  it('carries no caption of its own — that text lives in the page', () => {
    // Baked-in captions overflowed the viewBox and could not be selected or translated. The
    // figures.test.ts suite checks the figcaption still quotes the right numbers.
    for (const match of svg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)) {
      expect(match[1].replace(/<[^>]+>/g, '').trim().length).toBeLessThanOrEqual(3)
    }
  })

  it('shows the certainly-mined cell with the live board’s certainty ring', () => {
    expect(result.frontier.some((f) => f.probability === 1)).toBe(true)
    expect(svg).toContain('class="certainty-ring"')
  })
})

describe('unsolved board', () => {
  // The introduction's figures pose deductions for the reader to make. A heatmap on them would
  // answer the question in the same breath as asking it, so these boards must carry no solver
  // output at all - not the probability fill, and not the ring that marks a cell as settled.
  const svg = renderUnsolvedBoard(TRIVIAL_BOARD, TRIVIAL_FOCUS_CELL, 'A covered board')
  const { result } = solveFixture(TRIVIAL_BOARD)

  it('draws every unrevealed cell in the same covered fill', () => {
    const fills = [...svg.matchAll(/data-cell="(\d+),(\d+)"[^>]*fill="([^"]+)"/g)]
      .filter(([, row, col]) => !TRIVIAL_BOARD.cells[Number(row)][Number(col)].revealed)
      .map((match) => match[3])
    expect(fills.length).toBeGreaterThan(1)
    expect(new Set(fills).size).toBe(1)
  })

  it('omits the certainty ring the solved renderer would draw here', () => {
    expect(result.frontier.some((f) => f.probability === 0 || f.probability === 1)).toBe(true)
    expect(svg).not.toContain('class="certainty-ring"')
  })

  it('still labels the unknown cells and rings the cell under discussion', () => {
    expect(svg).toContain('class="cell-label"')
    expect(svg).toContain('class="focus-marker"')
  })
})
