// The site's colors, in one place. Both consumers read from here: the canvas renderers import
// these values directly (they need JS strings at draw time), and `tokens.css` — a `:root` block of
// custom properties for the HTML pages — is generated from this file by `scripts/generate-tokens.mjs`.
// Never hand-edit `tokens.css`; a test asserts it matches what the generator would emit right now.
//
// Names are semantic, never literal: `safe`/`mine`, not `blue`/`red`. That is what makes the
// cross-page guarantee mean something — the explainer's `.term-safe` span and the board's
// certainly-safe cell fill are the same token because they mean the same thing.
export const tokens = {
  // Page chrome. Warm near-neutrals, so the prose and the game share one paper.
  ink: '#26241f',
  inkSoft: '#5a5650',
  rule: '#ddd9d2',
  surface: '#fcfcfb',
  page: '#f6f5f2',

  // Diverging probability scale. The dataviz skill's documented diverging pair and neutral gray
  // (references/palette.md): blue <-> red poles, gray midpoint.
  safe: '#0d366b', // sequential blue ramp, step 700
  mine: '#d03b3b', // status "critical" red
  neutral: '#c0c0c0', // diverging neutral midpoint, light surface

  // Sequential EIG-gradient ramp: categorical slot 7 (violet), distinct from the diverging scale's
  // blue/red poles so the two never read as one continuous scale. `eig` is the ramp's full-strength
  // end, and doubles as the explainer's EIG accent.
  eigLow: '#e3dff5', // light violet tint, near-surface (low EIG)
  eig: '#4a3aa7', // categorical slot 7 violet, full saturation (high EIG)

  // Certainty-explanation highlight outlines: two more categorical slots, distinct from the
  // diverging poles above and the EIG ramp's violet, so the explanation overlay never reads as
  // another probability/EIG value.
  clue: '#1baf7a', // categorical slot 3, aqua (revealed numbered clue cells)
  // Slot 5 magenta read too close to the mine-pole red on a p=1 (mine-colored) premise cell;
  // slot 6 green sits at the opposite end of the wheel from both that red and the aqua clue color.
  premise: '#008300', // categorical slot 6, green (unrevealed premise cells)

  // Neutral ramp for cells that carry no probability reading. Both steps sit clear of `neutral`
  // above, or a flagged cell would read as a maximally uncertain one.
  neutralDim: '#7f8c8d', // flagged cells
  neutralMid: '#95a5a6', // unrevealed cells with no solver probability yet

  // Board line work.
  certaintyRing: '#ffffff', // the exact-certainty ring drawn on top of a cell's fill
  cellBorder: 'rgba(0, 0, 0, 0.25)', // per-cell grid outline
} as const

export type TokenName = keyof typeof tokens
