// p -> color for the probability heatmap: a diverging scale, so p=0 (certainly safe) and p=1
// (certainly mined) read as opposite poles with p=0.5 as the neutral midpoint. Also holds the
// sequential eig -> color scale for certain-safe cells' gradient fill, which shares the hex-mixing
// helpers below.
//
// The values live in `tokens.ts`, which the pages' CSS is derived from too - the poles here and the
// `--safe`/`--mine` prose colors are the same token, so writing and board never drift apart.
import { tokens } from '../tokens.ts'

const SAFE_POLE = tokens.safe
const MINE_POLE = tokens.mine
const NEUTRAL_MIDPOINT = tokens.neutral

const EIG_LOW = tokens.eigLow
const EIG_HIGH = tokens.eig

const CLUE_HIGHLIGHT = tokens.clue
const PREMISE_HIGHLIGHT = tokens.premise

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex([r, g, b]: readonly [number, number, number]): string {
  const channel = (v: number) => Math.round(v).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  const mixed: [number, number, number] = [
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
  ]
  return rgbToHex(mixed)
}

/** Maps a mine probability to a diverging heatmap color: safe pole -> neutral -> mine pole. */
export function probabilityColor(p: number): string {
  const clamped = Math.min(1, Math.max(0, p))
  if (clamped <= 0.5) return mixHex(SAFE_POLE, NEUTRAL_MIDPOINT, clamped / 0.5)
  return mixHex(NEUTRAL_MIDPOINT, MINE_POLE, (clamped - 0.5) / 0.5)
}

/**
 * A certain-safe cell's EIG to a position on the sequential scale. The low end is always 0 bits,
 * not the board's observed minimum, so a cell's color is comparable across renders; the high end is
 * the max EIG among the board's certain-safe frontier cells. Returns the low end when that max is 0.
 */
export function eigGradientColor(eig: number, max: number): string {
  if (max <= 0) return EIG_LOW
  const t = Math.min(1, Math.max(0, eig / max))
  return mixHex(EIG_LOW, EIG_HIGH, t)
}

export const SAFE_POLE_COLOR = SAFE_POLE
export const MINE_POLE_COLOR = MINE_POLE
export const NEUTRAL_MIDPOINT_COLOR = NEUTRAL_MIDPOINT
export const EIG_LOW_COLOR = EIG_LOW
export const EIG_HIGH_COLOR = EIG_HIGH
export const CLUE_HIGHLIGHT_COLOR = CLUE_HIGHLIGHT
export const PREMISE_HIGHLIGHT_COLOR = PREMISE_HIGHLIGHT
