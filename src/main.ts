import { Board } from './board/board.ts'
import { toLabel } from './board/chessLabel.ts'
import { DIFFICULTIES, type Difficulty } from './game/difficulty.ts'
import { GameController } from './game/gameController.ts'
import { computeRevealFeedback, findFrontierEig } from './game/revealFeedback.ts'
import { BoardRenderer, type RenderBoard } from './render/boardRenderer.ts'
import { cellSolverValues } from './render/cellSolverValues.ts'
import { pixelToCell } from './render/hitTest.ts'
import { createUncertaintyChart } from './render/uncertaintyChart.ts'
import { key, type SolveResult } from './solver/types.ts'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = ''

const toolbar = document.createElement('div')
toolbar.style.fontFamily = 'sans-serif'
toolbar.style.marginBottom = '0.5em'
app.appendChild(toolbar)

const difficultySelect = document.createElement('select')
for (const difficulty of DIFFICULTIES) {
  const option = document.createElement('option')
  option.value = difficulty.name
  option.textContent = `${difficulty.name} (${difficulty.width}x${difficulty.height}, ${difficulty.mineCount} mines)`
  difficultySelect.appendChild(option)
}
const defaultDifficulty = DIFFICULTIES.find((d) => d.name === 'Intermediate') ?? DIFFICULTIES[0]
difficultySelect.value = defaultDifficulty.name
toolbar.appendChild(difficultySelect)

const newGameButton = document.createElement('button')
newGameButton.textContent = 'New Game'
toolbar.appendChild(newGameButton)

const minesLeftReadout = document.createElement('span')
minesLeftReadout.style.marginLeft = '1em'
toolbar.appendChild(minesLeftReadout)

// Entry point to the explainer. A plain link, not a modal: the content is long-form and lives on
// its own Vite entry point, so there is no page state to preserve.
const explainerLink = document.createElement('a')
explainerLink.href = import.meta.env.BASE_URL + 'explainer.html'
explainerLink.textContent = 'What does any of this mean?'
explainerLink.style.marginLeft = '1.5em'
toolbar.appendChild(explainerLink)

const mainRow = document.createElement('div')
mainRow.style.display = 'flex'
mainRow.style.alignItems = 'flex-start'
mainRow.style.gap = '1em'
app.appendChild(mainRow)

const boardColumn = document.createElement('div')
mainRow.appendChild(boardColumn)

const canvas = document.createElement('canvas')
boardColumn.appendChild(canvas)

const hoverReadout = document.createElement('div')
hoverReadout.style.fontFamily = 'sans-serif'
hoverReadout.style.minHeight = '1.4em'
hoverReadout.style.whiteSpace = 'pre-line'
boardColumn.appendChild(hoverReadout)

const revealReadout = document.createElement('div')
revealReadout.style.fontFamily = 'sans-serif'
revealReadout.style.minHeight = '1.4em'
boardColumn.appendChild(revealReadout)

const statusReadout = document.createElement('div')
statusReadout.style.fontFamily = 'sans-serif'
statusReadout.style.fontWeight = 'bold'
statusReadout.style.minHeight = '1.4em'
boardColumn.appendChild(statusReadout)

const entropyReadout = document.createElement('div')
entropyReadout.style.fontFamily = 'sans-serif'
entropyReadout.style.minHeight = '1.4em'
boardColumn.appendChild(entropyReadout)

const cellSize = 32
const renderer = new BoardRenderer(canvas, { cellSize })

const chartContainer = document.createElement('div')
mainRow.appendChild(chartContainer)

let controller = new GameController(new Board(defaultDifficulty.width, defaultDifficulty.height, defaultDifficulty.mineCount))
const intermediateDifficulty = DIFFICULTIES.find((d) => d.name === 'Intermediate') ?? defaultDifficulty
const chartHeight = intermediateDifficulty.height * cellSize + renderer.marginTop
const uncertaintyChart = createUncertaintyChart(chartContainer, controller.uncertaintyHistory, { height: chartHeight })

/** Currently-hovered cell's precomputed explanation, if it qualifies (unrevealed frontier, p=0/1). */
let hoveredHighlight: { clueKeys: Set<string>; premiseKeys: Set<string> } | null = null

/**
 * The cell the pointer was in on the previous `mousemove`. Cells are 32px, so a pointer crossing
 * one fires however many move events the browser emits over that distance, and everything a hover
 * drives - the readout, the highlight - is a function of the cell, not the pixel. Comparing
 * against this turns a repaint per event into a repaint per cell transition.
 *
 * Reset (`invalidateHover`) whenever the board changes underneath the pointer, since the same
 * cell can read differently after a reveal or a flag toggle.
 */
let lastHoveredCell: { row: number; col: number } | null = null

/** How many history points the chart is currently plotting; see the guard in `draw`. */
let plottedHistoryLength = controller.uncertaintyHistory.length

function invalidateHover(): void {
  lastHoveredCell = null
}

function highlightRoleFor(key: string): 'clue' | 'premise' | null {
  if (!hoveredHighlight) return null
  if (hoveredHighlight.clueKeys.has(key)) return 'clue'
  if (hoveredHighlight.premiseKeys.has(key)) return 'premise'
  return null
}

function toRenderBoard(b: Board, result: SolveResult): RenderBoard {
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
          highlightRole: highlightRoleFor(cellKey),
        }
      }),
    ),
  }
}

function countFlags(board: Board): number {
  let count = 0
  for (const row of board.cells) {
    for (const cell of row) {
      if (cell.flagged) count++
    }
  }
  return count
}

