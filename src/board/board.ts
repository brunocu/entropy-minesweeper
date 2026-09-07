export interface Cell {
  isMine: boolean
  revealed: boolean
  flagged: boolean
  adjacentMines: number
}

export type GameStatus = 'pending' | 'playing' | 'won' | 'lost'

function createEmptyCell(): Cell {
  return { isMine: false, revealed: false, flagged: false, adjacentMines: 0 }
}

export class Board {
  readonly width: number
  readonly height: number
  readonly mineCount: number
  readonly cells: Cell[][]
  status: GameStatus = 'pending'
  private minesPlaced = false

  /**
   * When `layout` is given, those mines are placed immediately and the first reveal will not
   * relocate them; otherwise mines are placed on the first reveal, avoiding the clicked cell.
   */
  constructor(width: number, height: number, mineCount: number, layout?: boolean[][]) {
    if (width <= 0 || height <= 0) throw new Error('Board dimensions must be positive')
    if (mineCount < 0 || mineCount >= width * height) {
      throw new Error('mineCount must be between 0 and width*height - 1')
    }
    this.width = width
    this.height = height
    this.mineCount = mineCount
    this.cells = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => createEmptyCell()),
    )
    if (layout) {
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          this.cells[row][col].isMine = layout[row][col]
        }
      }
      this.computeAdjacentCounts()
      this.minesPlaced = true
    }
  }

  private inBounds(row: number, col: number): boolean {
    return row >= 0 && row < this.height && col >= 0 && col < this.width
  }

  private neighborCoords(row: number, col: number): [number, number][] {
    const result: [number, number][] = []
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const r = row + dr
        const c = col + dc
        if (this.inBounds(r, c)) result.push([r, c])
      }
    }
    return result
  }

  private computeAdjacentCounts(): void {
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        const cell = this.cells[row][col]
        if (cell.isMine) continue
        cell.adjacentMines = this.neighborCoords(row, col).filter(
          ([r, c]) => this.cells[r][c].isMine,
        ).length
      }
    }
  }

  private placeMines(excludeRow: number, excludeCol: number, rng: () => number = Math.random): void {
    const excluded = new Set<string>([`${excludeRow},${excludeCol}`])
    for (const [r, c] of this.neighborCoords(excludeRow, excludeCol)) {
      excluded.add(`${r},${c}`)
    }

    const candidates: [number, number][] = []
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        if (!excluded.has(`${row},${col}`)) candidates.push([row, col])
      }
    }

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }

    for (const [row, col] of candidates.slice(0, this.mineCount)) {
      this.cells[row][col].isMine = true
    }

    this.computeAdjacentCounts()
    this.minesPlaced = true
  }

  reveal(row: number, col: number, rng: () => number = Math.random): boolean {
    if (this.status === 'won' || this.status === 'lost') return false
    const cell = this.cells[row][col]
    if (cell.flagged || cell.revealed) return false

    if (!this.minesPlaced) {
      this.placeMines(row, col, rng)
    }
    this.status = 'playing'

    if (cell.isMine) {
      this.revealAllMines()
      this.status = 'lost'
      return true
    }

    this.floodReveal(row, col)

    if (this.isWon()) this.status = 'won'
    return true
  }

  private revealAllMines(): void {
    for (const row of this.cells) {
      for (const cell of row) {
        if (cell.isMine) cell.revealed = true
      }
    }
  }

  private floodReveal(row: number, col: number): void {
    const stack: [number, number][] = [[row, col]]
    while (stack.length > 0) {
      const [r, c] = stack.pop()!
      const cell = this.cells[r][c]
      if (cell.revealed || cell.flagged) continue
      cell.revealed = true
      if (cell.adjacentMines === 0) {
        for (const [nr, nc] of this.neighborCoords(r, c)) {
          if (!this.cells[nr][nc].revealed && !this.cells[nr][nc].isMine) {
            stack.push([nr, nc])
          }
        }
      }
    }
  }

  toggleFlag(row: number, col: number): boolean {
    if (this.status === 'won' || this.status === 'lost') return false
    const cell = this.cells[row][col]
    if (cell.revealed) return false
    cell.flagged = !cell.flagged
    return true
  }

  private isWon(): boolean {
    for (const row of this.cells) {
      for (const cell of row) {
        if (!cell.isMine && !cell.revealed) return false
      }
    }
    return true
  }
}
