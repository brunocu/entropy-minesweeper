import { createMemo } from 'solid-js'
import { toLabel } from '../lib/board/chessLabel.ts'
import type { GameController } from '../lib/game/gameController.ts'
import { findFrontierEig } from '../lib/game/revealFeedback.ts'
import type { Coord } from '../lib/solver/types.ts'
import { probabilityAt } from './boardQueries.ts'

interface ReadoutsProps {
  readonly game: () => GameController
  readonly hoveredCell: () => Coord | null
  readonly revealLine: () => string
}

export function Readouts(props: ReadoutsProps) {
  const hoverText = createMemo(() => {
    const cell = props.hoveredCell()
    if (!cell) return ''
    const controller = props.game()
    if (controller.board.cells[cell.row]?.[cell.col]?.revealed !== false) return ''

    const probability = probabilityAt(controller.latestSolve, cell.row, cell.col)
    const probabilityLine = probability !== null ? `P(mine): ${Math.round(probability * 100)}%` : ''

    const eig = findFrontierEig(controller.latestSolve, cell.row, cell.col)
    const eigLine = eig !== null && probability !== 1 ? `Expected information gain: ${eig.toFixed(3)} bits` : ''

    return [toLabel(cell.row, cell.col), probabilityLine, eigLine].filter((line) => line !== '').join('\n')
  })

  const statusText = createMemo(() => {
    const status = props.game().board.status
    return status === 'won' ? 'You win!' : status === 'lost' ? 'Boom — game over.' : ''
  })

  const entropyText = createMemo(
    () => `Total uncertainty: ${props.game().latestSolve.totalEntropyBits.toFixed(3)} bits`,
  )

  return (
    <>
      <div class="readout readout--hover">{hoverText()}</div>
      <div class="readout">{props.revealLine()}</div>
      <div class="readout readout--status">{statusText()}</div>
      <div class="readout">{entropyText()}</div>
    </>
  )
}
