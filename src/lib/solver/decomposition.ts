// Board decomposition: which unrevealed cells are on the frontier, what the revealed numbers
// constrain, what Tier 0 alone can settle, and how the frontier splits into independent
// components.

import { incrementDecompositionCallCount } from './instrumentation.ts'
import { key, type Coord, type ForcedCells, type SolverBoard, type SolverCell } from './types.ts'

export function isNumbered(cell: SolverCell): boolean {
  return cell.revealed && cell.adjacentMines > 0
}

export function neighbors(board: SolverBoard, row: number, col: number): Coord[] {
  const result: Coord[] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const r = row + dr
      const c = col + dc
      if (r >= 0 && r < board.height && c >= 0 && c < board.width) result.push({ row: r, col: c })
    }
  }
  return result
}

/** Frontier identification: unrevealed cells adjacent to a revealed numbered cell. */
export function identifyFrontier(board: SolverBoard): Coord[] {
  const seen = new Set<string>()
  const result: Coord[] = []
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      const cell = board.cells[row][col]
      if (!isNumbered(cell)) continue
      for (const n of neighbors(board, row, col)) {
        const neighborCell = board.cells[n.row][n.col]
        if (neighborCell.revealed) continue
        const k = key(n.row, n.col)
        if (!seen.has(k)) {
          seen.add(k)
          result.push(n)
        }
      }
    }
  }
  return result
}

export interface RawConstraint {
  /** Coordinate key of the revealed numbered cell this constraint comes from. */
  readonly key: string
  readonly cells: string[]
  readonly requiredMines: number
}

export function buildConstraints(board: SolverBoard): RawConstraint[] {
  const constraints: RawConstraint[] = []
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      const cell = board.cells[row][col]
      if (!isNumbered(cell)) continue
      const cells: string[] = []
      for (const n of neighbors(board, row, col)) {
        const neighborCell = board.cells[n.row][n.col]
        if (!neighborCell.revealed) cells.push(key(n.row, n.col))
      }
      if (cells.length > 0) constraints.push({ key: key(row, col), cells, requiredMines: cell.adjacentMines })
    }
  }
  return constraints
}

/**
 * Tier 0 trivial deduction, applied iteratively until no more cells can be resolved.
 * `seedForcedSafe`/`seedForcedMine` seed the accumulators with facts already known true from
 * elsewhere (e.g. a flagged-and-globally-forced cell) before the fixpoint loop runs, rather
 * than adding a new "given" constraint type.
 */
export function applyTrivialDeduction(
  constraints: readonly RawConstraint[],
  seedForcedSafe?: ReadonlySet<string>,
  seedForcedMine?: ReadonlySet<string>,
): ForcedCells {
  const forcedSafe = new Set<string>(seedForcedSafe)
  const forcedMine = new Set<string>(seedForcedMine)

  const working = constraints.map((c) => ({
    cells: new Set(c.cells),
    requiredMines: c.requiredMines,
  }))

  let changed = true
  while (changed) {
    changed = false
    for (const c of working) {
      for (const cellKey of [...c.cells]) {
        if (forcedMine.has(cellKey)) {
          c.cells.delete(cellKey)
          c.requiredMines -= 1
          changed = true
        } else if (forcedSafe.has(cellKey)) {
          c.cells.delete(cellKey)
          changed = true
        }
      }
      if (c.cells.size === 0) continue
      if (c.requiredMines <= 0) {
        for (const cellKey of c.cells) {
          if (!forcedSafe.has(cellKey)) {
            forcedSafe.add(cellKey)
            changed = true
          }
        }
      } else if (c.requiredMines === c.cells.size) {
        for (const cellKey of c.cells) {
          if (!forcedMine.has(cellKey)) {
            forcedMine.add(cellKey)
            changed = true
          }
        }
      }
    }
  }

  return { forcedSafe, forcedMine }
}

export function computeTrivialDeductions(board: SolverBoard): { forcedSafe: Coord[]; forcedMine: Coord[] } {
  const frontierCoords = identifyFrontier(board)
  const coordByKey = new Map(frontierCoords.map((c) => [key(c.row, c.col), c]))
  const constraints = buildConstraints(board)
  const { forcedSafe, forcedMine } = applyTrivialDeduction(constraints)
  return {
    forcedSafe: [...forcedSafe].map((k) => coordByKey.get(k)!),
    forcedMine: [...forcedMine].map((k) => coordByKey.get(k)!),
  }
}

class UnionFind {
  private readonly parent = new Map<string, string>()

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x)
    let root = this.parent.get(x)!
    while (root !== this.parent.get(root)) root = this.parent.get(root)!
    this.parent.set(x, root)
    return root
  }

  union(a: string, b: string): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }
}

