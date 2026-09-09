import { describe, expect, it } from 'vitest'
import { toLabel } from '../chessLabel.ts'

describe('chess-style cell addressing', () => {
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

  it('labels distinct positions distinctly, deep into the two-letter range', () => {
    const cases: [number, number, string][] = [
      [0, 0, 'A1'],
      [4, 0, 'A5'],
      [0, 25, 'Z1'],
      [0, 26, 'AA1'],
      [0, 27, 'AB1'],
      [12, 51, 'AZ13'],
      [99, 701, 'ZZ100'],
    ]
    for (const [row, col, label] of cases) {
      expect(toLabel(row, col)).toBe(label)
    }
  })
})
