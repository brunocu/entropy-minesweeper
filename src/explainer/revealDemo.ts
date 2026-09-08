// The explainer's one runtime widget: a playable toy board where the reader clicks the focus
// cell, an outcome is drawn weighted by its real solver-computed probability, and the predicted
// EIG is set against the information that reveal actually delivered.
//
// It draws through the live game's own `BoardRenderer`, so the board here looks exactly like
// the board there, and it runs `computeRevealFeedback` - the same function `src/main.ts` calls
// after a real click - so neither number is hand-authored.
import { toLabel } from '../board/chessLabel.ts'
import { BoardRenderer, type RenderBoard, type RenderCell } from '../render/boardRenderer.ts'
import { cellSolverValues } from '../render/cellSolverValues.ts'
import { pixelToCell } from '../render/hitTest.ts'
import { decompose } from '../solver/decomposition.ts'
import { solve } from '../solver/probability.ts'
import { key, type Coord, type SolveResult, type SolverBoard } from '../solver/types.ts'
import { simulateReveal, worldCount, type SimulatedReveal } from './predictedVsRealized.ts'

const CELL_SIZE = 44

/** Matches the focus ring the static board illustrations draw, and the EIG scale's violet. */
const FOCUS_COLOR = '#4a3aa7'

export interface RevealDemoElements {
  readonly canvas: HTMLCanvasElement
  readonly predicted: HTMLElement
  readonly realized: HTMLElement
  readonly narration: HTMLElement
  readonly reset: HTMLButtonElement
}

/** Builds the render model for the pre-reveal position: what the live game would paint here. */
function toRenderBoard(
  board: SolverBoard,
  result: SolveResult,
  revealedCell: { readonly cell: Coord; readonly outcome: string } | null,
): RenderBoard {
  return {
    width: board.width,
    height: board.height,
    cells: board.cells.map((row, rowIndex) =>
      row.map((cell, colIndex): RenderCell => {
        const isRevealedTarget =
          revealedCell !== null && revealedCell.cell.row === rowIndex && revealedCell.cell.col === colIndex
        const hitMine = isRevealedTarget && revealedCell.outcome === 'mine'
        const revealed = cell.revealed || isRevealedTarget
        const adjacentMines =
          isRevealedTarget && !hitMine ? Number(revealedCell.outcome.slice('safe:'.length)) : cell.adjacentMines

        const { probability, eig } = cellSolverValues(result, key(rowIndex, colIndex), revealed)

        return {
          revealed,
          flagged: false,
          isMine: hitMine,
          adjacentMines,
          probability,
          eig,
          highlightRole: null,
        }
      }),
    ),
  }
}

function formatBits(bits: number): string {
  return `${bits.toFixed(3)} bits`
}

/**
 * Wires the widget to its elements. `random` is injectable so the draw can be driven
 * deterministically in tests.
 */
