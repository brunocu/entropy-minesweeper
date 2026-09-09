import { describe, it } from 'vitest'
import { Board } from '../../board/board.ts'
import { DIFFICULTIES, type Difficulty } from '../../game/difficulty.ts'
import { computeFrontierComponents, computeTrivialDeductions, decompose } from '../decomposition.ts'
import type { ComponentCache } from '../componentEnumeration.ts'
import { computeExplanations } from '../explanation.ts'
import {
  getEnumerationCallCountForTest,
  getGrowTrimCallCountForTest,
  getSubsetKeyCallCountForTest,
  resetEnumerationCallCountForTest,
  resetGrowTrimCallCountForTest,
  resetSubsetKeyCallCountForTest,
} from '../instrumentation.ts'
import { solve } from '../probability.ts'
import type { SolveResult, SolverBoard } from '../types.ts'
import { mulberry32 } from '../../__tests__/support/prng.ts'
import { snapshotSolverBoard } from '../../__tests__/support/solverBoard.ts'

/**
 * Investigation harness for the "reveal hangs for a couple seconds on Expert boards" report.
 *
 * First attempt called the real solve()/computeExplanations() pipeline unconditionally on every
 * simulated move and OOM-crashed the process after ~5.5 minutes - one simulated board produced a
 * frontier component whose exact backtracking enumeration didn't just get slow, it exhausted the
 * heap. That is itself a finding, and it means an unguarded harness can't safely measure the
 * pathological cases it exists to find.
 *
 * So: cheaply estimate each component's *free-variable count* first via computeTrivialDeductions
 * (a polynomial fixpoint, no backtracking) - free vars = component size minus cells Tier-0 already
 * resolves. Only invoke the real, timed solve()/computeExplanations() when the worst component's
 * free-variable count is within SAFE_FREE_VAR_CAP. Above that, log it as "would blow up" with its
 * size and move on using a cheap fallback, so one dangerous board can't take down the whole run.
 *
 * Not part of the normal suite: gated behind PROFILE=1 so `npm test` stays fast. Run with:
 *   PROFILE=1 npx vitest run src/lib/solver/__tests__/bottleneckProfile.test.ts
 */

const SAFE_FREE_VAR_CAP = 22
const MAX_MOVES_PER_GAME = 200
const SEEDS_PER_DIFFICULTY = 20

interface MoveRecord {
  readonly difficulty: string
  readonly seed: number
  readonly moveIndex: number
  readonly componentCount: number
  readonly maxComponentSize: number
  readonly maxFreeVars: number
  readonly frontierSize: number
  readonly skippedAsDangerous: boolean
  readonly revealMs: number
  readonly solveMs: number | null
  readonly explainMs: number | null
  readonly enumerationDelta: number | null
  readonly growTrimDelta: number | null
  readonly subsetKeyDelta: number | null
  readonly survivingWorlds: number | null
}

function toSolverBoard(board: Board): SolverBoard {
  return snapshotSolverBoard(board)
}

/** Free-variable count per frontier component, from a cheap Tier-0 pass (no backtracking). */
function componentFreeVarStats(solverBoard: SolverBoard): { maxFreeVars: number; components: number; maxComponentSize: number; frontierSize: number } {
  const components = computeFrontierComponents(solverBoard)
  const { forcedSafe, forcedMine } = computeTrivialDeductions(solverBoard)
  const resolved = new Set([...forcedSafe, ...forcedMine].map((c) => `${c.row},${c.col}`))

  let maxFreeVars = 0
  let maxComponentSize = 0
  let frontierSize = 0
  for (const cells of components) {
    frontierSize += cells.length
    maxComponentSize = Math.max(maxComponentSize, cells.length)
    const freeVars = cells.filter((c) => !resolved.has(`${c.row},${c.col}`)).length
    maxFreeVars = Math.max(maxFreeVars, freeVars)
  }
  return { maxFreeVars, components: components.length, maxComponentSize, frontierSize }
}

/** Cheap fallback move when the real solve() is skipped as dangerous: Tier-0 safe cell, or a random guess. */
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

