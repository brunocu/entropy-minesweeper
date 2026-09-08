import { describe, expect, it, vi } from 'vitest'
import { Board } from '../../board/board.ts'
import { boardFromMineLayout } from '../../__tests__/support/boardFactory.ts'
import {
  getDecompositionCallCountForTest,
  resetDecompositionCallCountForTest,
} from '../../solver/instrumentation.ts'
import { GameController } from '../gameController.ts'

/** A solver stub that reports an empty frontier and a fixed total uncertainty. */
function makeSolveFn(bits = 0) {
  return vi.fn(() => ({
    result: {
      frontier: [],
      frontierByKey: new Map(),
      nonFrontierProbability: null,
      nonFrontierCells: [],
      totalEntropyBits: bits,
    },
    worlds: [],
    cache: new Map(),
  }))
}

describe('one solver pass per settled board state', () => {
  it('calls the solver exactly once for a reveal that flood-fills many cells', () => {
    // 5x5 board with mines filling column 2: revealing (2,0) cascades across columns 0-1.
    const layout = Array.from({ length: 5 }, () => Array.from({ length: 5 }, (_, col) => col === 2))
    const board = boardFromMineLayout(layout)

    const solveFn = makeSolveFn()
    const controller = new GameController(board, solveFn)
    solveFn.mockClear() // ignore the constructor's initial pass

    controller.reveal(2, 0)

    const revealedCount = board.cells.flat().filter((c) => c.revealed).length
    expect(revealedCount).toBeGreaterThan(1) // sanity: this really was a multi-cell cascade
    expect(solveFn).toHaveBeenCalledTimes(1)
  })

  it('calls the solver exactly once for a single-cell reveal and never for a flag toggle', () => {
    const board = new Board(3, 3, 1)
    const solveFn = makeSolveFn()
    const controller = new GameController(board, solveFn)
    solveFn.mockClear()

    controller.toggleFlag(0, 0)
    expect(solveFn).toHaveBeenCalledTimes(0)

    controller.reveal(1, 1)
    expect(solveFn).toHaveBeenCalledTimes(1)
  })
})

describe('one board decomposition per settled board state', () => {
  // `solve` and `computeExplanations` share one decomposition per settled board state, rather
  // than each deriving the frontier/constraint/component phase for itself.
  it('decomposes exactly once for a reveal, not once per solver consumer', () => {
    const controller = new GameController(boardFromMineLayout([[false], [false], [true], [false], [true]]))

    resetDecompositionCallCountForTest()
    controller.reveal(0, 0)

    expect(getDecompositionCallCountForTest()).toBe(1)
  })

  it('never decomposes for a flag toggle: flags cannot change the decomposition', () => {
    const controller = new GameController(boardFromMineLayout([[false], [false], [true], [false], [true]]))
    controller.reveal(0, 0)

    resetDecompositionCallCountForTest()
    controller.toggleFlag(2, 0)

    expect(getDecompositionCallCountForTest()).toBe(0)
  })
})

describe('uncertainty history', () => {
  it('starts with exactly one history entry at move index 0', () => {
    const board = new Board(3, 3, 1)
    const controller = new GameController(board, makeSolveFn(5))

    expect(controller.uncertaintyHistory).toEqual([{ moveIndex: 0, totalEntropyBits: 5 }])
  })

  it('flag toggles never advance moveIndex or grow uncertaintyHistory', () => {
    const board = new Board(3, 3, 1)
    const controller = new GameController(board, makeSolveFn(5))

    controller.toggleFlag(0, 0)
    controller.toggleFlag(0, 0)
    controller.toggleFlag(1, 1)

    expect(controller.uncertaintyHistory).toEqual([{ moveIndex: 0, totalEntropyBits: 5 }])
  })

  it('clicking an already-revealed cell does not advance moveIndex', () => {
    const board = new Board(3, 3, 1)
    const controller = new GameController(board, makeSolveFn(5))

    controller.reveal(0, 0)
    expect(controller.uncertaintyHistory).toHaveLength(2)

    controller.reveal(0, 0)
    expect(controller.uncertaintyHistory).toHaveLength(2)
  })

  it('a genuine reveal advances moveIndex by exactly 1', () => {
    const board = new Board(3, 3, 1)
    const controller = new GameController(board, makeSolveFn(5))

    controller.reveal(0, 0)

    expect(controller.uncertaintyHistory).toEqual([
      { moveIndex: 0, totalEntropyBits: 5 },
      { moveIndex: 1, totalEntropyBits: 5 },
    ])
  })

  it('resets to a single move-0 entry when a new game (new controller instance) starts', () => {
    // Mine at (0,1) only: revealing (0,0) exposes a "1" with no cascade, so (1,1)
    // is still unrevealed and a genuine second move.
    const layout = [
      [false, true, false],
      [false, false, false],
      [false, false, false],
    ]
    const controller = new GameController(boardFromMineLayout(layout), makeSolveFn(5))
    controller.reveal(0, 0)
    controller.reveal(1, 1)
    expect(controller.uncertaintyHistory).toHaveLength(3)

    const newController = new GameController(new Board(3, 3, 1), makeSolveFn(7))
    expect(newController.uncertaintyHistory).toEqual([{ moveIndex: 0, totalEntropyBits: 7 }])
  })
})

