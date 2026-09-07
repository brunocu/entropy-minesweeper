// Traces 1:1 to the scenarios in
// openspec/changes/entropy-minesweeper/specs/information-visualization/spec.md
//
// Color/EIG/comparison *logic* is automated here. Scenarios that are purely about pixels
// on a canvas (the certainty ring rendering, heatmap redraw, predicted/realized sequencing
// in the DOM) were verified visually in-browser during implementation (5.1, 5.3, 6.1, 6.2,
// 7.1) - this sandbox has no headless browser to re-run those automatically.
import { describe, expect, it } from 'vitest'
import { solve } from '../solver/probability.ts'
import { computeRevealFeedback, findFrontierEig } from '../game/revealFeedback.ts'
import { MINE_POLE_COLOR, NEUTRAL_MIDPOINT_COLOR, SAFE_POLE_COLOR, probabilityColor } from '../render/probabilityColor.ts'
import { makeBoard } from './support/makeBoard.ts'

describe('information-visualization spec scenarios (8.1)', () => {
  it('Certainly-safe cell shows the safe-pole color', () => {
    expect(probabilityColor(0)).toBe(SAFE_POLE_COLOR)
  })

  it('Certainly-mined cell shows the mine-pole color', () => {
    expect(probabilityColor(1)).toBe(MINE_POLE_COLOR)
    expect(MINE_POLE_COLOR).not.toBe(SAFE_POLE_COLOR)
  })

  it('Maximally uncertain cell shows the neutral midpoint color', () => {
    expect(probabilityColor(0.5)).toBe(NEUTRAL_MIDPOINT_COLOR)
  })

  it('Non-frontier cells are included in the heatmap', () => {
    const board = makeBoard(['?', '1', '?', '1', '?', '?', '?'], 2)
    const result = solve(board, new Map()).result
    expect(result.nonFrontierCells.length).toBeGreaterThan(0)
    expect(result.nonFrontierProbability).not.toBeNull()
  })

  it('Inspecting a frontier cell shows EIG', () => {
    const board = makeBoard(['11', '??'], 1)
    const result = solve(board, new Map()).result
    expect(findFrontierEig(result, 1, 0)).not.toBeNull()
  })

  it('Inspecting a non-frontier cell shows no EIG', () => {
    const board = makeBoard(['?', '1', '?', '1', '?', '?', '?'], 2)
    const result = solve(board, new Map()).result
    expect(findFrontierEig(result, 5, 0)).toBeNull()
  })

  it('Predicted and realized values are both available for a frontier reveal', () => {
    const board = makeBoard(['11', '??'], 1)
    const preReveal = solve(board, new Map()).result
    const postReveal = solve(makeBoard(['11', '1?'], 1), new Map()).result
    const feedback = computeRevealFeedback(preReveal, postReveal, 1, 0)
    expect(feedback.predictedEig).toBeGreaterThan(0)
    expect(feedback.revealedInformation).toBeGreaterThan(0)
  })

  it('Non-frontier reveals show no predicted EIG, but still show revealed information', () => {
    const board = makeBoard(['?', '1', '?', '1', '?', '?', '?'], 2)
    const preReveal = solve(board, new Map()).result
    const postReveal = solve(makeBoard(['?', '1', '?', '1', '?', '0', '?'], 2), new Map()).result
    const feedback = computeRevealFeedback(preReveal, postReveal, 5, 0)
    expect(feedback.predictedEig).toBeNull()
    expect(feedback.revealedInformation).not.toBeNaN()
  })
})
