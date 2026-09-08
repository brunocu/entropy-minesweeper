import { createEffect, createMemo, onMount, untrack } from 'solid-js'
import type { GameController } from '../game/gameController.ts'
import { createUncertaintyChart } from '../render/uncertaintyChart.ts'

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
   * The chart's data only changes when a reveal appends a point, but `plot.setData` rebuilds two
   * arrays and repaints the whole plot - by far the most expensive thing in a redraw. A hover or a
   * flag toggle would plot exactly what is already on screen, so this memo returns the same length
   * and the update effect below is never notified.
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
