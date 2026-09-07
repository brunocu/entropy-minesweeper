// Test-only adaptation between board coordinates and the explanation pipeline's internals:
// build a `ComponentIndex` from a board, call the real internal, map the string keys back to
// `Coord`s. These wrappers used to live in the solver's old monolith as `*ForTest` exports; per
// split-solver-modules design.md D3 the adaptation is a test's own business, so it moved here
// while the internals it calls stay exactly the shipped ones.

import { buildConstraints, type RawConstraint } from '../../solver/decomposition.ts'
import { enumerateComponentFull } from '../../solver/componentEnumeration.ts'
import {
  buildComponentIndex,
  computeExplanationForCell,
  growSufficientSet,
  quickXplain,
  resolveSubset,
  resolvesTo,
  subsetKey,
  walkClueLayers,
  type FlagGivens,
  type SubsetVerdictCache,
} from '../../solver/explanation.ts'
import { key, type Coord, type SolverBoard } from '../../solver/types.ts'

const NO_FLAG_GIVENS: FlagGivens = { forcedSafe: new Set(), forcedMine: new Set() }

/** The inverse of the solver's `key()`. No production path parses a key back into a `Coord`. */
export function parseKey(k: string): Coord {
  const [row, col] = k.split(',').map(Number)
  return { row, col }
}

interface FlagGivensInput {
  readonly forcedMine?: readonly string[]
  readonly forcedSafe?: readonly string[]
}

function toFlagGivens(input: FlagGivensInput = {}): FlagGivens {
  return { forcedMine: new Set(input.forcedMine ?? []), forcedSafe: new Set(input.forcedSafe ?? []) }
}

/** The board's constraints for the given clue cells, in the order given. */
function constraintsForClues(board: SolverBoard, clueCells: readonly Coord[]): RawConstraint[] {
  const byKey = new Map(buildConstraints(board).map((c) => [c.key, c]))
  return clueCells.map((c) => byKey.get(key(c.row, c.col))!)
}

/** View of 1.1/1.2's BFS clue layering, exposed the same way computeFrontierComponents is. */
export function computeClueBfsLayers(board: SolverBoard, x: Coord): Coord[][] {
  const index = buildComponentIndex(buildConstraints(board), NO_FLAG_GIVENS)
  const layers = [...walkClueLayers(index, key(x.row, x.col))]
  return layers.map((layer) => layer.map((c) => parseKey(c.key)))
}

/**
 * Probe of D3's laziness: how many layers the walker actually yields before
 * `growSufficientSet` stops pulling. Wraps the real generator in a counting one and runs the real
 * grow phase, so it measures the shipped path rather than a re-implementation of it.
 */
export function countLayersPulledForTest(board: SolverBoard, x: Coord, targetValue: 0 | 1): number {
  const index = buildComponentIndex(buildConstraints(board), NO_FLAG_GIVENS)
  const xKey = key(x.row, x.col)
  let pulled = 0
  function* counting(): Generator<RawConstraint[]> {
    for (const layer of walkClueLayers(index, xKey)) {
      pulled++
      yield layer
    }
  }
  growSufficientSet(index, xKey, targetValue, counting())
  return pulled
}

/**
 * View of a `ComponentIndex`'s `cluesByCell` map (reduce-explanation-setup-overhead
 * D2): the on-demand adjacency's whole substrate, exposed so a hand-checked board can pin it.
 */
export function computeCluesByCellForTest(board: SolverBoard): Map<string, Coord[]> {
  const index = buildComponentIndex(buildConstraints(board), NO_FLAG_GIVENS)
  return new Map([...index.cluesByCell].map(([cellKey, clueKeys]) => [cellKey, clueKeys.map(parseKey)]))
}

/**
 * View of 1.2's BFS layering restricted to one frontier component's own clues, so a
 * test can check design D1's claim - that frontier components *are* the connected components of
 * the clue graph, making the component-scoped walk layer-identical to the whole-board one -
 * rather than the implementation merely assuming it.
 */
