import { describe, expect, it } from 'vitest'
import { Board } from '../board.ts'
import { boardFromMineLayout } from '../../__tests__/support/boardFactory.ts'

describe('board construction (2.1)', () => {
  it.each([
    [8, 8, 10],
    [30, 16, 99],
    [1, 1, 0],
    [5, 3, 4],
  ])('builds a %ix%i board with %i mines', (width, height, mineCount) => {
    const board = new Board(width, height, mineCount)
    expect(board.width).toBe(width)
    expect(board.height).toBe(height)
    expect(board.mineCount).toBe(mineCount)
    expect(board.cells).toHaveLength(height)
    for (const row of board.cells) {
      expect(row).toHaveLength(width)
      for (const cell of row) {
        expect(cell).toEqual({ isMine: false, revealed: false, flagged: false, adjacentMines: 0 })
      }
    }
    expect(board.status).toBe('pending')
  })
})

describe('deferred first-click-safe mine placement (2.2)', () => {
  it('never places a mine on the first-clicked cell or its neighbors, across many trials', () => {
    const width = 5
    const height = 5
    const mineCount = 10 // dense enough to stress the exclusion, but still fits when the click lands center-board (25 - 9 = 16 candidates)
    for (let trial = 0; trial < 300; trial++) {
      const board = new Board(width, height, mineCount)
      const clickRow = Math.floor(Math.random() * height)
      const clickCol = Math.floor(Math.random() * width)
      board.reveal(clickRow, clickCol)

      expect(board.cells[clickRow][clickCol].isMine).toBe(false)
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = clickRow + dr
          const c = clickCol + dc
          if (r < 0 || r >= height || c < 0 || c >= width) continue
          expect(board.cells[r][c].isMine).toBe(false)
        }
      }
      expect(board.cells.flat().filter((c) => c.isMine)).toHaveLength(mineCount)
    }
  })
})

describe('single-cell reveal (2.3)', () => {
  it('revealing a numbered cell exposes its adjacent mine count', () => {
    // 3x3 board, single mine at (0,0); revealing (2,2) is far from mine
    // but (1,1) or edges adjacent to it become numbered.
    const board = boardFromMineLayout([
      [true, false, false],
      [false, false, false],
      [false, false, false],
    ])
    board.reveal(0, 1)
    expect(board.cells[0][1].revealed).toBe(true)
    expect(board.cells[0][1].isMine).toBe(false)
    expect(board.cells[0][1].adjacentMines).toBe(1)
    expect(board.status).toBe('playing')
  })

  it('revealing a mine ends the game in a loss', () => {
    const board = boardFromMineLayout([
      [true, false, false],
      [false, false, false],
      [false, false, false],
    ])
    board.reveal(0, 0)
    expect(board.cells[0][0].revealed).toBe(true)
    expect(board.status).toBe('lost')
  })

  it('revealing a mine reveals every mine on the board, not only the one clicked', () => {
    const board = boardFromMineLayout([
      [true, false, true],
      [false, false, false],
      [true, false, false],
    ])
    board.reveal(0, 0)
    expect(board.cells[0][0].revealed).toBe(true)
    expect(board.cells[0][2].revealed).toBe(true)
    expect(board.cells[2][0].revealed).toBe(true)
    expect(board.status).toBe('lost')
  })
})

describe('flood-fill reveal (2.4)', () => {
  it('reveals exactly the connected zero region plus its numbered border, on a known layout', () => {
    // 5x5 board: mines fill column 2, splitting the board into an
    // isolated zero region in columns 0-1 and untouched columns 3-4.
    const layout = Array.from({ length: 5 }, (_, _row) =>
      Array.from({ length: 5 }, (_, col) => col === 2),
    )
    const board = boardFromMineLayout(layout)

    board.reveal(2, 0)

    const revealed = new Set<string>()
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (board.cells[row][col].revealed) revealed.add(`${row},${col}`)
      }
    }

    const expected = new Set<string>()
    for (let row = 0; row < 5; row++) {
      expected.add(`${row},0`)
      expected.add(`${row},1`)
    }

    expect(revealed).toEqual(expected)
    // the cascade must stop at the numbered column-1 border, never reaching the mines
    for (let row = 0; row < 5; row++) {
      expect(board.cells[row][2].revealed).toBe(false)
      expect(board.cells[row][3].revealed).toBe(false)
      expect(board.cells[row][4].revealed).toBe(false)
    }
  })
})

