// Build-time SVG generator for the explainer's canned uncertainty chart (design.md decision 8).
// The live game plots this data with uPlot; here the trace is fixed, so it is plotted directly
// into static markup rather than shipping a chart library to draw one unchanging line.
import type { UncertaintyHistoryPoint } from '../render/uncertaintyChart.ts'

const WIDTH = 720
const HEIGHT = 320
const PAD_LEFT = 52
const PAD_RIGHT = 24
const PAD_TOP = 34
const PAD_BOTTOM = 44

const LINE_COLOR = '#2b6cb0' // the live chart's series stroke
const AXIS_COLOR = '#9a968f'
const TEXT_COLOR = '#3d3a35'
const ANNOTATION_COLOR = '#d03b3b'

export interface ChartAnnotation {
  /** Inclusive move-index span this annotation brackets; a single move for a point callout. */
  readonly span: readonly [number, number]
  readonly label: string
}

function escapeXml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!)
}

/** Renders the canned trace with its callouts as standalone inline SVG markup. */
export function renderUncertaintyChart(
  trace: readonly UncertaintyHistoryPoint[],
  annotations: readonly ChartAnnotation[],
): string {
  const maxMove = Math.max(...trace.map((p) => p.moveIndex))
  const maxBits = Math.max(...trace.map((p) => p.totalEntropyBits))
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM

  const x = (moveIndex: number): number => PAD_LEFT + (moveIndex / maxMove) * plotWidth
  const y = (bits: number): number => PAD_TOP + (1 - bits / maxBits) * plotHeight

  const parts: string[] = []

  parts.push(
    `<text x="${PAD_LEFT}" y="20" font-size="13" font-weight="600" fill="${TEXT_COLOR}">Total uncertainty vs. move</text>`,
  )

  // Axes and gridlines.
  const bitTicks = [0, 10, 20, 30, 40].filter((b) => b <= maxBits)
  for (const bits of bitTicks) {
    parts.push(
      `<line x1="${PAD_LEFT}" y1="${y(bits)}" x2="${WIDTH - PAD_RIGHT}" y2="${y(bits)}" stroke="${AXIS_COLOR}" ` +
        `stroke-width="1" stroke-opacity="0.35" />`,
      `<text x="${PAD_LEFT - 8}" y="${y(bits) + 4}" text-anchor="end" font-size="11" fill="${TEXT_COLOR}">${bits}</text>`,
    )
  }
  for (const point of trace) {
    parts.push(
      `<text x="${x(point.moveIndex)}" y="${HEIGHT - PAD_BOTTOM + 18}" text-anchor="middle" font-size="11" ` +
        `fill="${TEXT_COLOR}">${point.moveIndex}</text>`,
    )
  }
  parts.push(
    `<line x1="${PAD_LEFT}" y1="${PAD_TOP}" x2="${PAD_LEFT}" y2="${HEIGHT - PAD_BOTTOM}" stroke="${AXIS_COLOR}" stroke-width="1" />`,
    `<line x1="${PAD_LEFT}" y1="${HEIGHT - PAD_BOTTOM}" x2="${WIDTH - PAD_RIGHT}" y2="${HEIGHT - PAD_BOTTOM}" stroke="${AXIS_COLOR}" stroke-width="1" />`,
    `<text x="${PAD_LEFT + plotWidth / 2}" y="${HEIGHT - 8}" text-anchor="middle" font-size="11" fill="${TEXT_COLOR}">Move index</text>`,
    `<text x="14" y="${PAD_TOP + plotHeight / 2}" text-anchor="middle" font-size="11" fill="${TEXT_COLOR}" ` +
      `transform="rotate(-90 14 ${PAD_TOP + plotHeight / 2})">Bits</text>`,
  )

  // The trace itself.
  const path = trace.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.moveIndex)} ${y(p.totalEntropyBits)}`).join(' ')
  parts.push(`<path class="trace-line" d="${path}" fill="none" stroke="${LINE_COLOR}" stroke-width="2.5" />`)
  for (const point of trace) {
    parts.push(
      `<circle cx="${x(point.moveIndex)}" cy="${y(point.totalEntropyBits)}" r="3" fill="${LINE_COLOR}" />`,
    )
  }

  // Callouts. A point annotation gets a vertical drop line at that move; a span gets a bracket
  // over the moves it covers, so "one reveal did this" and "these three reveals did that" read
  // as different shapes rather than differently-worded labels.
  annotations.forEach((annotation, index) => {
    const [from, to] = annotation.span
    const isPoint = from === to
    // Point labels sit below the band the span brackets occupy, so the two never overlap.
    const labelY = PAD_TOP + 34 + index * 22
    if (isPoint) {
      parts.push(
        `<line class="chart-annotation" data-move="${from}" x1="${x(from)}" y1="${PAD_TOP}" x2="${x(from)}" ` +
          `y2="${HEIGHT - PAD_BOTTOM}" stroke="${ANNOTATION_COLOR}" stroke-width="1.5" stroke-dasharray="5 4" />`,
        `<text class="chart-annotation-label" data-move="${from}" x="${x(from) + 8}" y="${labelY}" font-size="12" ` +
          `font-weight="600" fill="${ANNOTATION_COLOR}">${escapeXml(annotation.label)}</text>`,
      )
      return
    }
    const bracketY = PAD_TOP + 10
    parts.push(
      `<path class="chart-annotation" data-move="${from}" data-move-to="${to}" d="M ${x(from)} ${bracketY + 8} ` +
        `V ${bracketY} H ${x(to)} V ${bracketY + 8}" fill="none" stroke="${ANNOTATION_COLOR}" stroke-width="1.5" />`,
      `<text class="chart-annotation-label" data-move="${from}" data-move-to="${to}" x="${(x(from) + x(to)) / 2}" ` +
        `y="${bracketY - 4}" text-anchor="middle" font-size="12" font-weight="600" ` +
        `fill="${ANNOTATION_COLOR}">${escapeXml(annotation.label)}</text>`,
    )
  })

  return (
    `<svg class="uncertainty-chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" ` +
    `width="${WIDTH}" height="${HEIGHT}" role="img" ` +
    `aria-label="Example trace of total board uncertainty in bits against move index" ` +
    `font-family="system-ui, sans-serif">${parts.join('')}</svg>`
  )
}
