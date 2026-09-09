// Wraps uPlot for the live total-uncertainty-vs-move chart, keeping construction and update
// concerns out of the component that mounts it.
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { tokens } from '../lib/tokens.ts'
import type { UncertaintyHistoryPoint } from '../lib/uncertaintyHistory.ts'

export interface UncertaintyChart {
  update(history: readonly UncertaintyHistoryPoint[]): void
  reset(history: readonly UncertaintyHistoryPoint[]): void
}

function toAlignedData(history: readonly UncertaintyHistoryPoint[]): uPlot.AlignedData {
  return [history.map((p) => p.moveIndex), history.map((p) => p.totalEntropyBits)]
}

export interface UncertaintyChartOptions {
  readonly height: number
}

export function createUncertaintyChart(
  container: HTMLElement,
  initialHistory: readonly UncertaintyHistoryPoint[],
  chartOptions: UncertaintyChartOptions,
): UncertaintyChart {
  const options: uPlot.Options = {
    width: container.clientWidth || 600,
    height: chartOptions.height,
    title: 'Total uncertainty vs. move',
    scales: { x: { time: false } },
    axes: [
      {
        label: 'Total moves',
        incrs: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
        filter: (_self, splits) => splits.map((s) => (Number.isInteger(s) ? s : null)),
      },
      { label: 'Bits' },
    ],
    series: [{}, { label: 'Total entropy (bits)', stroke: tokens.safe, width: 2 }],
  }

  const plot = new uPlot(options, toAlignedData(initialHistory), container)

  return {
    update(history: readonly UncertaintyHistoryPoint[]): void {
      plot.setData(toAlignedData(history))
    },
    reset(history: readonly UncertaintyHistoryPoint[]): void {
      plot.setData(toAlignedData(history), true)
    },
  }
}
