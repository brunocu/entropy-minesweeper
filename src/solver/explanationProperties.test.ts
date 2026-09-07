import { describe, expect, it } from 'vitest'
import { Board } from '../board/board.ts'
import {
  computeClueBfsLayers,
  computeClueBfsLayersForComponent,
  computeExplanations,
  computeFrontierComponents,
  computeTrivialDeductions,
  solve,
  type Coord,
  type FrontierExplanation,
  type SolverBoard,
  type SolverCell,
} from './frontierSolver.ts'
import { mulberry32, snapshotSolverBoard } from './testSupport.ts'

/**
 * The acceptance gate for reduce-explanation-setup-overhead (tasks 1.4, 1.5).
 *
 * `frontier-solver`'s "Minimal Certainty Explanation" requirement is what an explanation must
 * satisfy - sufficient, irreducible, and confined to the cell's own frontier component - so these
 * assert those properties directly rather than pinning exact output. Byte-identity with today's
 * output is the separate tripwire in `explanationSnapshot.test.ts`; a diff there is diagnosed,
 * a failure here indicts the change.
 */

function makeBoard(rows: string[], mineCount: number): SolverBoard {
  const height = rows.length
  const width = rows[0].length
  const cells: SolverCell[][] = rows.map((row) =>
    row.split('').map((ch): SolverCell => {
      if (ch === '?') return { revealed: false, adjacentMines: 0 }
      if (ch === '.') return { revealed: true, adjacentMines: 0 }
      return { revealed: true, adjacentMines: Number(ch) }
    }),
  )
  return { width, height, mineCount, cells }
}

const SAFE_FREE_VAR_CAP = 22

/** Plays a seeded game and returns each board state along the way, skipping ones too costly to solve. */
function playedBoards(width: number, height: number, mineCount: number, seed: number, maxStates: number): SolverBoard[] {
  const rng = mulberry32(seed)
  const board = new Board(width, height, mineCount)
  const states: SolverBoard[] = []

  const all: [number, number][] = []
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) all.push([row, col])
  }
  const [r0, c0] = all[Math.floor(rng() * all.length)]
  board.reveal(r0, c0, rng)

  while (states.length < maxStates && board.status !== 'won' && board.status !== 'lost') {
    const solverBoard = snapshotSolverBoard(board)
    const { forcedSafe, forcedMine } = computeTrivialDeductions(solverBoard)
    const resolved = new Set([...forcedSafe, ...forcedMine].map((c) => `${c.row},${c.col}`))
    const worstFreeVars = computeFrontierComponents(solverBoard).reduce(
      (worst, cells) => Math.max(worst, cells.filter((c) => !resolved.has(`${c.row},${c.col}`)).length),
      0,
    )
    if (worstFreeVars <= SAFE_FREE_VAR_CAP) states.push(solverBoard)

    if (forcedSafe.length > 0) {
      board.reveal(forcedSafe[0].row, forcedSafe[0].col, rng)
    } else {
      const unrevealed = all.filter(([row, col]) => !board.cells[row][col].revealed)
      if (unrevealed.length === 0) break
      const [row, col] = unrevealed[Math.floor(rng() * unrevealed.length)]
      board.reveal(row, col, rng)
    }
  }
  return states
}

/**
 * The battery: hand-built fixtures covering the multi-component and chained-premise cases, plus
 * played-out 9x9 and 16x16 boards for breadth.
 */
const BATTERY: readonly SolverBoard[] = [
  makeBoard(['121', '???'], 2),
  makeBoard(['1??1'], 2), // two disjoint components
  makeBoard(['1???1', '?????'], 2), // two disjoint components, multi-cell each
  makeBoard(['1', '?', '1', '?', '1', '?', '.'], 2), // chained premises
  makeBoard(['11.1', '????'], 2),
  makeBoard(['.1', '.?'], 1),
  ...playedBoards(9, 9, 10, 1, 12),
  ...playedBoards(9, 9, 10, 2, 12),
  ...playedBoards(16, 16, 40, 1, 10),
]

function k(c: Coord): string {
  return `${c.row},${c.col}`
}

interface LocalConstraint {
  readonly cells: string[]
  readonly required: number
}

/** The unrevealed neighbours a numbered cell constrains - the solver's own constraint, restated. */
function clueCells(board: SolverBoard, clue: Coord): string[] {
  const out: string[] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const r = clue.row + dr
      const c = clue.col + dc
      if (r < 0 || r >= board.height || c < 0 || c >= board.width) continue
      if (!board.cells[r][c].revealed) out.push(`${r},${c}`)
    }
  }
  return out
}

function constraintOf(board: SolverBoard, clue: Coord): LocalConstraint {
  return { cells: clueCells(board, clue), required: board.cells[clue.row][clue.col].adjacentMines }
}

