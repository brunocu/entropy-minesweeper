import { describe, expect, it } from 'vitest'
import {
  EIG_HIGH_COLOR,
  EIG_LOW_COLOR,
  MINE_POLE_COLOR,
  NEUTRAL_MIDPOINT_COLOR,
  SAFE_POLE_COLOR,
  eigGradientColor,
  probabilityColor,
} from '../probabilityColor.ts'

describe('p -> color mapping (5.2)', () => {
  it('maps p=0 and p=1 to visually distinct pole colors', () => {
    expect(probabilityColor(0)).toBe(SAFE_POLE_COLOR)
    expect(probabilityColor(1)).toBe(MINE_POLE_COLOR)
    expect(SAFE_POLE_COLOR).not.toBe(MINE_POLE_COLOR)
  })

  it('maps p=0.5 to the neutral midpoint color', () => {
    expect(probabilityColor(0.5)).toBe(NEUTRAL_MIDPOINT_COLOR)
  })

  it('is continuous and monotonic from each pole to the midpoint', () => {
    const nearSafe = probabilityColor(0.1)
    const mid = probabilityColor(0.5)
    const nearMine = probabilityColor(0.9)
    expect(nearSafe).not.toBe(SAFE_POLE_COLOR)
    expect(nearSafe).not.toBe(mid)
    expect(nearMine).not.toBe(MINE_POLE_COLOR)
    expect(nearMine).not.toBe(mid)
    expect(nearSafe).not.toBe(nearMine)
  })
})

describe('eig -> color mapping (revise-eig-visualization 1.1)', () => {
  it('maps low-EIG and high-EIG inputs to visually-ordered, distinct colors', () => {
    const low = eigGradientColor(0, 1)
    const mid = eigGradientColor(0.5, 1)
    const high = eigGradientColor(1, 1)
    expect(low).not.toBe(mid)
    expect(mid).not.toBe(high)
    expect(low).not.toBe(high)
    expect(high).toBe(EIG_HIGH_COLOR)
  })

  it('is distinct from the diverging probability scale', () => {
    expect(eigGradientColor(1, 1)).not.toBe(SAFE_POLE_COLOR)
    expect(eigGradientColor(1, 1)).not.toBe(MINE_POLE_COLOR)
    expect(eigGradientColor(0, 1)).not.toBe(SAFE_POLE_COLOR)
  })

  it('returns the high-end color for a degenerate single-value range (eig === max)', () => {
    expect(eigGradientColor(0.37, 0.37)).toBe(EIG_HIGH_COLOR)
  })

  it('anchors the low end at 0 bits, not the observed minimum', () => {
    // A cell at the bottom of a [0.4, 0.9] range is not near-white: 0.4 bits is a real amount
    // of information relative to a fixed 0 floor, not "the low end of what's possible here".
    const nearFloorOfObservedRange = eigGradientColor(0.4, 0.9)
    const trueFloor = eigGradientColor(0, 0.9)
    expect(nearFloorOfObservedRange).not.toBe(trueFloor)
    expect(nearFloorOfObservedRange).not.toBe(EIG_LOW_COLOR)
  })

  it('returns the low-end color when every certain-safe cell has zero EIG', () => {
    expect(eigGradientColor(0, 0)).toBe(EIG_LOW_COLOR)
  })
})
