import { describe, expect, it } from 'vitest'
import { decompose } from '../../solver/decomposition.ts'
import { solve } from '../../solver/probability.ts'
import { computeRevealFeedback, findFrontierEig } from '../revealFeedback.ts'
import { makeBoard } from '../../__tests__/support/makeBoard.ts'

describe('frontier EIG readout', () => {
  it('reports EIG for a frontier cell and nothing for a non-frontier cell', () => {
    const board = makeBoard(['?', '1', '?', '1', '?', '?', '?'], 2)
    const result = solve(decompose(board), new Map()).result
    expect(findFrontierEig(result, 2, 0)).not.toBeNull() // A, a frontier cell
    expect(findFrontierEig(result, 5, 0)).toBeNull() // N1, non-frontier
  })
})

describe('predicted-vs-realized reveal feedback', () => {
  it('returns predicted EIG and revealed information for a frontier reveal', () => {
    const board = makeBoard(['11', '??'], 1)
    const preReveal = solve(decompose(board), new Map()).result
    const postBoard = makeBoard(['11', '1?'], 1)
    const postReveal = solve(decompose(postBoard), new Map()).result
    const feedback = computeRevealFeedback(preReveal, postReveal, 1, 0)
    expect(feedback.predictedEig).toBeCloseTo(1, 5)
    expect(feedback.revealedInformation).toBeCloseTo(1, 5)
  })

  it('reports predictedEig as null for a non-frontier reveal but still reports revealed information', () => {
    const board = makeBoard(['?', '1', '?', '1', '?', '?', '?'], 2)
    const preReveal = solve(decompose(board), new Map()).result
    const postBoard = makeBoard(['?', '1', '?', '1', '?', '0', '?'], 2)
    const postReveal = solve(decompose(postBoard), new Map()).result
    const feedback = computeRevealFeedback(preReveal, postReveal, 5, 0)
    expect(feedback.predictedEig).toBeNull()
    expect(feedback.revealedInformation).not.toBeNaN()
  })

  it('reports revealed information for a whole cascade, not just the clicked cell', () => {
    // Nothing is revealed yet, so the clicked cell (index 0) starts out non-frontier - the
    // pre-reveal solve has no frontier entry for it at all, which is why revealed information is
    // measured over the whole board rather than per cell. Clicking it cascades: 0 -> 0 -> '1'
    // (stops), which pins index 3
    // as a certain mine and index 4 as certainly safe - full board resolution, 0 bits remaining.
    const board = makeBoard(['?', '?', '?', '?', '?'], 1)
    const preReveal = solve(decompose(board), new Map()).result
    const postBoard = makeBoard(['0', '0', '1', '?', '?'], 1)
    const postReveal = solve(decompose(postBoard), new Map()).result

    expect(preReveal.totalEntropyBits).toBeCloseTo(Math.log2(5), 5)
    expect(postReveal.totalEntropyBits).toBeCloseTo(0, 10)

    const feedback = computeRevealFeedback(preReveal, postReveal, 0, 0)
    expect(feedback.predictedEig).toBeNull()
    expect(feedback.revealedInformation).toBeCloseTo(Math.log2(5), 5)
  })
})
