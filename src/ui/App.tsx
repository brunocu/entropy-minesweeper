import { createSignal } from 'solid-js'
import { Board } from '../board/board.ts'
import { toLabel } from '../board/chessLabel.ts'
import { DIFFICULTIES, type Difficulty } from '../game/difficulty.ts'
import { GameController } from '../game/gameController.ts'
import { computeRevealFeedback } from '../game/revealFeedback.ts'
import type { GridCoord } from '../render/hitTest.ts'
import { BOARD_MARGIN_TOP, BoardCanvas, CELL_SIZE } from './BoardCanvas.tsx'
import { probabilityAt } from './boardQueries.ts'
import { Readouts } from './Readouts.tsx'
import { Toolbar } from './Toolbar.tsx'
import { UncertaintyChart } from './UncertaintyChart.tsx'

/** Also the difficulty the chart is sized against, so its plot area lines up with the board's. */
const INTERMEDIATE = DIFFICULTIES.find((d) => d.name === 'Intermediate') ?? DIFFICULTIES[0]

function newController(difficulty: Difficulty): GameController {
  return new GameController(new Board(difficulty.width, difficulty.height, difficulty.mineCount))
}

export function App() {
  const [difficultyName, setDifficultyName] = createSignal(INTERMEDIATE.name)

  /**
   * The whole game state, behind one signal. `equals: false` is what lets the two kinds of change
   * travel the same path: a new game replaces the instance, while a reveal or a flag mutates it in
   * place, and in-place mutation leaves identity unchanged where a default `===` signal would
   * swallow it. The coarseness is contained downstream by memos, which do bail out on `===`.
   */
  const [game, setGame] = createSignal(newController(INTERMEDIATE), { equals: false })

  /**
   * Cells are 32px, so a pointer crossing one fires however many move events the browser emits over
   * that distance, and everything a hover drives - the readout, the highlight - is a function of
   * the cell, not the pixel. This equality turns a notification per event into one per cell
   * transition. Nothing has to invalidate it when the board changes underneath the pointer: the
   * readout and the highlight are memos over `game()` as well, so they re-derive on their own.
   */
  const [hoveredCell, setHoveredCell] = createSignal<GridCoord | null>(null, {
    equals: (a, b) => a?.row === b?.row && a?.col === b?.col,
  })

  const [revealLine, setRevealLine] = createSignal('')

  function newGame(): void {
    const difficulty = DIFFICULTIES.find((d) => d.name === difficultyName()) ?? DIFFICULTIES[0]
    setHoveredCell(null)
    setRevealLine('')
    setGame(newController(difficulty))
  }

  function reveal(cell: GridCoord): void {
    const controller = game()
    const preRevealSolve = controller.latestSolve
    const preRevealProbability = probabilityAt(preRevealSolve, cell.row, cell.col)
    // A flagged cell, an already-revealed cell, or a finished game: nothing moved, so there is
    // nothing to notify and no feedback to report.
    if (!controller.reveal(cell.row, cell.col)) return

    const feedback = computeRevealFeedback(preRevealSolve, controller.latestSolve, cell.row, cell.col)
    const showPredicted = feedback.predictedEig !== null && preRevealProbability !== 1
    const predictedPart = showPredicted ? `Predicted EIG: ${feedback.predictedEig!.toFixed(3)} bits, ` : ''
    setRevealLine(
      `${toLabel(cell.row, cell.col)}: ${predictedPart}Revealed information: ${feedback.revealedInformation.toFixed(3)} bits`,
    )
    setGame((current) => current)
  }

  function toggleFlag(cell: GridCoord): void {
    // Off the grid is handled by the caller; a cell whose flag could not move (revealed, or the
    // game is over) leaves the board untouched.
    if (!game().toggleFlag(cell.row, cell.col)) return
    setGame((current) => current)
  }

  return (
    <>
      <Toolbar
        game={game}
        difficultyName={difficultyName}
        onDifficultyChange={setDifficultyName}
        onNewGame={newGame}
      />
      <div class="main-row">
        <div>
          <BoardCanvas
            game={game}
            hoveredCell={hoveredCell}
            setHoveredCell={setHoveredCell}
            onReveal={reveal}
            onToggleFlag={toggleFlag}
          />
          <Readouts game={game} hoveredCell={hoveredCell} revealLine={revealLine} />
        </div>
        <UncertaintyChart game={game} height={INTERMEDIATE.height * CELL_SIZE + BOARD_MARGIN_TOP} />
      </div>
    </>
  )
}
