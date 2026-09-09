// The explainer's one runtime widget: a playable toy board where the reader clicks the focus cell,
// an outcome is drawn weighted by its real solver-computed probability, and the predicted EIG is set
// against the information that reveal actually delivered.
//
// It draws through the live game's own `BoardRenderer`, so the board here looks exactly like the
// board there, and it runs `computeRevealFeedback` - the same function the game calls after a real
// click - so neither number is hand-authored.
//
// Markup and behaviour live together here. They used to be an HTML block in the article and a
// module beside it, joined by five element IDs; the article now says `<RevealDemo client:visible />`
// and the IDs are gone.
import { createEffect, createMemo, createSignal, onMount, type JSX } from 'solid-js'
import { toLabel } from '../board/chessLabel.ts'
import { BoardRenderer, type RenderBoard, type RenderCell } from '../render/boardRenderer.ts'
import { cellSolverValues } from '../render/cellSolverValues.ts'
import { pixelToCell } from '../render/hitTest.ts'
import { decompose } from '../solver/decomposition.ts'
import { solve } from '../solver/probability.ts'
import { key, type Coord, type SolveResult, type SolverBoard } from '../solver/types.ts'
import { WORLDS_TREE_BOARD, WORLDS_TREE_FOCUS_CELL } from './fixtures.ts'
import { simulateReveal, worldCount, type SimulatedReveal } from './predictedVsRealized.ts'

const CELL_SIZE = 44

/** Matches the focus ring the static board illustrations draw, and the EIG scale's violet. */
const FOCUS_COLOR = '#4a3aa7'

