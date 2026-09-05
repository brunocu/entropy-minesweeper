// Traces 1:1 to the scenarios in
// openspec/changes/entropy-minesweeper/specs/minesweeper-board/spec.md
import { describe, expect, it } from 'vitest'
import { Board } from './board.ts'

describe('minesweeper-board spec scenarios (2.7)', () => {
  it('New board has correct mine count', () => {
    const board = new Board(6, 6, 8)
    board.reveal(0, 0)
    expect(board.cells.flat().filter((c) => c.isMine)).toHaveLength(8)
  })

  it('First click is never a mine', () => {
    for (let trial = 0; trial < 100; trial++) {
      const board = new Board(4, 4, 10)
      board.reveal(2, 2)
      expect(board.cells[2][2].isMine).toBe(false)
    }
  })

  it('First click opens an area', () => {
    for (let trial = 0; trial < 100; trial++) {
      const board = new Board(4, 4, 10)
      board.reveal(2, 2)
      expect(board.cells[2][2].adjacentMines).toBe(0)
      const revealedCount = board.cells.flat().filter((c) => c.revealed).length
      expect(revealedCount).toBeGreaterThan(1)
    }
  })

  it('Revealing a numbered cell', () => {
    const board = Board.fromMineLayout([
      [true, false],
      [false, false],
    ])
    board.reveal(0, 1)
    expect(board.cells[0][1].revealed).toBe(true)
    expect(board.cells[0][1].adjacentMines).toBe(1)
  })

  it('Revealing a mine', () => {
    const board = Board.fromMineLayout([
      [true, false],
      [false, false],
    ])
    board.reveal(0, 0)
    expect(board.cells[0][0].revealed).toBe(true)
    expect(board.status).toBe('lost')
  })

  it('Revealing a flagged cell is blocked', () => {
    const board = new Board(3, 3, 1)
    board.toggleFlag(0, 0)
    board.reveal(0, 0)
    expect(board.cells[0][0].flagged).toBe(true)
    expect(board.cells[0][0].revealed).toBe(false)
  })

  it('Revealing a zero-adjacency cell cascades', () => {
    const layout = Array.from({ length: 5 }, (_, _row) =>
      Array.from({ length: 5 }, (_, col) => col === 2),
    )
    const board = Board.fromMineLayout(layout)
    board.reveal(2, 0)
    for (let row = 0; row < 5; row++) {
      expect(board.cells[row][0].revealed).toBe(true)
      expect(board.cells[row][1].revealed).toBe(true)
      expect(board.cells[row][2].revealed).toBe(false)
    }
  })

  it('Flagging an unrevealed cell', () => {
    const board = new Board(3, 3, 1)
    board.toggleFlag(1, 1)
    expect(board.cells[1][1].flagged).toBe(true)
    board.reveal(1, 1)
    expect(board.cells[1][1].revealed).toBe(false)
  })

  it('Unflagging a flagged cell', () => {
    const board = Board.fromMineLayout([
      [true, false],
      [false, false],
    ])
    board.toggleFlag(1, 1)
    board.toggleFlag(1, 1)
    expect(board.cells[1][1].flagged).toBe(false)
    board.reveal(1, 1)
    expect(board.cells[1][1].revealed).toBe(true)
  })

  it('All non-mine cells revealed', () => {
    const board = Board.fromMineLayout([
      [true, false],
      [false, false],
    ])
    board.reveal(0, 1)
    board.reveal(1, 0)
    board.reveal(1, 1)
    expect(board.status).toBe('won')
  })

  it('Mine revealed ends the game', () => {
    const board = Board.fromMineLayout([
      [true, false],
      [false, false],
    ])
    board.reveal(0, 0)
    expect(board.status).toBe('lost')

    board.reveal(1, 1)
    board.toggleFlag(1, 0)
    expect(board.cells[1][1].revealed).toBe(false)
    expect(board.cells[1][0].flagged).toBe(false)
  })

  it('Losing reveals every mine on the board', () => {
    const board = Board.fromMineLayout([
      [true, false, true],
      [false, false, false],
    ])
    board.reveal(0, 0)
    expect(board.cells[0][0].revealed).toBe(true)
    expect(board.cells[0][2].revealed).toBe(true)
    expect(board.status).toBe('lost')
  })
})