/** Real-solve-informed move: known-safe cell, else least-risky guess by probability. */
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
    const idx = Math.floor(rng() * solveResult.nonFrontierCells.length)
    const cell = solveResult.nonFrontierCells[idx]
    return [cell.row, cell.col]
  }
  if (minFrontier) return [minFrontier.row, minFrontier.col]
  throw new Error('pickInformedMove found nothing to click')
}

function playGame(difficulty: Difficulty, seed: number, records: MoveRecord[]): void {
  const rng = mulberry32(seed)
  const board = new Board(difficulty.width, difficulty.height, difficulty.mineCount)
  let cache: ComponentCache = new Map()
  let lastSolveResult: SolveResult | null = null

  // First move: no frontier yet, always a cheap random click (mirrors a real opening click).
  {
    const unrevealed: [number, number][] = []
    for (let row = 0; row < board.height; row++) {
      for (let col = 0; col < board.width; col++) unrevealed.push([row, col])
    }
    const [row, col] = unrevealed[Math.floor(rng() * unrevealed.length)]
    board.reveal(row, col, rng)
  }

  for (let moveIndex = 0; moveIndex < MAX_MOVES_PER_GAME; moveIndex++) {
    if (board.status === 'won' || board.status === 'lost') break

    const solverBoard = toSolverBoard(board)
    const stats = componentFreeVarStats(solverBoard)
    const dangerous = stats.maxFreeVars > SAFE_FREE_VAR_CAP

    let row: number, col: number
    let solveMs: number | null = null
    let explainMs: number | null = null
    let enumerationDelta: number | null = null
    let growTrimDelta: number | null = null
    let subsetKeyDelta: number | null = null
    let survivingWorlds: number | null = null

    if (dangerous) {
      ;[row, col] = pickCheapMove(board, solverBoard, rng)
    } else {
      resetEnumerationCallCountForTest()
      resetGrowTrimCallCountForTest()
      resetSubsetKeyCallCountForTest()

      // One decomposition shared by both, as GameController does it - so the two phases below
      // are timed for their own work, not for a board decomposition each.
      const decomposition = decompose(solverBoard)
      const solveStart = performance.now()
      const solved = solve(decomposition, cache)
      solveMs = performance.now() - solveStart
      lastSolveResult = solved.result
      cache = solved.cache
      enumerationDelta = getEnumerationCallCountForTest()

      const explainStart = performance.now()
      const explained = computeExplanations(decomposition, solved.result, new Set(), cache)
      explainMs = performance.now() - explainStart
      cache = explained.cache
      growTrimDelta = getGrowTrimCallCountForTest()
      subsetKeyDelta = getSubsetKeyCallCountForTest()

      // Free: `solve` already reports the worlds it aggregated over.
      survivingWorlds = solved.worlds.length
      ;[row, col] = pickInformedMove(solved.result, rng)
    }

    const revealStart = performance.now()
    const changed = board.reveal(row, col, rng)
    const revealMs = performance.now() - revealStart
    if (!changed) continue

    records.push({
      difficulty: difficulty.name,
      seed,
      moveIndex,
      componentCount: stats.components,
      maxComponentSize: stats.maxComponentSize,
      maxFreeVars: stats.maxFreeVars,
      frontierSize: stats.frontierSize,
      skippedAsDangerous: dangerous,
      revealMs,
      solveMs,
      explainMs,
      enumerationDelta,
      growTrimDelta,
      subsetKeyDelta,
      survivingWorlds,
    })
  }

  void lastSolveResult
}

