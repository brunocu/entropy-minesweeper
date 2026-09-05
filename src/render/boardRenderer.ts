// Canvas2D board renderer (design.md decision 2): one surface, a flat draw loop that
// redraws cell fills every board-state change. No per-cell DOM nodes, no framework.
import { toLabel } from '../board/chessLabel.ts'
import { CLUE_HIGHLIGHT_COLOR, eigGradientColor, PREMISE_HIGHLIGHT_COLOR, probabilityColor } from './probabilityColor.ts'

/** Certainty-explanation highlight role for a cell (frontier-certainty-explanation), or none. */
export type HighlightRole = 'clue' | 'premise' | null

export interface RenderCell {
  readonly revealed: boolean
  readonly flagged: boolean
  readonly isMine: boolean
  readonly adjacentMines: number
  /** Mine probability for an unrevealed cell, or null when not yet solved / not applicable. */
  readonly probability: number | null
  /** Frontier cell's expected information gain, or null for non-frontier/revealed/flagged cells. */
  readonly eig: number | null
  /** Certainty-explanation highlight role for the currently inspected cell, or null when not highlighted. */
  readonly highlightRole: HighlightRole
}

export interface RenderBoard {
  readonly width: number
  readonly height: number
  readonly cells: readonly (readonly RenderCell[])[]
}

export interface RendererOptions {
  readonly cellSize: number
}

export class BoardRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private readonly canvas: HTMLCanvasElement
  private readonly cellSize: number
  /** Screen-space offset reserved for row-number/column-letter axis labels. */
  readonly marginLeft: number
  readonly marginTop: number

  constructor(canvas: HTMLCanvasElement, options: RendererOptions) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable')
    this.canvas = canvas
    this.ctx = ctx
    this.cellSize = options.cellSize
    this.marginLeft = options.cellSize
    this.marginTop = options.cellSize
  }

  render(board: RenderBoard): void {
    const { cellSize, marginLeft, marginTop } = this
    this.canvas.width = board.width * cellSize + marginLeft
    this.canvas.height = board.height * cellSize + marginTop
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // First pass: collect the max EIG among unrevealed, unflagged, certain-safe (p=0) frontier
    // cells to normalize the EIG-gradient fill's high end against this render's own range; the
    // low end is always 0, not this render's minimum (design.md decision 1, revised).
    let maxEig: number | null = null
    for (let row = 0; row < board.height; row++) {
      for (let col = 0; col < board.width; col++) {
        const cell = board.cells[row][col]
        if (cell.revealed || cell.flagged || cell.probability !== 0 || cell.eig === null) continue
        maxEig = maxEig === null ? cell.eig : Math.max(maxEig, cell.eig)
      }
    }

    for (let row = 0; row < board.height; row++) {
      for (let col = 0; col < board.width; col++) {
        const cell = board.cells[row][col]
        const x = marginLeft + col * cellSize
        const y = marginTop + row * cellSize

        ctx.fillStyle = this.fillColorFor(cell, maxEig)
        ctx.fillRect(x, y, cellSize, cellSize)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1)

        // Certainty ring: the diverging fill alone can't distinguish "leaning strongly"
        // from "the solver is certain" near the poles, so exact certainty (H(p)=0, i.e.
        // p=0 or p=1) gets its own unambiguous marker on top of the fill.
        if (!cell.revealed && !cell.flagged && (cell.probability === 0 || cell.probability === 1)) {
          const inset = 3
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 3
          ctx.strokeRect(x + inset, y + inset, cellSize - inset * 2, cellSize - inset * 2)
        }

        if (cell.revealed && !cell.isMine && cell.adjacentMines > 0) {
          ctx.fillStyle = '#1a1a1a'
          ctx.font = `${Math.round(cellSize * 0.6)}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(cell.adjacentMines), x + cellSize / 2, y + cellSize / 2)
        }

        if (cell.revealed && cell.isMine) {
          ctx.fillStyle = '#1a1a1a'
          ctx.beginPath()
          ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.3, 0, Math.PI * 2)
          ctx.fill()
        }

        if (!cell.revealed && cell.flagged) {
          ctx.fillStyle = '#c0392b'
          ctx.beginPath()
          ctx.moveTo(x + cellSize * 0.35, y + cellSize * 0.2)
          ctx.lineTo(x + cellSize * 0.35, y + cellSize * 0.8)
          ctx.lineTo(x + cellSize * 0.75, y + cellSize * 0.5)
          ctx.closePath()
          ctx.fill()
        }

        // Certainty-explanation highlight (design.md decision 5): a second, further-inset
        // additive stroke layered on top of everything above (including the certainty ring),
        // never replacing a cell's existing fill/marker state.
        if (cell.highlightRole !== null) {
          const inset = 6
          ctx.strokeStyle = cell.highlightRole === 'clue' ? CLUE_HIGHLIGHT_COLOR : PREMISE_HIGHLIGHT_COLOR
          ctx.lineWidth = 3
          ctx.strokeRect(x + inset, y + inset, cellSize - inset * 2, cellSize - inset * 2)
        }
      }
    }

    this.drawAxisLabels(board, marginLeft, marginTop)
  }

  private drawAxisLabels(board: RenderBoard, marginLeft: number, marginTop: number): void {
    const { ctx, cellSize } = this
    ctx.fillStyle = '#1a1a1a'
    ctx.font = `${Math.round(cellSize * 0.4)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let col = 0; col < board.width; col++) {
      const label = toLabel(0, col).replace(/\d+$/, '')
      ctx.fillText(label, marginLeft + col * cellSize + cellSize / 2, marginTop / 2)
    }

    for (let row = 0; row < board.height; row++) {
      const label = String(row + 1)
      ctx.fillText(label, marginLeft / 2, marginTop + row * cellSize + cellSize / 2)
    }
  }

  private fillColorFor(cell: RenderCell, maxEig: number | null): string {
    // Cleared cells use the palette's near-white chart surface, deliberately far from the
    // diverging scale's mid-gray neutral midpoint (#f0efec) so "cleared" and "totally
    // uncertain" never read as the same color.
    if (cell.revealed) return cell.isMine ? '#e74c3c' : '#fcfcfb'
    if (cell.flagged) return '#7f8c8d'
    // Certain-safe frontier cells (p=0, has an individual EIG) get the sequential EIG-gradient
    // fill instead of the diverging scale's flat safe-pole color (spec: Certain-Safe Frontier
    // Cell EIG Gradient). Certain-safe non-frontier cells (eig === null) keep the flat pole color.
    if (cell.probability === 0 && cell.eig !== null && maxEig !== null) {
      return eigGradientColor(cell.eig, maxEig)
    }
    return cell.probability === null ? '#95a5a6' : probabilityColor(cell.probability)
  }
}