function draw(): void {
  renderer.render(toRenderBoard(controller.board, controller.latestSolve))
  statusReadout.textContent =
    controller.board.status === 'won' ? 'You win!' : controller.board.status === 'lost' ? 'Boom — game over.' : ''
  entropyReadout.textContent = `Total uncertainty: ${controller.latestSolve.totalEntropyBits.toFixed(3)} bits`
  minesLeftReadout.textContent = `Mines left: ${controller.board.mineCount - countFlags(controller.board)}`

  // The chart's data only changes when a reveal appends a point, but `plot.setData` rebuilds two
  // arrays and repaints the whole plot - by far the most expensive thing in a redraw. A redraw
  // driven by hover or by a flag plots exactly what is already on screen, so skip it.
  if (controller.uncertaintyHistory.length !== plottedHistoryLength) {
    plottedHistoryLength = controller.uncertaintyHistory.length
    uncertaintyChart.update(controller.uncertaintyHistory)
  }
}

/** Resolves a cell's mine probability the same way `toRenderBoard` does: frontier lookup, else the pooled non-frontier probability. */
function probabilityAt(row: number, col: number): number | null {
  return controller.latestSolve.frontierByKey.get(key(row, col))?.probability ?? controller.latestSolve.nonFrontierProbability
}

function cellAt(event: MouseEvent) {
  const rect = canvas.getBoundingClientRect()
  return pixelToCell(
    event.clientX - rect.left - renderer.marginLeft,
    event.clientY - rect.top - renderer.marginTop,
    cellSize,
    controller.board.width,
    controller.board.height,
  )
}

function newGame(difficulty: Difficulty): void {
  controller = new GameController(new Board(difficulty.width, difficulty.height, difficulty.mineCount))
  hoverReadout.textContent = ''
  revealReadout.textContent = ''
  hoveredHighlight = null
  invalidateHover()
  uncertaintyChart.reset(controller.uncertaintyHistory)
  plottedHistoryLength = controller.uncertaintyHistory.length
  draw()
}

newGameButton.addEventListener('click', () => {
  const difficulty = DIFFICULTIES.find((d) => d.name === difficultySelect.value) ?? DIFFICULTIES[0]
  newGame(difficulty)
})

canvas.addEventListener('mousemove', (event) => {
  const cell = cellAt(event)

  // Everything below is a function of which cell the pointer is in, so while it stays in one
  // there is nothing to recompute and nothing to repaint.
  if (cell && lastHoveredCell && cell.row === lastHoveredCell.row && cell.col === lastHoveredCell.col) return
  lastHoveredCell = cell

  if (!cell || controller.board.cells[cell.row][cell.col].revealed) {
    hoverReadout.textContent = ''
    if (hoveredHighlight !== null) {
      hoveredHighlight = null
      draw()
    }
    return
  }
  const probability = probabilityAt(cell.row, cell.col)
  const probabilityLine = probability !== null ? `P(mine): ${Math.round(probability * 100)}%` : ''

  const eig = findFrontierEig(controller.latestSolve, cell.row, cell.col)
  const eigLine = eig !== null && probability !== 1 ? `Expected information gain: ${eig.toFixed(3)} bits` : ''

  hoverReadout.textContent = [toLabel(cell.row, cell.col), probabilityLine, eigLine].filter((line) => line !== '').join('\n')

  const explanation = controller.latestExplanations.get(`${cell.row},${cell.col}`)
  const hadHighlight = hoveredHighlight !== null
  hoveredHighlight = explanation
    ? {
        clueKeys: new Set(explanation.clueCells.map((c) => `${c.row},${c.col}`)),
        premiseKeys: new Set(explanation.premiseCells.map((c) => `${c.row},${c.col}`)),
      }
    : null

  // No highlight before and none after: the canvas would be repainted pixel-identical, and the
  // only thing this event actually changed is the readout text set just above.
  if (!hadHighlight && hoveredHighlight === null) return
  draw()
})

canvas.addEventListener('mouseleave', () => {
  hoverReadout.textContent = ''
  invalidateHover()
  // Nothing was highlighted, so there is nothing on the canvas to clear.
  if (hoveredHighlight === null) return
  hoveredHighlight = null
  draw()
})

canvas.addEventListener('click', (event) => {
  const cell = cellAt(event)
  if (!cell) return

  const preRevealSolve = controller.latestSolve
  const preRevealProbability = probabilityAt(cell.row, cell.col)
  // A flagged cell, an already-revealed cell, or a finished game: nothing moved, so nothing to
  // repaint and no feedback to report.
  if (!controller.reveal(cell.row, cell.col)) return

  hoveredHighlight = null
  invalidateHover()
  const postRevealSolve = controller.latestSolve
  const feedback = computeRevealFeedback(preRevealSolve, postRevealSolve, cell.row, cell.col)
  const showPredicted = feedback.predictedEig !== null && preRevealProbability !== 1
  const predictedPart = showPredicted ? `Predicted EIG: ${feedback.predictedEig!.toFixed(3)} bits, ` : ''

  revealReadout.textContent = `${toLabel(cell.row, cell.col)}: ${predictedPart}Revealed information: ${feedback.revealedInformation.toFixed(3)} bits`

  draw()
})

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault()
  const cell = cellAt(event)
  // Off the grid, or a cell whose flag could not move (revealed, or the game is over).
  if (!cell) return
  if (!controller.toggleFlag(cell.row, cell.col)) return

  // The flag changed which explanations hold, so the hovered cell may now read differently.
  invalidateHover()
  draw()
})

draw()
