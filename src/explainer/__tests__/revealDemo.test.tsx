// The demo's behaviour, now that markup and logic live in one component. It used to be wired to the
// article by five element IDs, which meant nothing could drive it without the article's HTML; the
// component can just be mounted.
import { render } from 'solid-js/web'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { BoardRenderer } from '../../render/boardRenderer.ts'
import { WORLDS_TREE_BOARD, WORLDS_TREE_FOCUS_CELL } from '../fixtures.ts'
import { RevealDemo } from '../RevealDemo.tsx'

const CELL_SIZE = 44

function fakeContext() {
  return new Proxy(
    {},
    {
      get: (_target, property) => (property === 'measureText' ? () => ({ width: 0 }) : () => {}),
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => fakeContext()) as unknown as HTMLCanvasElement['getContext']
})

let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
  document.body.innerHTML = ''
})

/** Mounts the demo with a fixed draw, so the outcome is the same on every run. */
function mount(random: () => number = () => 0) {
  const host = document.createElement('div')
  document.body.append(host)
  dispose = render(() => <RevealDemo random={random} />, host)

  const canvas = host.querySelector('canvas')!
  // jsdom leaves `getBoundingClientRect` at the origin, so client coordinates are the renderer's
  // own margins plus the cell offset.
  const { marginLeft, marginTop } = new BoardRenderer(canvas, { cellSize: CELL_SIZE })

  return {
    predicted: host.querySelector('.demo-predicted')!,
    realized: host.querySelector('.demo-realized')!,
    narration: host.querySelector('.demo-narration')!,
    reset: host.querySelector<HTMLButtonElement>('.demo-reset')!,
    clickCell: (row: number, col: number) =>
      canvas.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          clientX: marginLeft + col * CELL_SIZE + CELL_SIZE / 2,
          clientY: marginTop + row * CELL_SIZE + CELL_SIZE / 2,
        }),
      ),
  }
}

describe('reveal demo', () => {
  it('shows the predicted EIG before anything is revealed, and no realized value', () => {
    const demo = mount()
    expect(demo.predicted.textContent).toMatch(/^\d+\.\d{3} bits$/)
    expect(demo.realized.textContent).toBe('?')
    expect(demo.reset.disabled).toBe(true)
  })

  it('shows realized information beside the prediction once the focus cell is revealed', () => {
    const demo = mount()
    demo.clickCell(WORLDS_TREE_FOCUS_CELL.row, WORLDS_TREE_FOCUS_CELL.col)

    expect(demo.realized.textContent).toMatch(/^\d+\.\d{3} bits$/)
    expect(demo.realized.textContent).not.toBe('?')
    // The prediction is a property of the position, so it does not move when an outcome lands.
    expect(demo.predicted.textContent).toMatch(/^\d+\.\d{3} bits$/)
    expect(demo.reset.disabled).toBe(false)
    expect(demo.narration.textContent).toContain('came back as')
  })

  it('ignores clicks on every cell but the focus cell', () => {
    const demo = mount()
    const other = WORLDS_TREE_BOARD.cells
      .flatMap((row, rowIndex) => row.map((_cell, colIndex) => ({ row: rowIndex, col: colIndex })))
      .find((cell) => cell.row !== WORLDS_TREE_FOCUS_CELL.row || cell.col !== WORLDS_TREE_FOCUS_CELL.col)!

    demo.clickCell(other.row, other.col)

    expect(demo.realized.textContent).toBe('?')
    expect(demo.reset.disabled).toBe(true)
  })

  it('re-rolls back to the un-revealed state', () => {
    const demo = mount()
    demo.clickCell(WORLDS_TREE_FOCUS_CELL.row, WORLDS_TREE_FOCUS_CELL.col)
    demo.reset.click()

    expect(demo.realized.textContent).toBe('?')
    expect(demo.reset.disabled).toBe(true)
    expect(demo.narration.textContent).toContain('Click')
  })
})
