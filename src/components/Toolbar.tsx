import { createMemo, For } from 'solid-js'
import { DIFFICULTIES, type DifficultyName } from '../lib/game/difficulty.ts'
import type { GameController } from '../lib/game/gameController.ts'
import { countFlags } from './boardQueries.ts'

interface ToolbarProps {
  readonly game: () => GameController
  readonly difficultyName: () => DifficultyName
  readonly onDifficultyChange: (name: DifficultyName) => void
  readonly onNewGame: () => void
}

export function Toolbar(props: ToolbarProps) {
  // A flag toggle is the only thing that moves this, and it returns the same number for every
  // other change, so the span's text node is written only when the count really changes.
  const minesLeft = createMemo(() => props.game().board.mineCount - countFlags(props.game().board))

  return (
    <div class="toolbar">
      <select
        value={props.difficultyName()}
        onChange={(event) => props.onDifficultyChange(event.currentTarget.value as DifficultyName)}
      >
        <For each={DIFFICULTIES}>
          {(difficulty) => (
            <option value={difficulty.name}>
              {`${difficulty.name} (${difficulty.width}x${difficulty.height}, ${difficulty.mineCount} mines)`}
            </option>
          )}
        </For>
      </select>
      <button onClick={() => props.onNewGame()}>New Game</button>
      <span class="toolbar__mines-left">{`Mines left: ${minesLeft()}`}</span>
      {/* Entry point to the explainer. A plain link, not a modal: the content is long-form and lives
          on its own Vite entry point, so there is no page state to preserve. */}
      <a class="toolbar__explainer-link" href={`${import.meta.env.BASE_URL}explainer.html`}>
        What does any of this mean?
      </a>
    </div>
  )
}
