import { createSignal } from 'solid-js'
import { Board } from '../lib/board/board.ts'
import { toLabel } from '../lib/board/chessLabel.ts'
import { DIFFICULTY, type Difficulty, type DifficultyName } from '../lib/game/difficulty.ts'
import { GameController } from '../lib/game/gameController.ts'
import { computeRevealFeedback } from '../lib/game/revealFeedback.ts'
import type { Coord } from '../lib/solver/types.ts'
import { BOARD_MARGIN_TOP, BoardCanvas, CELL_SIZE } from './BoardCanvas.tsx'
import { probabilityAt } from './boardQueries.ts'
import { Readouts } from './Readouts.tsx'
import { Toolbar } from './Toolbar.tsx'
import { UncertaintyChart } from './UncertaintyChart.tsx'

const DEFAULT_DIFFICULTY = DIFFICULTY.Intermediate

function newController(difficulty: Difficulty): GameController {
  return new GameController(new Board(difficulty.width, difficulty.height, difficulty.mineCount))
}

export function App() {
  const [difficultyName, setDifficultyName] = createSignal<DifficultyName>(DEFAULT_DIFFICULTY.name)

  /**
   * The whole game state behind one signal. `equals: false` lets both kinds of change travel the
   * same path: a new game replaces the instance, a reveal or flag mutates it in place, and a
   * default `===` signal would swallow the latter. Memos downstream contain the coarseness.
   */
  const [game, setGame] = createSignal(newController(DEFAULT_DIFFICULTY), { equals: false })

  /**
   * Everything a hover drives is a function of the cell, not the pixel, so this equality turns a
   * notification per pointer event into one per cell transition. Nothing invalidates it when the
   * board changes underneath the pointer: the readout and highlight are memos over `game()` too.
   */
  const [hoveredCell, setHoveredCell] = createSignal<Coord | null>(null, {
    equals: (a, b) => a?.row === b?.row && a?.col === b?.col,
  })

  const [revealLine, setRevealLine] = createSignal('')

  function newGame(): void {
    setHoveredCell(null)
    setRevealLine('')
    setGame(newController(DIFFICULTY[difficultyName()]))
  }

  function reveal(cell: Coord): void {
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

  function toggleFlag(cell: Coord): void {
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
        <UncertaintyChart game={game} height={DEFAULT_DIFFICULTY.height * CELL_SIZE + BOARD_MARGIN_TOP} />
      </div>
    </>
  )
}
