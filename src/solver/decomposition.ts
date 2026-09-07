// Board decomposition: which unrevealed cells are on the frontier, what the revealed numbers
// constrain, what Tier 0 alone can settle, and how the frontier splits into independent
// components. See openspec/changes/entropy-minesweeper/specs/frontier-solver/spec.md.

import { key, type Coord, type SolverBoard, type SolverCell } from './types.ts'

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

/** 3.1 Frontier identification: unrevealed cells adjacent to a revealed numbered cell. */
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

interface TrivialDeductionResult {
  readonly forcedSafe: ReadonlySet<string>
  readonly forcedMine: ReadonlySet<string>
}

/**
 * 3.2 Tier 0 trivial deduction, applied iteratively until no more cells can be resolved.
 * `seedForcedSafe`/`seedForcedMine` (design.md Decision 5, step 3) seed the accumulators
 * with facts already known true from elsewhere (e.g. a flagged-and-globally-forced cell)
 * before the fixpoint loop runs, rather than adding a new "given" constraint type.
 */
export function applyTrivialDeduction(
  constraints: readonly RawConstraint[],
  seedForcedSafe?: ReadonlySet<string>,
  seedForcedMine?: ReadonlySet<string>,
): TrivialDeductionResult {
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

/** 3.3 Partition the frontier into connected components via shared numbered neighbors. */
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