function summarize(difficulty: string, records: readonly MoveRecord[]): void {
  const forDifficulty = records.filter((r) => r.difficulty === difficulty)
  if (forDifficulty.length === 0) return

  const timed = forDifficulty.filter((r) => !r.skippedAsDangerous)
  const dangerous = forDifficulty.filter((r) => r.skippedAsDangerous)

  const totalSolve = timed.reduce((s, r) => s + (r.solveMs ?? 0), 0)
  const totalExplain = timed.reduce((s, r) => s + (r.explainMs ?? 0), 0)
  const totalSubsetKeys = timed.reduce((s, r) => s + (r.subsetKeyDelta ?? 0), 0)
  const over50 = timed.filter((r) => (r.solveMs ?? 0) + (r.explainMs ?? 0) > 50).length
  const over200 = timed.filter((r) => (r.solveMs ?? 0) + (r.explainMs ?? 0) > 200).length

  // eslint-disable-next-line no-console
  console.log(`\n=== ${difficulty}: ${forDifficulty.length} moves across all seeds ===`)
  // eslint-disable-next-line no-console
  console.log(
    `  timed moves: ${timed.length}  skipped-as-dangerous (freeVars>${SAFE_FREE_VAR_CAP}): ${dangerous.length}`,
  )
  // eslint-disable-next-line no-console
  console.log(`  timed total: solve=${totalSolve.toFixed(0)}ms explain=${totalExplain.toFixed(0)}ms`)
  // eslint-disable-next-line no-console
  console.log(
    `  per timed move: explain=${(totalExplain / timed.length).toFixed(3)}ms subsetKeys=${(totalSubsetKeys / timed.length).toFixed(1)} (total ${totalSubsetKeys})`,
  )
  // eslint-disable-next-line no-console
  console.log(`  timed moves >50ms: ${over50}  >200ms: ${over200}`)

  const maxFreeVarSeen = forDifficulty.reduce((m, r) => Math.max(m, r.maxFreeVars), 0)
  const freeVarHistogram = new Map<number, number>()
  for (const r of forDifficulty) {
    const bucket = Math.floor(r.maxFreeVars / 5) * 5
    freeVarHistogram.set(bucket, (freeVarHistogram.get(bucket) ?? 0) + 1)
  }
  // eslint-disable-next-line no-console
  console.log(`  max free-vars seen: ${maxFreeVarSeen}`)
  // eslint-disable-next-line no-console
  console.log(
    `  free-var histogram (bucket -> move count): ${[...freeVarHistogram.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([bucket, count]) => `[${bucket}-${bucket + 4}]=${count}`)
      .join(' ')}`,
  )

  const slowest = [...timed].sort((a, b) => (b.solveMs ?? 0) + (b.explainMs ?? 0) - ((a.solveMs ?? 0) + (a.explainMs ?? 0))).slice(0, 8)
  // eslint-disable-next-line no-console
  console.log(`  slowest timed moves:`)
  for (const r of slowest) {
    // eslint-disable-next-line no-console
    console.log(
      `    seed=${r.seed} move=${r.moveIndex} solve=${(r.solveMs ?? 0).toFixed(1)}ms explain=${(r.explainMs ?? 0).toFixed(1)}ms ` +
        `components=${r.componentCount} maxComponent=${r.maxComponentSize} maxFreeVars=${r.maxFreeVars} frontier=${r.frontierSize} ` +
        `enumMisses=${r.enumerationDelta} growTrimCalls=${r.growTrimDelta} subsetKeys=${r.subsetKeyDelta} survivingWorlds=${r.survivingWorlds ?? 'n/a'}`,
    )
  }

  if (dangerous.length > 0) {
    const worstDangerous = [...dangerous].sort((a, b) => b.maxFreeVars - a.maxFreeVars).slice(0, 5)
    // eslint-disable-next-line no-console
    console.log(`  worst skipped-as-dangerous moves (would have run exponential enumeration):`)
    for (const r of worstDangerous) {
      // eslint-disable-next-line no-console
      console.log(
        `    seed=${r.seed} move=${r.moveIndex} maxFreeVars=${r.maxFreeVars} maxComponent=${r.maxComponentSize} components=${r.componentCount} frontier=${r.frontierSize}`,
      )
    }
  }
}

describe.skipIf(!process.env.PROFILE)('solver bottleneck profile (manual investigation)', () => {
  it(
    'plays out many simulated games and reports where time actually goes',
    () => {
      const records: MoveRecord[] = []

      for (const difficulty of DIFFICULTIES) {
        for (let seed = 1; seed <= SEEDS_PER_DIFFICULTY; seed++) {
          playGame(difficulty, seed, records)
        }
        // Stream progress per difficulty rather than batching everything to the very end.
        summarize(difficulty.name, records)
      }
    },
    300_000,
  )
})