/** Partition the frontier into connected components via shared numbered neighbors. */
export function computeComponents(
  frontierKeys: string[],
  constraints: readonly RawConstraint[],
): Map<string, string[]> {
  const uf = new UnionFind()
  for (const k of frontierKeys) uf.find(k)
  for (const c of constraints) {
    for (let i = 1; i < c.cells.length; i++) uf.union(c.cells[0], c.cells[i])
  }
  const groups = new Map<string, string[]>()
  for (const k of frontierKeys) {
    const root = uf.find(k)
    const arr = groups.get(root)
    if (arr) arr.push(k)
    else groups.set(root, [k])
  }
  return groups
}

export function computeFrontierComponents(board: SolverBoard): Coord[][] {
  const frontierCoords = identifyFrontier(board)
  const frontierKeys = frontierCoords.map((c) => key(c.row, c.col))
  const coordByKey = new Map(frontierCoords.map((c) => [key(c.row, c.col), c]))
  const constraints = buildConstraints(board)
  const components = computeComponents(frontierKeys, constraints)
  return [...components.values()].map((cells) => cells.map((k) => coordByKey.get(k)!))
}

/** One frontier component, with the clues that constrain it already sliced out of the board's. */
export interface ComponentSlice {
  readonly cells: readonly string[]
  /** The constraints touching this component, in `constraints` order. */
  readonly relevantConstraints: readonly RawConstraint[]
}

/**
 * Everything `solve` and `computeExplanations` both need from a board before either starts
 * enumerating: which cells are on the frontier, what the revealed numbers constrain, and how
 * that frontier splits into independent components with their own clues.
 *
 * `GameController` runs both consumers against the same board every move, so this is a value the
 * two share rather than something each derives for itself.
 *
 * Holds nothing flag-dependent: two boards differing only in a flag must solve identically, which
 * holds precisely because the shared part cannot see flags. The per-component signature therefore
 * stays with each consumer, and there is no flag field here to pass one in.
 */
export interface Decomposition {
  /** The board this was derived from, carried so a caller cannot pair it with a different one. */
  readonly board: SolverBoard
  readonly frontierCoords: readonly Coord[]
  readonly frontierKeys: readonly string[]
  readonly frontierSet: ReadonlySet<string>
  readonly frontierCoordByKey: ReadonlyMap<string, Coord>
  readonly constraints: readonly RawConstraint[]
  readonly componentSlices: readonly ComponentSlice[]
  /** Unrevealed cells that no revealed number touches - the pooled remainder. */
  readonly nonFrontierCells: readonly Coord[]
  readonly numberedCoordByKey: ReadonlyMap<string, Coord>
}

export function decompose(board: SolverBoard): Decomposition {
  incrementDecompositionCallCount()
  const frontierCoords = identifyFrontier(board)
  const frontierKeys = frontierCoords.map((c) => key(c.row, c.col))
  const frontierSet = new Set(frontierKeys)
  const frontierCoordByKey = new Map(frontierCoords.map((c, i) => [frontierKeys[i], c]))

  const constraints = buildConstraints(board)
  const components = computeComponents(frontierKeys, constraints)

  // Every cell of a constraint is an unrevealed neighbor of the same numbered cell and
  // `computeComponents` unions them, so a constraint lies wholly inside one component and its first
  // cell names which - one pass over the constraints rather than a scan per component.
  const sliceByRoot = new Map<string, { cells: readonly string[]; relevantConstraints: RawConstraint[] }>()
  const rootByCell = new Map<string, string>()
  for (const [root, cells] of components) {
    sliceByRoot.set(root, { cells, relevantConstraints: [] })
    for (const cellKey of cells) rootByCell.set(cellKey, root)
  }
  for (const constraint of constraints) {
    const root = rootByCell.get(constraint.cells[0])
    if (root !== undefined) sliceByRoot.get(root)!.relevantConstraints.push(constraint)
  }

  const nonFrontierCells: Coord[] = []
  const numberedCoordByKey = new Map<string, Coord>()
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      const cell = board.cells[row][col]
      if (isNumbered(cell)) numberedCoordByKey.set(key(row, col), { row, col })
      if (cell.revealed) continue
      if (!frontierSet.has(key(row, col))) nonFrontierCells.push({ row, col })
    }
  }

  return {
    board,
    frontierCoords,
    frontierKeys,
    frontierSet,
    frontierCoordByKey,
    constraints,
    componentSlices: [...sliceByRoot.values()],
    nonFrontierCells,
    numberedCoordByKey,
  }
}
