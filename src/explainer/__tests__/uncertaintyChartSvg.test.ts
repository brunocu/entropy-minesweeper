import { describe, expect, it } from 'vitest'
import { UNCERTAINTY_CLIFF_MOVE, UNCERTAINTY_FLAT_SPAN, UNCERTAINTY_TRACE } from '../fixtures.ts'
import { UNCERTAINTY_ANNOTATIONS } from '../illustrations.ts'
import { renderUncertaintyChart } from '../uncertaintyChartSvg.ts'

describe('uncertainty-chart generator (3.4)', () => {
  const svg = renderUncertaintyChart(UNCERTAINTY_TRACE, UNCERTAINTY_ANNOTATIONS)

  it('plots the whole trace as one polyline with a point per move', () => {
    expect(svg).toContain('class="trace-line"')
    const points = svg.match(/<circle /g) ?? []
    expect(points.length).toBe(UNCERTAINTY_TRACE.length)
  })

  it('draws an annotation at the cliff move', () => {
    expect(svg).toMatch(new RegExp(`class="chart-annotation"[^>]*data-move="${UNCERTAINTY_CLIFF_MOVE}"[^>]*>`))
    expect(svg).toMatch(new RegExp(`class="chart-annotation-label"[^>]*data-move="${UNCERTAINTY_CLIFF_MOVE}"[^>]*>`))
    expect(svg).toContain('cliff')
  })

  it('draws an annotation spanning the flat stretch', () => {
    const [from, to] = UNCERTAINTY_FLAT_SPAN
    expect(svg).toMatch(new RegExp(`class="chart-annotation"[^>]*data-move="${from}" data-move-to="${to}"`))
    expect(svg).toMatch(new RegExp(`class="chart-annotation-label"[^>]*data-move="${from}" data-move-to="${to}"`))
    expect(svg).toContain('flat stretch')
  })

  it('annotates every move index the fixture calls out, and no others', () => {
    const annotated = (svg.match(/class="chart-annotation" data-move="(\d+)"/g) ?? []).map((m) => m.match(/data-move="(\d+)"/)![1])
    expect(new Set(annotated)).toEqual(new Set([String(UNCERTAINTY_CLIFF_MOVE), String(UNCERTAINTY_FLAT_SPAN[0])]))
  })

  it('labels the move axis with every move in the trace', () => {
    for (const point of UNCERTAINTY_TRACE) {
      expect(svg).toContain(`>${point.moveIndex}</text>`)
    }
  })
})
