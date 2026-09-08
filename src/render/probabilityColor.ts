// p -> color mapping for the probability heatmap: a diverging scale so p=0 (certainly safe)
// and p=1 (certainly mined) read as visually opposite poles, with p=0.5 (peak uncertainty)
// as the neutral midpoint. Revised from an initial sequential-H(p) design that mapped both
// p=0 and p=1 to the same color.
//
// Also holds a second, sequential eig -> color mapping for certain-safe (p=0) frontier
// cells' EIG-gradient fill: the two scales
// share the hex-mixing helpers below, so this module's purpose is "p/eig -> color mapping
// for the visualization."
//
// Poles/midpoint are the dataviz skill's documented diverging pair and neutral gray
// (references/palette.md): blue<->red poles, gray midpoint.
const SAFE_POLE = '#0d366b' // sequential blue ramp, step 700
const MINE_POLE = '#d03b3b' // status "critical" red
const NEUTRAL_MIDPOINT = '#c0c0c0' // diverging neutral midpoint, light surface

// Sequential EIG-gradient ramp: categorical slot 7 (violet), distinct from the diverging
// scale's blue/red poles so the two never read as one continuous scale.
const EIG_LOW = '#e3dff5' // light violet tint, near-surface (low EIG)
const EIG_HIGH = '#4a3aa7' // categorical slot 7 violet, full saturation (high EIG)

// Certainty-explanation highlight outline colors: two more categorical slots, distinct from
// the diverging poles above and the
// EIG ramp's violet, so the explanation overlay never reads as another probability/EIG value.
const CLUE_HIGHLIGHT = '#1baf7a' // categorical slot 3, aqua (revealed numbered clue cells)
// Slot 5 magenta read too close to the mine-pole red on a p=1 (mine-colored) premise cell;
// slot 6 green sits at the opposite end of the wheel from both that red and the aqua clue color.
const PREMISE_HIGHLIGHT = '#008300' // categorical slot 6, green (unrevealed premise cells)

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
 * Maps a certain-safe frontier cell's EIG to a position on the sequential EIG-gradient scale.
 * The low end is always 0 bits (not the board's observed minimum), so a cell's color is
 * comparable across renders instead of drifting with whatever the smallest EIG happens to be
 * this turn; the high end is the max EIG among the current board's certain-safe frontier cells.
 * When that max is 0 (every such cell carries zero information), returns the scale's low end.
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
