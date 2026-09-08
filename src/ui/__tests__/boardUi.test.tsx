// The repaint discipline the Solid port inherited from `main.ts` is performance behavior, so a
// rewrite could redraw per `mousemove` and still be correct everywhere else (port-game-ui-to-solid
// design.md — Risks). These mount the real components against a stubbed Canvas2D surface and count
// the calls that actually reach `BoardRenderer.render` and the chart.
import { render } from 'solid-js/web'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { BoardRenderer } from '../../render/boardRenderer.ts'
import { createUncertaintyChart } from '../../render/uncertaintyChart.ts'
import { App } from '../App.tsx'
import { CELL_SIZE } from '../BoardCanvas.tsx'

vi.mock('../../render/uncertaintyChart.ts', () => ({
  createUncertaintyChart: vi.fn(() => ({ update: vi.fn(), reset: vi.fn() })),
}))

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
  HTMLCanvasElement.prototype.getContext = (() =>
    fakeContext()) as unknown as HTMLCanvasElement['getContext']
})

function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  render(() => <App />, host)
  const canvas = host.querySelector('canvas')!
  const readouts = host.querySelectorAll('.readout')
  return {
    host,
    canvas,
    hover: readouts[0],
    reveal: readouts[1],
    status: readouts[2],
    entropy: readouts[3],
    minesLeft: host.querySelector('.toolbar__mines-left')!,
    move: (row: number, col: number) =>
      canvas.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: CELL_SIZE + col * CELL_SIZE + 16,
          clientY: CELL_SIZE + row * CELL_SIZE + 16,
        }),
      ),
    click: (row: number, col: number) =>
      canvas.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          clientX: CELL_SIZE + col * CELL_SIZE + 16,
          clientY: CELL_SIZE + row * CELL_SIZE + 16,
        }),
      ),
    flag: (row: number, col: number) =>
      canvas.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          clientX: CELL_SIZE + col * CELL_SIZE + 16,
          clientY: CELL_SIZE + row * CELL_SIZE + 16,
        }),
      ),
  }
}

describe('solid port', () => {
  it('mounts and paints once', () => {
    const paint = vi.spyOn(BoardRenderer.prototype, 'render')
    const app = mount()
    expect(app.canvas).toBeTruthy()
    expect(paint).toHaveBeenCalledTimes(1)
    expect(app.minesLeft.textContent).toBe('Mines left: 40')
    expect(app.entropy.textContent).toMatch(/^Total uncertainty: /)
    expect(vi.mocked(createUncertaintyChart)).toHaveBeenCalled()
    paint.mockRestore()
  })

  it('repaints once per cell transition, not per pointer event', () => {
    const app = mount()
    const paint = vi.spyOn(BoardRenderer.prototype, 'render')
    for (let step = 0; step < 8; step++) app.move(0, 0)
    expect(paint).toHaveBeenCalledTimes(0)
    for (let col = 1; col < 6; col++) {
      app.move(0, col)
      app.move(0, col)
    }
    expect(paint.mock.calls.length).toBeLessThanOrEqual(5)
    paint.mockRestore()
  })

  it('repaints exactly once for a flag toggle, and updates mines-left', () => {
    const app = mount()
    const paint = vi.spyOn(BoardRenderer.prototype, 'render')
    app.flag(3, 3)
    expect(paint).toHaveBeenCalledTimes(1)
    expect(app.minesLeft.textContent).toBe('Mines left: 39')
    app.flag(3, 3)
    expect(paint).toHaveBeenCalledTimes(2)
    expect(app.minesLeft.textContent).toBe('Mines left: 40')
    paint.mockRestore()
  })

  it('updates the chart on a reveal only', () => {
    const app = mount()
    const chart = vi.mocked(createUncertaintyChart).mock.results.at(-1)!.value
    chart.update.mockClear()
    app.move(5, 5)
    app.flag(2, 2)
    expect(chart.update).toHaveBeenCalledTimes(0)
    app.click(5, 5)
    expect(chart.update).toHaveBeenCalledTimes(1)
    expect(app.reveal.textContent).toMatch(/Revealed information: /)
  })

  it('re-derives readouts after the board changes underneath a still pointer', () => {
    const app = mount()
    app.move(7, 7)
    const before = app.hover.textContent
    app.click(7, 7)
    expect(app.hover.textContent).not.toBe(before)
  })

  it('assembles the hover readout and reports a loss', () => {
    const app = mount()
    const paint = vi.spyOn(BoardRenderer.prototype, 'render')
    app.click(8, 8)

    const board = paint.mock.calls.at(-1)![0]
    let frontier: { row: number; col: number } | null = null
    let mine: { row: number; col: number } | null = null
    for (let row = 0; row < board.height; row++) {
      for (let col = 0; col < board.width; col++) {
        const cell = board.cells[row][col]
        if (cell.revealed) continue
        if (cell.isMine && !mine) mine = { row, col }
        if (!cell.isMine && cell.eig !== null && !frontier) frontier = { row, col }
      }
    }
    expect(frontier).not.toBeNull()
    expect(mine).not.toBeNull()

    app.move(frontier!.row, frontier!.col)
    const lines = app.hover.textContent!.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toMatch(/^P\(mine\): \d+%$/)
    expect(lines[2]).toMatch(/^Expected information gain: \d+\.\d{3} bits$/)

    expect(app.status.textContent).toBe('')
    app.click(mine!.row, mine!.col)
    expect(app.status.textContent).toBe('Boom — game over.')
    paint.mockRestore()
  })

  it('links to the explainer', () => {
    const link = mount().host.querySelector('.toolbar__explainer-link') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe(`${import.meta.env.BASE_URL}explainer.html`)
    expect(link.textContent).toBe('What does any of this mean?')
  })

  it('resets the chart on a new game and resizes the board', () => {
    const app = mount()
    const chart = vi.mocked(createUncertaintyChart).mock.results.at(-1)!.value
    const select = app.host.querySelector('select')!
    select.value = 'Expert'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    chart.reset.mockClear()
    app.host.querySelector('button')!.click()
    expect(chart.reset).toHaveBeenCalledTimes(1)
    expect(app.canvas.width).toBe(30 * CELL_SIZE + CELL_SIZE)
    expect(app.minesLeft.textContent).toBe('Mines left: 99')
  })
})
