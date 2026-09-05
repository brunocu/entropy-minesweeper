// Build-time SVG board renderer for the explainer's static illustrations. Draws a `SolverBoard`
// the way the live game draws it - same diverging probability fill, same EIG gradient on
// certain-safe cells, same certainty ring, same clue/premise highlight colors - but as SVG at a
// legible scale, with the annotations a still picture needs and hover cannot supply.
//
// Shared by the certainty-explanation illustration and by the root-board panels that sit above
// the worlds trees, so a cell is the same color in every figure on the page.
import { toLabel } from '../board/chessLabel.ts'
import {
  CLUE_HIGHLIGHT_COLOR,
  eigGradientColor,
  PREMISE_HIGHLIGHT_COLOR,
  probabilityColor,
} from '../render/probabilityColor.ts'
import { solve, type Coord, type SolverBoard } from '../solver/frontierSolver.ts'

/** Accent for "this is the cell under discussion", matching the EIG scale's violet. */
const FOCUS_COLOR = '#4a3aa7'

/** Fill for an unrevealed cell drawn without solver output: a plain covered square. */
const COVERED_COLOR = '#c3bdb3'

export interface BoardSvgOptions {
  readonly cellSize?: number
  /** Revealed cells whose clue the illustration's argument rests on. */
  readonly clueCells?: readonly Coord[]
  /** Unrevealed cells whose own forced status the argument leans on. */
  readonly premiseCells?: readonly Coord[]
  /** Cell the surrounding prose is about, ringed in the focus accent. */
  readonly focusCell?: Coord
  /** Writes each unrevealed cell's chess label into it, tying the board to the tree's leaves. */
  readonly labelUnrevealedCells?: boolean
  /**
   * Draws every unrevealed cell as a plain covered square - no probability fill, no EIG ramp, no
   * certainty ring. The introduction's boards are positions posed as questions, and painting the
   * solver's answer onto them answers the question before the reader has been asked it.
   */
  readonly hideSolverOutput?: boolean
  readonly className?: string
  readonly ariaLabel?: string
}

function escapeXml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!)
}

/** Renders a solved `SolverBoard` as standalone inline SVG markup. */
export function renderBoardSvg(board: SolverBoard, options: BoardSvgOptions = {}): string {
  const cellSize = options.cellSize ?? 54
  const margin = cellSize
  const result = options.hideSolverOutput ? null : solve(board, new Map()).result
  const frontier = result?.frontier ?? []
  const probabilities = new Map(frontier.map((f) => [`${f.row},${f.col}`, f.probability]))
  const eigs = new Map(frontier.map((f) => [`${f.row},${f.col}`, f.eig]))
  const clueKeys = new Set((options.clueCells ?? []).map((c) => `${c.row},${c.col}`))
  const premiseKeys = new Set((options.premiseCells ?? []).map((c) => `${c.row},${c.col}`))
  const focusKey = options.focusCell ? `${options.focusCell.row},${options.focusCell.col}` : null

  // Same normalization the live renderer does for the certain-safe EIG gradient, so a cell here
  // is the color a player would actually see on this position: low end fixed at 0 bits, high end
  // the observed max.
  const certainSafeEigs = frontier.filter((f) => f.probability === 0).map((f) => f.eig)
  const maxEig = certainSafeEigs.length > 0 ? Math.max(...certainSafeEigs) : null

  const width = board.width * cellSize + margin
  const height = board.height * cellSize + margin
  const parts: string[] = []

  for (let col = 0; col < board.width; col++) {
    parts.push(
      `<text x="${margin + col * cellSize + cellSize / 2}" y="${margin / 2 + 5}" text-anchor="middle" ` +
        `font-size="15" fill="#1a1a1a">${toLabel(0, col).replace(/\d+$/, '')}</text>`,
    )
  }
  for (let row = 0; row < board.height; row++) {
    parts.push(
      `<text x="${margin / 2}" y="${margin + row * cellSize + cellSize / 2 + 5}" text-anchor="middle" ` +
        `font-size="15" fill="#1a1a1a">${row + 1}</text>`,
    )
  }

  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      const cell = board.cells[row][col]
      const cellKey = `${row},${col}`
      const x = margin + col * cellSize
      const y = margin + row * cellSize
      const probability =
        cell.revealed || result === null ? null : (probabilities.get(cellKey) ?? result.nonFrontierProbability)
      const eig = eigs.get(cellKey) ?? null

      const fill = cell.revealed
        ? '#fcfcfb'
        : result === null
          ? COVERED_COLOR
          : probability === null
            ? '#95a5a6'
            : probability === 0 && eig !== null && maxEig !== null
              ? eigGradientColor(eig, maxEig)
              : probabilityColor(probability)

      parts.push(
        `<rect data-cell="${cellKey}" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" ` +
          `fill="${fill}" stroke="rgba(0,0,0,0.25)" stroke-width="1" />`,
      )

      if (cell.revealed && cell.adjacentMines > 0) {
        parts.push(
          `<text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 10}" text-anchor="middle" ` +
            `font-size="${Math.round(cellSize * 0.52)}" fill="#1a1a1a">${cell.adjacentMines}</text>`,
        )
      }

      // The live board's certainty ring: the fill alone cannot separate "leaning hard" from
      // "the solver is certain", which is often exactly the distinction under discussion.
      if (!cell.revealed && (probability === 0 || probability === 1)) {
        parts.push(
          `<rect class="certainty-ring" x="${x + 5}" y="${y + 5}" width="${cellSize - 10}" ` +
            `height="${cellSize - 10}" fill="none" stroke="#ffffff" stroke-width="5" />`,
        )
      }

      if (clueKeys.has(cellKey) || premiseKeys.has(cellKey)) {
        const role = clueKeys.has(cellKey) ? 'clue' : 'premise'
        parts.push(
          `<rect class="explanation-highlight explanation-highlight--${role}" data-highlight-cell="${cellKey}" ` +
            `x="${x + 10}" y="${y + 10}" width="${cellSize - 20}" height="${cellSize - 20}" fill="none" ` +
            `stroke="${role === 'clue' ? CLUE_HIGHLIGHT_COLOR : PREMISE_HIGHLIGHT_COLOR}" stroke-width="5" />`,
        )
      }

      if (cellKey === focusKey) {
        parts.push(
          `<rect class="focus-marker" x="${x + 10}" y="${y + 10}" width="${cellSize - 20}" ` +
            `height="${cellSize - 20}" fill="none" stroke="${FOCUS_COLOR}" stroke-width="4" stroke-dasharray="6 4" />`,
        )
      }

      // Outlined white so the label stays readable across the whole diverging fill range.
      if (options.labelUnrevealedCells && !cell.revealed) {
        parts.push(
          `<text class="cell-label" x="${x + cellSize / 2}" y="${y + cellSize / 2 + 6}" text-anchor="middle" ` +
            `font-size="16" font-weight="700" fill="#ffffff" stroke="rgba(0,0,0,0.6)" stroke-width="2.5" ` +
            `paint-order="stroke">${toLabel(row, col)}</text>`,
        )
      }
    }
  }

  return (
    `<svg class="board-svg${options.className ? ` ${options.className}` : ''}" xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" ` +
    `aria-label="${escapeXml(options.ariaLabel ?? 'Minesweeper board')}" ` +
    `font-family="system-ui, sans-serif">${parts.join('')}</svg>`
  )
}