/** Every clue constraining at least one of the component's cells - the component's own clue set. */
function componentConstraints(board: SolverBoard, component: ReadonlySet<string>): LocalConstraint[] {
  const out: LocalConstraint[] = []
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      const cell = board.cells[row][col]
      if (!cell.revealed || cell.adjacentMines === 0) continue
      const constraint = constraintOf(board, { row, col })
      if (constraint.cells.some((k) => component.has(k))) out.push(constraint)
    }
  }
  return out
}

/**
 * Whether `constraints` alone force `x` to `targetValue`, decided by enumerating every 0/1
 * assignment over the cells they mention and keeping the ones satisfying all of them exactly.
 * Deliberately independent of the solver: no Tier-0 fixpoint, no QuickXplain, no global mine
 * count - so a passing explanation is checked against the logic the spec means, not against the
 * code that produced it.
 */
function forces(constraints: readonly LocalConstraint[], x: Coord, targetValue: 0 | 1): boolean {
  const vars = [...new Set(constraints.flatMap((c) => c.cells))]
  const index = new Map(vars.map((v, i) => [v, i]))
  const target = index.get(k(x))
  if (target === undefined) return false

  const assignment = new Array<number>(vars.length).fill(-1)
  const consistent = (): boolean =>
    constraints.every((c) => {
      let sum = 0
      let unassigned = 0
      for (const cell of c.cells) {
        const v = assignment[index.get(cell)!]
        if (v === -1) unassigned++
        else sum += v
      }
      return sum <= c.required && sum + unassigned >= c.required
    })

  let sawAny = false
  let forced = true
  const backtrack = (i: number): void => {
    if (!forced) return
    if (i === vars.length) {
      sawAny = true
      if (assignment[target] !== targetValue) forced = false
      return
    }
    for (const v of [0, 1]) {
      assignment[i] = v
      if (consistent()) backtrack(i + 1)
    }
    assignment[i] = -1
  }
  backtrack(0)
  return sawAny && forced
}

interface CertainCell {
  readonly x: Coord
  readonly targetValue: 0 | 1
  readonly explanation: FrontierExplanation
  readonly component: ReadonlySet<string>
  readonly componentCells: readonly Coord[]
  /**
   * Whether the cell's certainty follows from its component's clues at all. A frontier cell can
   * instead be certain only because of the board's *global* mine budget, which `solve`'s world
   * weighting knows and the explainer - scoped to frontier constraints by design - does not. For
   * those, `growSufficientSet` exhausts every layer without resolving and `quickXplain` falls back
   * to returning all of them, so no sufficient or irreducible explanation exists to assert on.
   * A known, pre-existing limitation, untouched by reduce-explanation-setup-overhead.
   */
  readonly locallyForced: boolean
}

function certainCells(board: SolverBoard): CertainCell[] {
  const result = solve(board, new Map()).result
  const explanations = computeExplanations(board, result, new Set(), new Map()).explanations

  const componentOf = new Map<string, Coord[]>()
  for (const cells of computeFrontierComponents(board)) {
    for (const cell of cells) componentOf.set(k(cell), cells)
  }

  const out: CertainCell[] = []
  for (const f of result.frontier) {
    if (f.probability !== 0 && f.probability !== 1) continue
    const explanation = explanations.get(k(f))
    if (!explanation) continue
    const x = { row: f.row, col: f.col }
    const targetValue: 0 | 1 = f.probability === 1 ? 1 : 0
    const componentCells = componentOf.get(k(x))!
    const component = new Set(componentCells.map(k))
    out.push({
      x,
      targetValue,
      explanation,
      component,
      componentCells,
      locallyForced: forces(componentConstraints(board, component), x, targetValue),
    })
  }
  return out
}

describe('component-scoped BFS layering equals whole-board layering (1.4)', () => {
  it('yields identical layers for every certain cell across the battery, multi-component boards included', () => {
    let checked = 0
    for (const board of BATTERY) {
      for (const { x, componentCells } of certainCells(board)) {
        expect(computeClueBfsLayersForComponent(board, componentCells, x)).toEqual(computeClueBfsLayers(board, x))
        checked++
      }
    }
    expect(checked).toBeGreaterThan(50) // the battery must actually be exercising the claim
  })
})

