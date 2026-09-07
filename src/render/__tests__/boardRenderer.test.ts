import { describe, expect, it } from 'vitest'
import { BoardRenderer, type RenderBoard, type RenderCell } from '../boardRenderer.ts'
import { CLUE_HIGHLIGHT_COLOR, PREMISE_HIGHLIGHT_COLOR, SAFE_POLE_COLOR } from '../probabilityColor.ts'

// No DOM/canvas available in this sandbox (see informationVisualization.spec.test.ts's note),
// so this stubs just enough of the Canvas2D surface for BoardRenderer to run against, and
// records the fillStyle in effect at each fillRect call to recover per-cell fill colors.
function makeFakeCanvas() {
  const fillStyles: string[] = []
  const fillTexts: { text: string; x: number; y: number }[] = []
  const strokeRects: { strokeStyle: string; x: number; y: number; width: number; height: number }[] = []
  let currentStrokeStyle = ''
  const ctx = {
    clearRect: () => {},
    strokeRect: (x: number, y: number, width: number, height: number) => {
      strokeRects.push({ strokeStyle: currentStrokeStyle, x, y, width, height })
    },
    fillText: (text: string, x: number, y: number) => {
      fillTexts.push({ text, x, y })
    },
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    fill: () => {},
    arc: () => {},
    lineWidth: 0,
    set strokeStyle(v: string) {
      currentStrokeStyle = v
    },
    get strokeStyle() {
      return currentStrokeStyle
    },
    font: '',
    textAlign: '',
    textBaseline: '',
    set fillStyle(v: string) {
      fillStyles.push(v)
    },
    get fillStyle() {
      return fillStyles.at(-1) ?? ''
    },
    fillRect: () => {},
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
  }
  return { canvas: canvas as unknown as HTMLCanvasElement, fillStyles, fillTexts, strokeRects }
}

function cell(overrides: Partial<RenderCell> = {}): RenderCell {
  return {
    revealed: false,
    flagged: false,
    isMine: false,
    adjacentMines: 0,
    probability: null,
    eig: null,
    highlightRole: null,
    ...overrides,
  }
}

function boardOf(cells: RenderCell[]): RenderBoard {
  return { width: cells.length, height: 1, cells: [cells] }
}

describe('BoardRenderer certain-safe frontier EIG-gradient fill (2.3)', () => {
  it('gives two certain-safe frontier cells with different EIG different fills', () => {
    const { canvas, fillStyles } = makeFakeCanvas()
    const renderer = new BoardRenderer(canvas, { cellSize: 10 })
    const board = boardOf([cell({ probability: 0, eig: 0.1 }), cell({ probability: 0, eig: 0.9 })])
    renderer.render(board)
    expect(fillStyles[0]).not.toBe(fillStyles[1])
    expect(fillStyles[0]).not.toBe(SAFE_POLE_COLOR)
    expect(fillStyles[1]).not.toBe(SAFE_POLE_COLOR)
  })

  it('renders a single certain-safe frontier cell at the gradient high end', () => {
    const { canvas, fillStyles } = makeFakeCanvas()
    const renderer = new BoardRenderer(canvas, { cellSize: 10 })
    const board = boardOf([cell({ probability: 0, eig: 0.42 })])
    renderer.render(board)
    expect(fillStyles[0]).not.toBe(SAFE_POLE_COLOR)
  })

  it('keeps the flat pole color for a certain-safe non-frontier cell (eig === null)', () => {
    const { canvas, fillStyles } = makeFakeCanvas()
    const renderer = new BoardRenderer(canvas, { cellSize: 10 })
    const board = boardOf([cell({ probability: 0, eig: null })])
    renderer.render(board)
    expect(fillStyles[0]).toBe(SAFE_POLE_COLOR)
  })
})

describe('certainty-explanation highlight (4.2, 4.3)', () => {
  it("draws a highlighted premise cell's existing certainty-ring/fill markup alongside the new stroke", () => {
    const { canvas, fillStyles, strokeRects } = makeFakeCanvas()
    const renderer = new BoardRenderer(canvas, { cellSize: 10 })
    const board = boardOf([cell({ probability: 1, highlightRole: 'premise' })])
    renderer.render(board)

    // Existing fill (probability-1 pole color) and the certainty ring are both still present.
    // marginLeft=10 (cellSize), col0 -> cell x=10: certainty ring inset 3 -> x=13, highlight inset 6 -> x=16.
    expect(fillStyles[0]).not.toBe('#95a5a6') // not the "unsolved" fallback - the real fill was applied
    const insets = strokeRects.map((r) => r.x)
    expect(insets).toContain(13) // certainty ring
    expect(insets).toContain(16) // highlight stroke, further inset so it doesn't overlap the ring

    const highlightStroke = strokeRects.find((r) => r.x === 16)
    expect(highlightStroke?.strokeStyle).toBe(PREMISE_HIGHLIGHT_COLOR)
  })

  it('gives clue-role and premise-role cells visually distinct stroke colors', () => {
    const { canvas, strokeRects } = makeFakeCanvas()
    const renderer = new BoardRenderer(canvas, { cellSize: 10 })
    const board = boardOf([cell({ highlightRole: 'clue' }), cell({ highlightRole: 'premise' })])
    renderer.render(board)

    // marginLeft=10 + col*cellSize(10) + inset(6): col0 -> x=16, col1 -> x=26.
    const clueStroke = strokeRects.find((r) => r.x === 16)!
    const premiseStroke = strokeRects.find((r) => r.x === 26)!
    expect(clueStroke.strokeStyle).toBe(CLUE_HIGHLIGHT_COLOR)
    expect(premiseStroke.strokeStyle).toBe(PREMISE_HIGHLIGHT_COLOR)
    expect(clueStroke.strokeStyle).not.toBe(premiseStroke.strokeStyle)
  })

  it('draws no highlight stroke for a non-highlighted cell', () => {
    const { canvas, strokeRects } = makeFakeCanvas()
    const renderer = new BoardRenderer(canvas, { cellSize: 10 })
    const board = boardOf([cell({ highlightRole: null })])
    renderer.render(board)

    expect(strokeRects.some((r) => r.x === 16)).toBe(false)
  })
})

describe('BoardRenderer axis labels (2.1)', () => {
  it('draws a column letter for each column and a row number for each row, matching known positions', () => {
    const { canvas, fillTexts } = makeFakeCanvas()
    const cellSize = 10
    const renderer = new BoardRenderer(canvas, { cellSize })
    const board: RenderBoard = {
      width: 3,
      height: 2,
      cells: [
        [cell(), cell(), cell()],
        [cell(), cell(), cell()],
      ],
    }
    renderer.render(board)

    const columnLabels = fillTexts.filter((t) => t.y === renderer.marginTop / 2).map((t) => t.text)
    expect(columnLabels).toEqual(['A', 'B', 'C'])

    const rowLabels = fillTexts.filter((t) => t.x === renderer.marginLeft / 2).map((t) => t.text)
    expect(rowLabels).toEqual(['1', '2'])
  })
})
