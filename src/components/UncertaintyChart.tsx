import { createEffect, createMemo, onMount, untrack } from 'solid-js'
import type { GameController } from '../lib/game/gameController.ts'
import { createUncertaintyChart } from './uncertaintyChart.ts'

interface UncertaintyChartProps {
  readonly game: () => GameController
  readonly height: number
}

export function UncertaintyChart(props: UncertaintyChartProps) {
  let container!: HTMLDivElement

  /**
   * `game` is an `equals: false` signal, so it notifies on every move; a memo over it bails out on
   * `===`, leaving this notifying only when the controller is replaced - which is a new game.
   */
  const controller = createMemo(() => props.game())

  /**
   * The data only changes when a reveal appends a point, but `plot.setData` rebuilds two arrays and
   * repaints - the most expensive thing in a redraw. A hover or flag toggle leaves this memo's
   * length unchanged, so the update effect below is never notified.
   */
  const historyLength = createMemo(() => props.game().uncertaintyHistory.length)

  onMount(() => {
    const chart = createUncertaintyChart(container, props.game().uncertaintyHistory, { height: props.height })

    createEffect(() => {
      chart.reset(controller().uncertaintyHistory)
    })

    createEffect(() => {
      historyLength()
      chart.update(untrack(props.game).uncertaintyHistory)
    })
  })

  return <div ref={container} />
}
