import { describe, expect, it } from 'vitest'
import { fromLabel, toLabel } from './chessLabel.ts'

describe('chess-style cell addressing (1.1)', () => {
  it('labels the top-left cell A1', () => {
    expect(toLabel(0, 0)).toBe('A1')
  })

  it('labels row 1 at the top', () => {
    expect(toLabel(4, 0)).toBe('A5')
  })

  it('crosses the Z/AA boundary at the 27th column', () => {
    expect(toLabel(0, 25)).toBe('Z1')
    expect(toLabel(0, 26)).toBe('AA1')
    expect(toLabel(0, 27)).toBe('AB1')
  })

  it('continues past AZ into BA', () => {
    expect(toLabel(0, 51)).toBe('AZ1')
    expect(toLabel(0, 52)).toBe('BA1')
  })

  it('round-trips labels back to their original position', () => {
    const cases: [number, number][] = [
      [0, 0],
      [4, 0],
      [0, 25],
      [0, 26],
      [0, 27],
      [12, 51],
      [99, 701],
    ]
    for (const [row, col] of cases) {
      expect(fromLabel(toLabel(row, col))).toEqual({ row, col })
    }
  })

  it('throws on an unparsable label', () => {
    expect(() => fromLabel('1A')).toThrow()
    expect(() => fromLabel('')).toThrow()
  })
})