export function createRevealDemo(
  elements: RevealDemoElements,
  board: SolverBoard,
  focusCell: Coord,
  random: () => number = Math.random,
): { reset(): void } {
  const renderer = new BoardRenderer(elements.canvas, { cellSize: CELL_SIZE })
  const { result: preRevealSolve } = solve(decompose(board), new Map())
  const focusResult = preRevealSolve.frontierByKey.get(key(focusCell.row, focusCell.col))
  if (!focusResult) throw new Error(`demo cell ${focusCell.row},${focusCell.col} is not a frontier cell`)
  const focusLabel = toLabel(focusCell.row, focusCell.col)
  const worldsBefore = worldCount(preRevealSolve)

  let drawn: SimulatedReveal | null = null

  /**
   * Rings the one clickable cell, drawn straight onto the canvas after the board so it layers
   * over the fill the same way the static illustrations' focus marker does. `BoardRenderer`
   * has no notion of "the cell this widget is about", and teaching it one would put an
   * explainer-only concept into the live game's renderer.
   */
  const drawFocusRing = (): void => {
    const context = elements.canvas.getContext('2d')
    if (!context) return
    context.save()
    context.strokeStyle = FOCUS_COLOR
    context.lineWidth = 3
    context.setLineDash([5, 3])
    context.strokeRect(
      renderer.marginLeft + focusCell.col * CELL_SIZE + 4,
      renderer.marginTop + focusCell.row * CELL_SIZE + 4,
      CELL_SIZE - 8,
      CELL_SIZE - 8,
    )
    context.restore()
  }

  const render = (): void => {
    renderer.render(
      toRenderBoard(board, preRevealSolve, drawn === null ? null : { cell: focusCell, outcome: drawn.outcome }),
    )
    if (drawn === null) drawFocusRing()
    elements.reset.disabled = drawn === null

    elements.predicted.textContent = formatBits(focusResult.eig)

    if (drawn === null) {
      elements.realized.textContent = '?'
      elements.narration.innerHTML =
        `Click <strong>${focusLabel}</strong>, the cell ringed in violet. Before you do, the solver already ` +
        `knows there are <strong>${Math.round(worldsBefore)}</strong> arrangements of mines consistent with this ` +
        `board, and that revealing ${focusLabel} will cut that number down by ${formatBits(focusResult.eig)} ` +
        `<em>on average</em>. Which particular cut you get is up to the draw.`
      return
    }

    const { outcome, outcomeProbability, feedback } = drawn
    // The answer rules out every world inconsistent with it, leaving `p` of them standing.
    const worldsAfter = worldsBefore * outcomeProbability
    const shownOutcome = outcome === 'mine' ? 'a mine' : `a ${outcome.slice('safe:'.length)}`
    const comparison =
      feedback.revealedInformation > focusResult.eig
        ? 'more than the prediction'
        : feedback.revealedInformation < focusResult.eig
          ? 'less than the prediction'
          : 'exactly the prediction'

    elements.realized.textContent = formatBits(feedback.revealedInformation)
    elements.narration.innerHTML =
      `${focusLabel} came back as <strong>${shownOutcome}</strong>, an outcome with probability ` +
      `${(outcomeProbability * 100).toFixed(1)}%. That answer ruled out every arrangement inconsistent with it, ` +
      `taking the count from <strong>${Math.round(worldsBefore)}</strong> down to ` +
      `<strong>${Math.round(worldsAfter)}</strong>. The information delivered is the log of that ratio: ` +
      `log<sub>2</sub>(${Math.round(worldsBefore)}/${Math.round(worldsAfter)}) = ` +
      `<strong>${formatBits(feedback.revealedInformation)}</strong>, which is ${comparison} of ` +
      `${formatBits(focusResult.eig)}. Re-roll a few times: the realized values scatter, but they average back ` +
      `to the prediction, because that is all the prediction ever claimed to be.`
  }

  /** Whether a pointer event landed on the focus cell. */
  const isOnFocusCell = (event: MouseEvent): boolean => {
    const rect = elements.canvas.getBoundingClientRect()
    const cell = pixelToCell(
      event.clientX - rect.left - renderer.marginLeft,
      event.clientY - rect.top - renderer.marginTop,
      CELL_SIZE,
      board.width,
      board.height,
    )
    return cell !== null && cell.row === focusCell.row && cell.col === focusCell.col
  }

  // Only the focus cell is live: the widget is about one cell's prediction, and revealing any
  // other would leave the predicted number on screen describing a click that never happened.
  // The cursor says so, rather than letting clicks land silently on dead cells.
  elements.canvas.addEventListener('mousemove', (event) => {
    elements.canvas.style.cursor = drawn === null && isOnFocusCell(event) ? 'pointer' : 'default'
  })

  elements.canvas.addEventListener('click', (event) => {
    if (drawn !== null || !isOnFocusCell(event)) return
    drawn = simulateReveal(board, focusCell, random, preRevealSolve)
    render()
  })

  elements.reset.addEventListener('click', () => {
    drawn = null
    render()
  })

  render()
  return {
    reset(): void {
      drawn = null
      render()
    },
  }
}