describe('flagging (2.5)', () => {
  it('toggles a flag on an unrevealed cell', () => {
    const board = new Board(3, 3, 1)
    board.toggleFlag(1, 1)
    expect(board.cells[1][1].flagged).toBe(true)
    board.toggleFlag(1, 1)
    expect(board.cells[1][1].flagged).toBe(false)
  })

  it('blocks reveal on a flagged cell', () => {
    const board = boardFromMineLayout([
      [true, false],
      [false, false],
    ])
    board.toggleFlag(1, 1)
    board.reveal(1, 1)
    expect(board.cells[1][1].flagged).toBe(true)
    expect(board.cells[1][1].revealed).toBe(false)
    expect(board.status).toBe('playing')
  })
})

describe('reveal/toggleFlag report whether they mutated state', () => {
  it('reveal returns true for a state-changing reveal', () => {
    const board = boardFromMineLayout([
      [true, false],
      [false, false],
    ])
    expect(board.reveal(0, 1)).toBe(true)
  })

  it('reveal returns true when it reveals a mine and loses the game', () => {
    const board = boardFromMineLayout([
      [true, false],
      [false, false],
    ])
    expect(board.reveal(0, 0)).toBe(true)
  })

  it('reveal returns false for an already-revealed cell', () => {
    const board = boardFromMineLayout([
      [true, false],
      [false, false],
    ])
    board.reveal(0, 1)
    expect(board.reveal(0, 1)).toBe(false)
  })

  it('reveal returns false for a flagged cell', () => {
    const board = new Board(3, 3, 1)
    board.toggleFlag(1, 1)
    expect(board.reveal(1, 1)).toBe(false)
  })

  it('reveal returns false once the game is won or lost', () => {
    const board = boardFromMineLayout([
      [true, false],
      [false, false],
    ])
    board.reveal(0, 0)
    expect(board.status).toBe('lost')
    expect(board.reveal(1, 1)).toBe(false)
  })

  it('toggleFlag returns true when it toggles the flag', () => {
    const board = new Board(3, 3, 1)
    expect(board.toggleFlag(1, 1)).toBe(true)
    expect(board.toggleFlag(1, 1)).toBe(true)
  })

  it('toggleFlag returns false for an already-revealed cell', () => {
    const board = boardFromMineLayout([
      [true, false],
      [false, false],
    ])
    board.reveal(0, 1)
    expect(board.toggleFlag(0, 1)).toBe(false)
  })

  it('toggleFlag returns false once the game is won or lost', () => {
    const board = boardFromMineLayout([
      [true, false],
      [false, false],
    ])
    board.reveal(0, 0)
    expect(board.status).toBe('lost')
    expect(board.toggleFlag(1, 1)).toBe(false)
  })
})

describe('win/loss detection (2.6)', () => {
  it('declares a win the moment every non-mine cell is revealed', () => {
    const board = boardFromMineLayout([
      [true, false],
      [false, false],
    ])
    board.reveal(0, 1)
    board.reveal(1, 0)
    board.reveal(1, 1)
    expect(board.status).toBe('won')
  })

  it('declares a loss and disables further actions once a mine is revealed', () => {
    const board = boardFromMineLayout([
      [true, false],
      [false, false],
    ])
    board.reveal(0, 0)
    expect(board.status).toBe('lost')

    board.reveal(1, 1)
    expect(board.cells[1][1].revealed).toBe(false)

    board.toggleFlag(1, 0)
    expect(board.cells[1][0].flagged).toBe(false)
  })
})