describe('explanation lookup wiring', () => {
  it('reflects board state after each reveal, recomputed (not stale) on the next one', () => {
    // Width-1 corridor, mines at rows 2 and 4. Revealing (0,0) cascades into (1,0)="1",
    // which alone forces (2,0) mine. Revealing (3,0) afterwards adds a "2" whose two
    // neighbors (2,0),(4,0) are both fully forced by it alone - so (2,0) now has two
    // equally minimal one-clue explanations, and (4,0) gets a brand-new entry it had none of.
    const layout = [[false], [false], [true], [false], [true]]
    const controller = new GameController(boardFromMineLayout(layout))

    controller.reveal(0, 0)
    expect(controller.latestExplanations.get('2,0')?.clueCells).toEqual([{ row: 1, col: 0 }])
    expect(controller.latestExplanations.has('4,0')).toBe(false)

    controller.reveal(3, 0)
    // Which of the two single-clue explanations for (2,0) comes back is a tie the minimizer is
    // free to break either way; that it stays a one-clue explanation is the spec's actual claim.
    expect(controller.latestExplanations.get('2,0')?.clueCells).toHaveLength(1)
    expect(controller.latestExplanations.get('4,0')?.clueCells).toEqual([{ row: 3, col: 0 }])
  })
})

describe('explanation recompute on flag toggle', () => {
  // Same deduction chain as explanation.test.ts's flag-aware premise-seeding fixture,
  // adapted to a real, consistent mine layout (width-1 corridor, mines at rows 1 and 5):
  // ClueA=(0,0) forces M1=(1,0) mine on its own; ClueB=(2,0) then needs M1 to force
  // M2=(3,0) safe; ClueC=(4,0) then needs M2 to force X=(5,0) mine. Unflagged, X's
  // explanation needs all three clues; flagging M1 (independently, globally forced)
  // should let it drop ClueA.
  const layout = [[false], [true], [false], [false], [false], [true]]

  it('never calls solveFn for a flag toggle', () => {
    const solveFn = makeSolveFn()
    const controller = new GameController(boardFromMineLayout(layout), solveFn)
    solveFn.mockClear()

    controller.toggleFlag(1, 0)

    expect(solveFn).toHaveBeenCalledTimes(0)
  })

  it('never advances moveIndex or grows uncertaintyHistory for a flag toggle (extends uncertainty history tests)', () => {
    const controller = new GameController(boardFromMineLayout(layout))
    const before = controller.uncertaintyHistory

    controller.toggleFlag(1, 0)

    expect(controller.uncertaintyHistory).toEqual(before)
  })

  it('actually changes latestExplanations after a flag toggle that flags a globally-forced neighbor', () => {
    const controller = new GameController(boardFromMineLayout(layout))
    controller.reveal(0, 0)
    controller.reveal(2, 0)
    controller.reveal(4, 0)

    const beforeFlag = controller.latestExplanations.get('5,0')!
    expect(coordSet(beforeFlag.clueCells)).toEqual(
      coordSet([
        { row: 0, col: 0 },
        { row: 2, col: 0 },
        { row: 4, col: 0 },
      ]),
    )

    controller.toggleFlag(1, 0)

    const afterFlag = controller.latestExplanations.get('5,0')!
    expect(coordSet(afterFlag.clueCells)).toEqual(
      coordSet([
        { row: 2, col: 0 },
        { row: 4, col: 0 },
      ]),
    )
    expect(afterFlag.premiseCells).toContainEqual({ row: 1, col: 0 })
  })
})

function coordSet(coords: readonly { row: number; col: number }[]): Set<string> {
  return new Set(coords.map((c) => `${c.row},${c.col}`))
}
