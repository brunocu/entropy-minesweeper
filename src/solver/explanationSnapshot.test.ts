import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Board } from '../board/board.ts'
import {
  computeExplanations,
  computeFrontierComponents,
  computeTrivialDeductions,
  solve,
  type ComponentCache,
  type SolveResult,
  type SolverBoard,
} from './frontierSolver.ts'
import { mulberry32, snapshotSolverBoard } from './testSupport.ts'

/**
 * Output tripwire for reduce-explanation-setup-overhead (task 1.2, design D6).
 *
 * Serializes `computeExplanations`' *full* output - every certain cell's `clueCells` and
 * `premiseCells` - over a fixed battery of played-out boards, so a stage that is argued to be
 * output-preserving can be checked against the pre-change baseline rather than trusted.
 *
 * This is not the acceptance gate: the spec properties in `explanationProperties.test.ts` are.
 * A diff here means one of the equivalence arguments needs diagnosing, and may legitimately end
 * in "genuine equally-minimal tie".
 *
 * Gated behind SNAPSHOT=1 so `npm test` stays fast. Run with:
 *   SNAPSHOT=1 SNAPSHOT_OUT=baseline.local npx vitest run src/solver/explanationSnapshot.test.ts
 */

interface Difficulty {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly mineCount: number
  readonly seeds: number
}

/** Mirrors bottleneckProfile's guard: never invoke the real pipeline on a board that would blow up. */
const SAFE_FREE_VAR_CAP = 22
const MAX_MOVES_PER_GAME = 200

const BATTERY: readonly Difficulty[] = [
  { name: 'Beginner', width: 9, height: 9, mineCount: 10, seeds: 6 },
  { name: 'Intermediate', width: 16, height: 16, mineCount: 40, seeds: 4 },
  { name: 'Expert', width: 30, height: 16, mineCount: 99, seeds: 2 },
]

function maxFreeVars(solverBoard: SolverBoard): number {
  const { forcedSafe, forcedMine } = computeTrivialDeductions(solverBoard)
  const resolved = new Set([...forcedSafe, ...forcedMine].map((c) => `${c.row},${c.col}`))
  let worst = 0
  for (const cells of computeFrontierComponents(solverBoard)) {
    worst = Math.max(worst, cells.filter((c) => !resolved.has(`${c.row},${c.col}`)).length)
  }
  return worst
}

function pickCheapMove(board: Board, solverBoard: SolverBoard, rng: () => number): [number, number] {
  const { forcedSafe } = computeTrivialDeductions(solverBoard)
  if (forcedSafe.length > 0) return [forcedSafe[0].row, forcedSafe[0].col]
  const unrevealed: [number, number][] = []
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      if (!board.cells[row][col].revealed) unrevealed.push([row, col])
    }
  }
  return unrevealed[Math.floor(rng() * unrevealed.length)]
}

function pickInformedMove(solveResult: SolveResult, rng: () => number): [number, number] {
  const safe = solveResult.frontier.find((f) => f.probability === 0)
  if (safe) return [safe.row, safe.col]
  const minFrontier = solveResult.frontier.reduce<{ row: number; col: number; probability: number } | null>(
    (best, f) => (best === null || f.probability < best.probability ? f : best),
    null,
  )
  const nonFrontierIsBetter =
    solveResult.nonFrontierProbability !== null &&
    (minFrontier === null || solveResult.nonFrontierProbability <= minFrontier.probability)
  if (nonFrontierIsBetter && solveResult.nonFrontierCells.length > 0) {
    const cell = solveResult.nonFrontierCells[Math.floor(rng() * solveResult.nonFrontierCells.length)]
    return [cell.row, cell.col]
  }
  if (minFrontier) return [minFrontier.row, minFrontier.col]
  throw new Error('pickInformedMove found nothing to click')
}

function coords(cells: readonly { row: number; col: number }[]): string {
  return cells
    .map((c) => `${c.row},${c.col}`)
    .sort()
    .join(' ')
}

/** One line per certain cell, cells sorted so the snapshot pins content rather than array order. */
function serializeExplanations(explanations: ReadonlyMap<string, { clueCells: readonly { row: number; col: number }[]; premiseCells: readonly { row: number; col: number }[] }>): string[] {
  return [...explanations.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `    ${k} clues=[${coords(v.clueCells)}] premises=[${coords(v.premiseCells)}]`)
}

function playGame(difficulty: Difficulty, seed: number, lines: string[]): void {
  const rng = mulberry32(seed)
  const board = new Board(difficulty.width, difficulty.height, difficulty.mineCount)
  let cache: ComponentCache = new Map()

  {
    const all: [number, number][] = []
    for (let row = 0; row < board.height; row++) {
      for (let col = 0; col < board.width; col++) all.push([row, col])
    }
    const [row, col] = all[Math.floor(rng() * all.length)]
    board.reveal(row, col, rng)
  }

  for (let moveIndex = 0; moveIndex < MAX_MOVES_PER_GAME; moveIndex++) {
    if (board.status === 'won' || board.status === 'lost') break
    const solverBoard = snapshotSolverBoard(board)

    let row: number, col: number
    if (maxFreeVars(solverBoard) > SAFE_FREE_VAR_CAP) {
      ;[row, col] = pickCheapMove(board, solverBoard, rng)
    } else {
      const solved = solve(solverBoard, cache)
      const explained = computeExplanations(solverBoard, solved.result, new Set(), solved.cache)
      cache = explained.cache
      lines.push(`  ${difficulty.name} seed=${seed} move=${moveIndex}`)
      lines.push(...serializeExplanations(explained.explanations))
      ;[row, col] = pickInformedMove(solved.result, rng)
    }

    if (!board.reveal(row, col, rng)) continue
  }
}

function captureSnapshot(): string {
  const lines: string[] = []
  for (const difficulty of BATTERY) {
    for (let seed = 1; seed <= difficulty.seeds; seed++) playGame(difficulty, seed, lines)
  }
  return lines.join('\n') + '\n'
}

describe.skipIf(!process.env.SNAPSHOT)('explanation output snapshot (manual tripwire)', () => {
  it(
    'serializes every certain cell\'s explanation across the board battery, stably across runs',
    () => {
      const first = captureSnapshot()
      const second = captureSnapshot()
      expect(second).toBe(first) // the tripwire is worthless if it is not itself deterministic

      const out = process.env.SNAPSHOT_OUT ?? 'explanation-snapshot.local'
      writeFileSync(out, first)
      // eslint-disable-next-line no-console
      console.log(`wrote ${first.split('\n').length} lines to ${out}`)
    },
    600_000,
  )
})