export interface RevealDemoProps {
  readonly board?: SolverBoard
  readonly focusCell?: Coord
  /** Injectable so the draw can be driven deterministically in tests. */
  readonly random?: () => number
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

export function RevealDemo(props: RevealDemoProps): JSX.Element {
  const board = (): SolverBoard => props.board ?? WORLDS_TREE_BOARD
  const focusCell = (): Coord => props.focusCell ?? WORLDS_TREE_FOCUS_CELL
  const random = (): (() => number) => props.random ?? Math.random

  const preRevealSolve = createMemo(() => solve(decompose(board()), new Map()).result)
  const focusResult = createMemo(() => {
    const cell = focusCell()
    const result = preRevealSolve().frontierByKey.get(key(cell.row, cell.col))
    if (!result) throw new Error(`demo cell ${cell.row},${cell.col} is not a frontier cell`)
    return result
  })
  const focusLabel = createMemo(() => toLabel(focusCell().row, focusCell().col))
  const worldsBefore = createMemo(() => worldCount(preRevealSolve()))

  const [drawn, setDrawn] = createSignal<SimulatedReveal | null>(null)

  let canvas!: HTMLCanvasElement
  let renderer: BoardRenderer | undefined

  /**
   * Rings the one clickable cell, drawn straight onto the canvas after the board so it layers over
   * the fill the same way the static illustrations' focus marker does. `BoardRenderer` has no
   * notion of "the cell this widget is about", and teaching it one would put an explainer-only
   * concept into the live game's renderer.
   */
  const drawFocusRing = (): void => {
    if (!renderer) return
    const context = canvas.getContext('2d')
    if (!context) return
    const cell = focusCell()
    context.save()
    context.strokeStyle = FOCUS_COLOR
    context.lineWidth = 3
    context.setLineDash([5, 3])
    context.strokeRect(
      renderer.marginLeft + cell.col * CELL_SIZE + 4,
      renderer.marginTop + cell.row * CELL_SIZE + 4,
      CELL_SIZE - 8,
      CELL_SIZE - 8,
    )
    context.restore()
  }

  onMount(() => {
    renderer = new BoardRenderer(canvas, { cellSize: CELL_SIZE })
  })

  // Repaints whenever the draw changes, which is the only thing that changes the board here.
  createEffect(() => {
    const current = drawn()
    if (!renderer) return
    renderer.render(
      toRenderBoard(board(), preRevealSolve(), current === null ? null : { cell: focusCell(), outcome: current.outcome }),
    )
    if (current === null) drawFocusRing()
  })

  /** Whether a pointer event landed on the focus cell. */
  const isOnFocusCell = (event: MouseEvent): boolean => {
    if (!renderer) return false
    const rect = canvas.getBoundingClientRect()
    const cell = pixelToCell(
      event.clientX - rect.left - renderer.marginLeft,
      event.clientY - rect.top - renderer.marginTop,
      CELL_SIZE,
      board().width,
      board().height,
    )
    return cell !== null && cell.row === focusCell().row && cell.col === focusCell().col
  }

  const narration = (): JSX.Element => {
    const current = drawn()
    if (current === null) {
      return (
        <>
          Click <strong>{focusLabel()}</strong>, the cell ringed in violet. Before you do, the solver already
          knows there are <strong>{Math.round(worldsBefore())}</strong> arrangements of mines consistent with
          this board, and that revealing {focusLabel()} will cut that number down by{' '}
          {formatBits(focusResult().eig)} <em>on average</em>. Which particular cut you get is up to the draw.
        </>
      )
    }

    const { outcome, outcomeProbability, feedback } = current
    // The answer rules out every world inconsistent with it, leaving `p` of them standing.
    const worldsAfter = worldsBefore() * outcomeProbability
    const shownOutcome = outcome === 'mine' ? 'a mine' : `a ${outcome.slice('safe:'.length)}`
    const comparison =
      feedback.revealedInformation > focusResult().eig
        ? 'more than the prediction'
        : feedback.revealedInformation < focusResult().eig
          ? 'less than the prediction'
          : 'exactly the prediction'

    return (
      <>
        {focusLabel()} came back as <strong>{shownOutcome}</strong>, an outcome with probability{' '}
        {(outcomeProbability * 100).toFixed(1)}%. That answer ruled out every arrangement inconsistent with
        it, taking the count from <strong>{Math.round(worldsBefore())}</strong> down to{' '}
        <strong>{Math.round(worldsAfter)}</strong>. The information delivered is the log of that ratio: log
        <sub>2</sub>({Math.round(worldsBefore())}/{Math.round(worldsAfter)}) ={' '}
        <strong>{formatBits(feedback.revealedInformation)}</strong>, which is {comparison} of{' '}
        {formatBits(focusResult().eig)}. Re-roll a few times: the realized values scatter, but they average
        back to the prediction, because that is all the prediction ever claimed to be.
      </>
    )
  }

  return (
    <div class="demo" id="predicted-vs-realized">
      <div class="demo-board">
        <canvas
          class="demo-canvas"
          ref={canvas}
          // Only the focus cell is live: the widget is about one cell's prediction, and revealing any
          // other would leave the predicted number on screen describing a click that never happened.
          // The cursor says so, rather than letting clicks land silently on dead cells.
          onMouseMove={(event) => {
            canvas.style.cursor = drawn() === null && isOnFocusCell(event) ? 'pointer' : 'default'
          }}
          onClick={(event) => {
            if (drawn() !== null || !isOnFocusCell(event)) return
            setDrawn(simulateReveal(board(), focusCell(), random(), preRevealSolve()))
          }}
        />
      </div>
      <dl class="demo-readouts">
        <div class="demo-readout">
          <dt>Predicted EIG</dt>
          <dd class="demo-predicted">{formatBits(focusResult().eig)}</dd>
        </div>
        <div class="demo-readout">
          <dt>Realized information</dt>
          <dd class="demo-realized">
            {drawn() === null ? '?' : formatBits(drawn()!.feedback.revealedInformation)}
          </dd>
        </div>
        <button type="button" class="demo-reset" disabled={drawn() === null} onClick={() => setDrawn(null)}>
          Re-roll
        </button>
      </dl>
      <p class="demo-narration">{narration()}</p>
    </div>
  )
}
