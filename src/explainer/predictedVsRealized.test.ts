import { describe, expect, it } from 'vitest'
import { solve } from '../solver/frontierSolver.ts'
import { mulberry32 } from '../solver/testSupport.ts'
import { WORLDS_TREE_BOARD, WORLDS_TREE_FOCUS_CELL } from './fixtures.ts'
import { pickWeighted, simulateReveal, worldCount } from './predictedVsRealized.ts'

const { result: preSolve } = solve(WORLDS_TREE_BOARD, new Map())
const focusResult = preSolve.frontier.find(
  (f) => f.row === WORLDS_TREE_FOCUS_CELL.row && f.col === WORLDS_TREE_FOCUS_CELL.col,
)!

describe('predicted-vs-realized demo (6.1)', () => {
  it('draws outcomes in proportion to their solver-computed probabilities', () => {
    const random = mulberry32(20260904)
    const trials = 20000
    const counts = new Map<string, number>()
    for (let i = 0; i < trials; i++) {
      const { outcome } = simulateReveal(WORLDS_TREE_BOARD, WORLDS_TREE_FOCUS_CELL, random, preSolve)
      counts.set(outcome, (counts.get(outcome) ?? 0) + 1)
    }

    expect(new Set(counts.keys())).toEqual(new Set(focusResult.outcomeProbabilities.keys()))
    for (const [outcome, probability] of focusResult.outcomeProbabilities) {
      expect((counts.get(outcome) ?? 0) / trials).toBeCloseTo(probability, 2)
    }
  })

  it('reports the same predicted EIG the solver reports for the cell', () => {
    const { feedback } = simulateReveal(WORLDS_TREE_BOARD, WORLDS_TREE_FOCUS_CELL, mulberry32(1), preSolve)
    expect(feedback.predictedEig).toBeCloseTo(focusResult.eig, 10)
  })

  it('reports realized information matching the outcome that was drawn', () => {
    const random = mulberry32(7)
    const realizedByOutcome = new Map<string, number>()
    for (let i = 0; i < 200; i++) {
      const { outcome, feedback } = simulateReveal(WORLDS_TREE_BOARD, WORLDS_TREE_FOCUS_CELL, random, preSolve)
      const seen = realizedByOutcome.get(outcome)
      if (seen === undefined) realizedByOutcome.set(outcome, feedback.revealedInformation)
      else expect(feedback.revealedInformation).toBeCloseTo(seen, 10)
    }
    expect(realizedByOutcome.size).toBe(focusResult.outcomeProbabilities.size)
    // The realized value has to actually vary, or the demo demonstrates nothing. Outcomes that
    // leave equally many worlds standing legitimately pay the same, so the bar is two distinct
    // values, not one per outcome.
    expect(new Set([...realizedByOutcome.values()].map((v) => v.toFixed(6))).size).toBeGreaterThan(1)
  })

  it('pays each outcome its own surprisal', () => {
    // Equation (9): the information an answer delivers is -log2 of how likely it was.
    const random = mulberry32(11)
    for (let i = 0; i < 50; i++) {
      const { outcomeProbability, feedback } = simulateReveal(WORLDS_TREE_BOARD, WORLDS_TREE_FOCUS_CELL, random, preSolve)
      expect(feedback.revealedInformation).toBeCloseTo(-Math.log2(outcomeProbability), 10)
    }
  })

  it('counts the worlds an outcome leaves standing', () => {
    // A reveal that halves the world count is worth exactly one bit, whatever the board.
    const worldsBefore = worldCount(preSolve)
    const random = mulberry32(13)
    for (let i = 0; i < 50; i++) {
      const { outcomeProbability, feedback } = simulateReveal(WORLDS_TREE_BOARD, WORLDS_TREE_FOCUS_CELL, random, preSolve)
      const worldsAfter = worldsBefore * outcomeProbability
      expect(Math.round(worldsAfter)).toBeCloseTo(worldsAfter, 6)
      expect(feedback.revealedInformation).toBeCloseTo(Math.log2(worldsBefore / worldsAfter), 10)
    }
  })

  it('averages realized information back to the predicted EIG', () => {
    // EIG is the expectation of (9) over the outcome distribution - the claim the demo makes.
    const expected = [...focusResult.outcomeProbabilities].reduce(
      (sum, [, probability]) => sum + probability * -Math.log2(probability),
      0,
    )
    expect(expected).toBeCloseTo(focusResult.eig, 10)
  })
})

describe('pickWeighted', () => {
  it('respects the weights’ cumulative boundaries', () => {
    const weights = new Map([
      ['a', 0.25],
      ['b', 0.75],
    ])
    expect(pickWeighted(weights, () => 0)).toBe('a')
    expect(pickWeighted(weights, () => 0.24)).toBe('a')
    expect(pickWeighted(weights, () => 0.26)).toBe('b')
    expect(pickWeighted(weights, () => 0.999)).toBe('b')
  })
})
