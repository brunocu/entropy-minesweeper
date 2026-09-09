import { describe, expect, it } from 'vitest'
import { pixelToCell } from '../hitTest.ts'

describe('grid-coordinate hit-testing', () => {
  it('maps known pixel coordinates to the expected row/column', () => {
    const cellSize = 32
    const width = 10
    const height = 8

    expect(pixelToCell(0, 0, cellSize, width, height)).toEqual({ row: 0, col: 0 })
    expect(pixelToCell(31, 31, cellSize, width, height)).toEqual({ row: 0, col: 0 })
    expect(pixelToCell(32, 0, cellSize, width, height)).toEqual({ row: 0, col: 1 })
    expect(pixelToCell(0, 32, cellSize, width, height)).toEqual({ row: 1, col: 0 })
    expect(pixelToCell(3 * 32 + 5, 2 * 32 + 10, cellSize, width, height)).toEqual({ row: 2, col: 3 })
  })

  it('returns null outside the board bounds', () => {
    const cellSize = 32
    const width = 10
    const height = 8

    expect(pixelToCell(-1, 0, cellSize, width, height)).toBeNull()
    expect(pixelToCell(0, -1, cellSize, width, height)).toBeNull()
    expect(pixelToCell(width * cellSize, 0, cellSize, width, height)).toBeNull()
    expect(pixelToCell(0, height * cellSize, cellSize, width, height)).toBeNull()
  })
})
