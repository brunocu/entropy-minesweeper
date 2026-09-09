import { createEffect, createMemo, onMount } from 'solid-js'
import type { Board } from '../lib/board/board.ts'
import type { GameController } from '../lib/game/gameController.ts'
import { BoardRenderer, type HighlightRole, type RenderBoard } from '../canvas/boardRenderer.ts'
import { cellSolverValues } from '../lib/scale/cellSolverValues.ts'
import { pixelToCell } from '../canvas/hitTest.ts'
import { key, type Coord, type SolveResult } from '../lib/solver/types.ts'

export const CELL_SIZE = 32

/** `BoardRenderer` reserves one cell of top margin for the column labels (`marginTop = cellSize`). */
export const BOARD_MARGIN_TOP = CELL_SIZE

/** The hovered cell's precomputed explanation, split into the two roles the renderer highlights. */
interface Highlight {
  readonly clueKeys: Set<string>
  readonly premiseKeys: Set<string>
}

function highlightRoleFor(highlight: Highlight | null, cellKey: string): HighlightRole {
  if (!highlight) return null
  if (highlight.clueKeys.has(cellKey)) return 'clue'
  if (highlight.premiseKeys.has(cellKey)) return 'premise'
  return null
}

function toRenderBoard(b: Board, result: SolveResult, highlight: Highlight | null): RenderBoard {
  return {
    width: b.width,
    height: b.height,
    cells: b.cells.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        const cellKey = key(rowIndex, colIndex)
        const { probability, eig } = cellSolverValues(result, cellKey, cell.revealed)
        return {
          revealed: cell.revealed,
          flagged: cell.flagged,
          isMine: cell.isMine,
          adjacentMines: cell.adjacentMines,
          probability,
          eig,
          highlightRole: highlightRoleFor(highlight, cellKey),
        }
      }),
    ),
  }
}

interface BoardCanvasProps {
  readonly game: () => GameController
  readonly hoveredCell: () => Coord | null
  readonly setHoveredCell: (cell: Coord | null) => void
  readonly onReveal: (cell: Coord) => void
  readonly onToggleFlag: (cell: Coord) => void
}

export function BoardCanvas(props: BoardCanvasProps) {
  let canvas!: HTMLCanvasElement
  let renderer: BoardRenderer | null = null

  /**
   * The hovered cell's highlight, or null. Derived rather than assigned, so a pointer moving
   * between two cells that explain nothing yields `null` both times and the render effect below,
   * which reads this, is never notified.
   */
  const hoveredHighlight = createMemo<Highlight | null>(() => {
    const cell = props.hoveredCell()
    if (!cell) return null
    const controller = props.game()
    if (controller.board.cells[cell.row]?.[cell.col]?.revealed !== false) return null
    const explanation = controller.latestExplanations.get(`${cell.row},${cell.col}`)
    if (!explanation) return null
    return {
      clueKeys: new Set(explanation.clueCells.map((c) => `${c.row},${c.col}`)),
      premiseKeys: new Set(explanation.premiseCells.map((c) => `${c.row},${c.col}`)),
    }
  })

  function cellAt(event: MouseEvent): Coord | null {
    if (!renderer) return null
    const rect = canvas.getBoundingClientRect()
    const board = props.game().board
    return pixelToCell(
      event.clientX - rect.left - renderer.marginLeft,
      event.clientY - rect.top - renderer.marginTop,
      CELL_SIZE,
      board.width,
      board.height,
    )
  }

  onMount(() => {
    renderer = new BoardRenderer(canvas, { cellSize: CELL_SIZE })

    // The only place the canvas is painted. It reads the controller and the highlight, so it runs
    // exactly when one of them moves and never otherwise - no handler decides whether to repaint.
    createEffect(() => {
      const controller = props.game()
      renderer!.render(toRenderBoard(controller.board, controller.latestSolve, hoveredHighlight()))
    })
  })

  return (
    <canvas
      ref={canvas}
      onMouseMove={(event) => props.setHoveredCell(cellAt(event))}
      onMouseLeave={() => props.setHoveredCell(null)}
      onClick={(event) => {
        const cell = cellAt(event)
        if (cell) props.onReveal(cell)
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        const cell = cellAt(event)
        if (cell) props.onToggleFlag(cell)
      }}
    />
  )
}
