import { describe, expect, it } from 'vitest'
import { decompose } from '../decomposition.ts'
import { solve } from '../probability.ts'
import { makeBoard } from '../../__tests__/support/makeBoard.ts'

describe('exact joint world enumeration', () => {
  it('resolves a cell to certainty via the 1-2-1 pattern, which neither single constraint forces alone', () => {
    // Row0 numbers: 1,2,1 over frontier cells A=(1,0) B=(1,1) C=(1,2).
    // Jointly: A+B=1, A+B+C=2, B+C=1 => unique solution A=1,B=0,C=1.
    const board = makeBoard(['121', '???'], 2)
    const result = solve(decompose(board), new Map()).result
    const byCoord = new Map(result.frontier.map((f) => [`${f.row},${f.col}`, f]))
    expect(byCoord.get('1,0')!.probability).toBeCloseTo(1)
    expect(byCoord.get('1,1')!.probability).toBeCloseTo(0)
    expect(byCoord.get('1,2')!.probability).toBeCloseTo(1)
  })
})

describe('global mine-count weighting', () => {
  it('normalizes per-cell marginal probabilities so expected mine count matches the board total', () => {
    // Width-1 corridor: R1=(1,0) constrains {X0,A}; R2=(3,0) constrains {A,X4}.
    // Two non-frontier cells N1=(5,0), N2=(6,0). mineCount=2.
    const board = makeBoard(['?', '1', '?', '1', '?', '?', '?'], 2)
    const result = solve(decompose(board), new Map()).result
    const byCoord = new Map(result.frontier.map((f) => [`${f.row},${f.col}`, f]))
    expect(byCoord.get('2,0')!.probability).toBeCloseTo(2 / 3) // A
    expect(byCoord.get('0,0')!.probability).toBeCloseTo(1 / 3) // X0
    expect(byCoord.get('4,0')!.probability).toBeCloseTo(1 / 3) // X4
    expect(result.nonFrontierProbability).toBeCloseTo(1 / 3)

    const expectedTotal =
      byCoord.get('2,0')!.probability +
      byCoord.get('0,0')!.probability +
      byCoord.get('4,0')!.probability +
      result.nonFrontierCells.length * (result.nonFrontierProbability ?? 0)
    expect(expectedTotal).toBeCloseTo(board.mineCount)
  })
})

describe('non-frontier probability', () => {
  it('gives every non-frontier cell the same probability, which shifts with the remaining mine count', () => {
    const lowMineBoard = makeBoard(['?', '1', '?', '1', '?', '?', '?'], 2)
    const highMineBoard = makeBoard(['?', '1', '?', '1', '?', '?', '?'], 3)

    const lowResult = solve(decompose(lowMineBoard), new Map()).result
    const highResult = solve(decompose(highMineBoard), new Map()).result

    expect(lowResult.nonFrontierCells).toHaveLength(2)
    expect(lowResult.nonFrontierProbability).toBeCloseTo(1 / 3)
    expect(highResult.nonFrontierProbability).toBeCloseTo(2 / 3)
    expect(lowResult.nonFrontierProbability).not.toBeCloseTo(highResult.nonFrontierProbability ?? NaN, 5)
  })
})

describe('expected information gain for frontier cells', () => {
  it('matches a hand-computed example: two symmetric cells, either resolves the board with certainty', () => {
    // Two "1"s sharing the same two unrevealed neighbors A,B; mineCount=1 so exactly one of A,B is a mine.
    // Revealing either cell fully resolves the other with certainty => EIG = prior entropy = 1 bit.
    const board = makeBoard(['11', '??'], 1)
    const result = solve(decompose(board), new Map()).result
    const a = result.frontier.find((f) => f.row === 1 && f.col === 0)!
    expect(a.probability).toBeCloseTo(0.5)
    expect(a.eig).toBeCloseTo(1, 5)
    expect(a.outcomeProbabilities.get('mine')).toBeCloseTo(0.5)
    expect(a.outcomeProbabilities.get('safe:1')).toBeCloseTo(0.5)
  })
})

describe('outcome probabilities for frontier cells', () => {
  it('reports per-outcome probabilities consistent with the pre-reveal distribution', () => {
    const board = makeBoard(['?', '1', '?', '1', '?', '?', '?'], 2)
    const result = solve(decompose(board), new Map()).result
    const a = result.frontier.find((f) => f.row === 2 && f.col === 0)!

    expect(a.eig).toBeCloseTo(0.91829, 4)
    expect(a.outcomeProbabilities.get('mine')).toBeCloseTo(2 / 3, 5)
    expect(a.outcomeProbabilities.get('safe:0')).toBeCloseTo(1 / 3, 5)
  })
})

describe('total joint uncertainty (totalEntropyBits)', () => {
  it('is exactly 0 bits when only one configuration remains consistent', () => {
    // 1-2-1 pattern uniquely resolves A=1,B=0,C=1 with no non-frontier cells remaining.
    const board = makeBoard(['121', '???'], 2)
    expect(solve(decompose(board), new Map()).result.totalEntropyBits).toBe(0)
  })

  it('does not increase after a reveal that adds a constraint', () => {
    // "before" is the same board with the middle numbered cell still unrevealed.
    const before = makeBoard(['1?1', '???'], 2)
    const after = makeBoard(['121', '???'], 2)
    expect(solve(decompose(after), new Map()).result.totalEntropyBits).toBeLessThanOrEqual(
      solve(decompose(before), new Map()).result.totalEntropyBits,
    )
  })

  it('equals log2(C(K, remainingMines)) for a board with no frontier', () => {
    const board = makeBoard(['???', '???'], 2)
    expect(solve(decompose(board), new Map()).result.frontier).toHaveLength(0)
    const K = 6
    const remainingMines = 2
    const expected = Math.log2(binomialForTest(K, remainingMines))
    expect(solve(decompose(board), new Map()).result.totalEntropyBits).toBeCloseTo(expected, 10)
  })
})

function binomialForTest(n: number, k: number): number {
  let result = 1
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1)
  return result
}
