// Per-component exact enumeration and the component cache that keys it.

import { applyTrivialDeduction, buildConstraints, type RawConstraint } from './decomposition.ts'
import type { FrontierExplanation } from './explanation.ts'
import { key, type Coord, type SolverBoard } from './types.ts'

export interface ComponentAssignment {
  readonly assignment: ReadonlyMap<string, 0 | 1>
  readonly mineCount: number
}

interface ReducedConstraint {
  readonly cells: string[]
  readonly required: number
}

export function isPartiallyConsistent(
  assignment: Map<string, 0 | 1>,
  reduced: readonly ReducedConstraint[],
): boolean {
  for (const c of reduced) {
    let sum = 0
    let unassigned = 0
    for (const k of c.cells) {
      const v = assignment.get(k)
      if (v === undefined) unassigned++
      else sum += v
    }
    if (sum > c.required || sum + unassigned < c.required) return false
  }
  return true
}

export interface ComponentEnumeration {
  readonly assignments: ComponentAssignment[]
  readonly forcedMine: ReadonlySet<string>
  readonly forcedSafe: ReadonlySet<string>
}

/**
 * Per-component exact backtracking enumeration with Tier 0 pre-applied. Also exposes the
 * component's real (untrimmed) forced-mine/forced-safe sets, so they can be intersected with
 * flagged cells elsewhere.
 */
export function enumerateComponentFull(
  componentCells: readonly string[],
  constraints: readonly RawConstraint[],
): ComponentEnumeration {
  // Accepts either the whole board's constraints or a component's own slice: the filter is
  // idempotent, so a caller that already holds the slice can hand it over and pay only for its
  // own clues.
  const componentSet = new Set(componentCells)
  const relevantConstraints = constraints.filter((c) => c.cells.some((k) => componentSet.has(k)))

  const { forcedSafe, forcedMine } = applyTrivialDeduction(relevantConstraints)

  const fixed = new Map<string, 0 | 1>()
  for (const k of componentCells) {
    if (forcedMine.has(k)) fixed.set(k, 1)
    else if (forcedSafe.has(k)) fixed.set(k, 0)
  }
  const freeVars = componentCells.filter((k) => !fixed.has(k))

  const reduced: ReducedConstraint[] = relevantConstraints
    .map((c) => {
      let required = c.requiredMines
      const cells: string[] = []
      for (const k of c.cells) {
        const f = fixed.get(k)
        if (f === 1) required -= 1
        else if (f === undefined) cells.push(k)
      }
      return { cells, required }
    })
    .filter((c) => c.cells.length > 0)

  const results: ComponentAssignment[] = []
  const assignment = new Map<string, 0 | 1>(fixed)

  function backtrack(idx: number): void {
    if (idx === freeVars.length) {
      for (const c of reduced) {
        let sum = 0
        for (const k of c.cells) sum += assignment.get(k)!
        if (sum !== c.required) return
      }
      let mineCount = 0
      for (const v of assignment.values()) mineCount += v
      results.push({ assignment: new Map(assignment), mineCount })
      return
    }
    const k = freeVars[idx]
    for (const value of [0, 1] as const) {
      assignment.set(k, value)
      if (isPartiallyConsistent(assignment, reduced)) backtrack(idx + 1)
    }
    assignment.delete(k)
  }

  backtrack(0)
  return { assignments: results, forcedMine, forcedSafe }
}

export function enumerateComponent(
  componentCells: string[],
  constraints: readonly RawConstraint[],
): ComponentAssignment[] {
  return enumerateComponentFull(componentCells, constraints).assignments
}

// --- Component cache ---

export interface ComponentCacheEntry {
  readonly enumeration: ComponentEnumeration
  readonly explanations?: ReadonlyMap<string, FrontierExplanation>
}

export type ComponentCache = ReadonlyMap<string, ComponentCacheEntry>

/**
 * Canonical signature of a component's constraint structure - clue cells, required-mine counts,
 * member cells - plus the flagged subset of its cells. Equal signature guarantees equal cached
 * output: this is exactly the input `enumerateComponentFull`/`computeExplanationForCell` are a pure
 * function of.
 */
export function componentSignature(
  componentCells: readonly string[],
  relevantConstraints: readonly RawConstraint[],
  flaggedCells: ReadonlySet<string>,
): string {
  const constraintPart = relevantConstraints
    .map((c) => `${c.key}:${c.requiredMines}:${[...c.cells].sort().join(',')}`)
    .sort()
    .join(';')
  const flagPart = componentCells
    .filter((k) => flaggedCells.has(k))
    .sort()
    .join(',')
  return `${constraintPart}|flags=${flagPart}`
}

/** Test-only view of a frontier component's canonical cache signature. */
export function computeComponentSignature(
  board: SolverBoard,
  componentCells: readonly Coord[],
  flaggedCells: ReadonlySet<string> = new Set(),
): string {
  const constraints = buildConstraints(board)
  const cells = componentCells.map((c) => key(c.row, c.col))
  const cellSet = new Set(cells)
  const relevantConstraints = constraints.filter((c) => c.cells.some((k) => cellSet.has(k)))
  return componentSignature(cells, relevantConstraints, flaggedCells)
}