export function computeClueBfsLayersForComponent(
  board: SolverBoard,
  componentCells: readonly Coord[],
  x: Coord,
): Coord[][] {
  const constraints = buildConstraints(board)
  const cellSet = new Set(componentCells.map((c) => key(c.row, c.col)))
  const relevantConstraints = constraints.filter((c) => c.cells.some((k) => cellSet.has(k)))
  const index = buildComponentIndex(relevantConstraints, NO_FLAG_GIVENS)
  const layers = [...walkClueLayers(index, key(x.row, x.col))]
  return layers.map((layer) => layer.map((c) => parseKey(c.key)))
}

/**
 * View of a frontier component's real (untrimmed) forced-mine/forced-safe sets
 * (design.md Decision 5, step 1), exposed the same way computeFrontierComponents is.
 */
export function computeComponentForcedSets(
  board: SolverBoard,
  componentCells: readonly Coord[],
): { forcedMine: Coord[]; forcedSafe: Coord[] } {
  const constraints = buildConstraints(board)
  const cells = componentCells.map((c) => key(c.row, c.col))
  const { forcedMine, forcedSafe } = enumerateComponentFull(cells, constraints)
  return {
    forcedMine: [...forcedMine].map(parseKey),
    forcedSafe: [...forcedSafe].map(parseKey),
  }
}

/** Opaque handle to a subset-verdict cache, so a test can share (or not share) one across calls. */
export type SubsetVerdictCacheHandle = SubsetVerdictCache

export function createSubsetVerdictCacheForTest(): SubsetVerdictCacheHandle {
  return new Map()
}

/**
 * A subset key is only meaningful relative to the index whose ids it is drawn from (D4), so this
 * builds one over the whole board's constraints - ids assigned in `buildConstraints` order, hence
 * stable for a given board - and keys the requested subset against it.
 */
export function computeSubsetKeyForTest(
  board: SolverBoard,
  clueCells: readonly Coord[],
  flagGivens?: FlagGivensInput,
): string {
  const index = buildComponentIndex(buildConstraints(board), toFlagGivens(flagGivens))
  return subsetKey(index, constraintsForClues(board, clueCells))
}

export function resolveSubsetForTest(
  cache: SubsetVerdictCacheHandle,
  board: SolverBoard,
  clueCells: readonly Coord[],
  flagGivens?: FlagGivensInput,
): { forcedMine: Coord[]; forcedSafe: Coord[] } {
  const index = buildComponentIndex(buildConstraints(board), toFlagGivens(flagGivens), cache)
  const { tier0 } = resolveSubset(index, constraintsForClues(board, clueCells))
  return { forcedMine: [...tier0.forcedMine].map(parseKey), forcedSafe: [...tier0.forcedSafe].map(parseKey) }
}

export function quickXplainForTest(
  cache: SubsetVerdictCacheHandle,
  board: SolverBoard,
  background: readonly Coord[],
  candidates: readonly Coord[],
  x: Coord,
  targetValue: 0 | 1,
  flagGivens?: FlagGivensInput,
): Coord[] {
  const index = buildComponentIndex(buildConstraints(board), toFlagGivens(flagGivens), cache)
  const xKey = key(x.row, x.col)
  const trimmed = quickXplain(
    (subset) => resolvesTo(index, subset, xKey, targetValue),
    constraintsForClues(board, background),
    constraintsForClues(board, candidates),
  )
  return trimmed.map((c) => parseKey(c.key))
}

/** One certain cell's grow -> QuickXplain -> premise pipeline, against a caller-supplied cache. */
export function computeCellExplanationForTest(
  cache: SubsetVerdictCacheHandle,
  board: SolverBoard,
  x: Coord,
  targetValue: 0 | 1,
  flagGivens?: FlagGivensInput,
): { clueCells: Coord[]; premiseCells: Coord[] } {
  const { clueKeys, premiseKeys } = computeExplanationForCell(
    buildComponentIndex(buildConstraints(board), toFlagGivens(flagGivens), cache),
    key(x.row, x.col),
    targetValue,
  )
  return { clueCells: clueKeys.map(parseKey), premiseCells: premiseKeys.map(parseKey) }
}