describe('minimal certainty explanation properties (1.5)', () => {
  it('is sufficient: each explanation\'s clues alone force the cell to its reported value', () => {
    let checked = 0
    for (const board of BATTERY) {
      for (const { x, targetValue, explanation, locallyForced } of certainCells(board)) {
        if (!locallyForced) continue
        const clues = explanation.clueCells.map((clue) => constraintOf(board, clue))
        expect({ x, clues: explanation.clueCells, sufficient: forces(clues, x, targetValue) }).toMatchObject({
          sufficient: true,
        })
        checked++
      }
    }
    expect(checked).toBeGreaterThan(50)
  })

  it('is irreducible: dropping any single clue loses the forcing', () => {
    for (const board of BATTERY) {
      for (const { x, targetValue, explanation, locallyForced } of certainCells(board)) {
        if (!locallyForced) continue
        for (const dropped of explanation.clueCells) {
          const rest = explanation.clueCells.filter((c) => k(c) !== k(dropped)).map((clue) => constraintOf(board, clue))
          expect({ x, dropped, stillForces: forces(rest, x, targetValue) }).toMatchObject({ stillForces: false })
        }
      }
    }
  })

  it('is component-confined: every clue and premise cell belongs to the cell\'s own frontier component', () => {
    for (const board of BATTERY) {
      for (const { x, explanation, component } of certainCells(board)) {
        for (const clue of explanation.clueCells) {
          const inComponent = clueCells(board, clue).some((cell) => component.has(cell))
          expect({ x, clue, inComponent }).toMatchObject({ inComponent: true })
        }
        for (const premise of explanation.premiseCells) {
          expect({ x, premise, inComponent: component.has(k(premise)) }).toMatchObject({ inComponent: true })
        }
      }
    }
  })

  it('excludes only globally-forced cells, whose explanation is empty', () => {
    // Characterizes the exclusion the two properties above make, so it stays a named limitation
    // rather than a silent hole: a cell the component's own clues do not force is QuickXplain's
    // "no p-set" case (Junker 2004, Alg. 1 line 1), and reports no clues and no premises at all
    // rather than an unminimized whole-component set that is neither sufficient nor irreducible.
    let excluded = 0
    for (const board of BATTERY) {
      for (const { x, explanation, locallyForced } of certainCells(board)) {
        if (locallyForced) continue
        excluded++
        expect({ x, clueCells: explanation.clueCells, premiseCells: explanation.premiseCells }).toMatchObject({
          clueCells: [],
          premiseCells: [],
        })
      }
    }
    // The battery is known to contain such cells; if it stops doing so, this stops being tested.
    expect(excluded).toBeGreaterThan(0)
  })
})

/**
 * The layering algorithm as it stood before D3 made it lazy: a materialized pairwise clue
 * adjacency followed by a BFS walked to exhaustion. Kept here as an independent reference so the
 * generator can be checked against what it replaced, rather than only against its own fixtures.
 */
function eagerClueBfsLayers(board: SolverBoard, x: Coord): Coord[][] {
  const constraints: { key: string; cells: string[] }[] = []
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      const cell = board.cells[row][col]
      if (!cell.revealed || cell.adjacentMines === 0) continue
      const cells = clueCells(board, { row, col })
      if (cells.length > 0) constraints.push({ key: `${row},${col}`, cells })
    }
  }

  const byCell = new Map<string, string[]>()
  for (const c of constraints) {
    for (const cellKey of c.cells) {
      const arr = byCell.get(cellKey)
      if (arr) arr.push(c.key)
      else byCell.set(cellKey, [c.key])
    }
  }
  const adjacency = new Map<string, Set<string>>()
  for (const c of constraints) adjacency.set(c.key, new Set())
  for (const clueKeys of byCell.values()) {
    for (let i = 0; i < clueKeys.length; i++) {
      for (let j = i + 1; j < clueKeys.length; j++) {
        adjacency.get(clueKeys[i])!.add(clueKeys[j])
        adjacency.get(clueKeys[j])!.add(clueKeys[i])
      }
    }
  }

  const visited = new Set<string>()
  const layers: Coord[][] = []
  let layerKeys = [...new Set(constraints.filter((c) => c.cells.includes(k(x))).map((c) => c.key))].sort()
  while (layerKeys.length > 0) {
    for (const key of layerKeys) visited.add(key)
    layers.push(layerKeys.map((key) => parseCoord(key)))
    const next = new Set<string>()
    for (const key of layerKeys) {
      for (const neighbour of adjacency.get(key) ?? []) {
        if (!visited.has(neighbour)) next.add(neighbour)
      }
    }
    layerKeys = [...next].sort()
  }
  return layers
}

function parseCoord(cellKey: string): Coord {
  const [row, col] = cellKey.split(',').map(Number)
  return { row, col }
}

describe('lazy layer walking matches the eager layering it replaced (3.1)', () => {
  it('drains to exactly the layers the pre-D3 adjacency-and-full-walk algorithm produced', () => {
    let checked = 0
    for (const board of BATTERY) {
      for (const { x } of certainCells(board)) {
        expect(computeClueBfsLayers(board, x)).toEqual(eagerClueBfsLayers(board, x))
        checked++
      }
    }
    expect(checked).toBeGreaterThan(50)
  })
})

describe('explanation determinism covers computeExplanations end to end (1.5)', () => {
  it('returns identical output across repeated calls over the whole battery', () => {
    for (const board of BATTERY) {
      const result = solve(board, new Map()).result
      const first = computeExplanations(board, result, new Set(), new Map()).explanations
      const second = computeExplanations(board, result, new Set(), new Map()).explanations
      expect(second).toEqual(first)
    }
  })
})
