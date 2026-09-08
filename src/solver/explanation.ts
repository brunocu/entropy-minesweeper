// --- Certainty explanations ---
// Given a certain (p=0/p=1) frontier cell, find a minimal subset of the constraints
// (revealed numbered cells) that alone reproduce that certainty, via insertion-based
// ("grow") search followed by deletion-based ("trim") minimization.

import { applyTrivialDeduction, type Decomposition, type RawConstraint } from './decomposition.ts'
import {
  componentSignature,
  enumerateComponent,
  enumerateComponentFull,
  type ComponentCache,
  type ComponentCacheEntry,
} from './componentEnumeration.ts'
import {
  incrementEnumerationCallCount,
  incrementGrowTrimCallCount,
  incrementSubsetKeyCallCount,
} from './instrumentation.ts'
import { key, type Coord, type FrontierCellResult, type SolveResult } from './types.ts'

/**
 * Everything the per-certain-cell search needs from the component it is explaining, built
 * once per component per `computeExplanations` call instead of once per certain cell.
 *
 * Handing the pipeline `constraints` - this component's clues, not the whole board's - is what
 * makes `frontier-solver`'s "explanation is drawn from that cell's frontier-component" scoping
 * structural: the clues that must not appear are not in scope to appear. It is also
 * layer-identical to passing the whole board, since every constraint's cells lie wholly inside
 * one component, so a BFS over the "clues share a frontier cell" relation can never leave it.
 */
export interface ComponentIndex {
  /** This component's clues. */
  readonly constraints: readonly RawConstraint[]
  /** cellKey -> the clues referencing it. The on-demand replacement for a materialized adjacency. */
  readonly cluesByCell: Map<string, string[]>
  readonly constraintByKey: Map<string, RawConstraint>
  /** Dense id per clue, assigned in `constraints` order. The subset-key alphabet. */
  readonly idByClueKey: Map<string, number>
  readonly flagGivens: FlagGivens
  /** `flagGivens` serialized once, prefixed onto every subset key in this component. */
  readonly givensPrefix: string
  /** This component's subset-verdict cache. */
  readonly cache: SubsetVerdictCache
}

/**
 * The cache is a parameter so a test can share one across calls, but it belongs to the index
 * rather than to the caller - a cache reached through the index cannot be handed a subset from
 * another component by accident, which is what makes `flagGivens` constant within it and so
 * hoistable into `givensPrefix`.
 */
export function buildComponentIndex(
  constraints: readonly RawConstraint[],
  flagGivens: FlagGivens,
  cache: SubsetVerdictCache = new Map(),
): ComponentIndex {
  const cluesByCell = new Map<string, string[]>()
  const constraintByKey = new Map<string, RawConstraint>()
  const idByClueKey = new Map<string, number>()
  for (const c of constraints) {
    constraintByKey.set(c.key, c)
    idByClueKey.set(c.key, idByClueKey.size)
    for (const cellKey of c.cells) {
      const arr = cluesByCell.get(cellKey)
      if (arr) arr.push(c.key)
      else cluesByCell.set(cellKey, [c.key])
    }
  }
  const minePart = [...flagGivens.forcedMine].sort().join(',')
  const safePart = [...flagGivens.forcedSafe].sort().join(',')
  return {
    constraints,
    cluesByCell,
    constraintByKey,
    idByClueKey,
    flagGivens,
    givensPrefix: `mine=${minePart}|safe=${safePart}`,
    cache,
  }
}

/**
 * The clues sharing a frontier cell with `clue`, derived from `cluesByCell` on demand. Only
 * the clues a walk actually reaches are ever expanded, where the adjacency map this replaces paid
 * an `O(sum of deg^2)` pairwise closure over the whole component whether it was consumed or not.
 */
export function neighboursOf(index: ComponentIndex, clue: RawConstraint): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const cellKey of clue.cells) {
    for (const neighbour of index.cluesByCell.get(cellKey) ?? []) {
      if (neighbour !== clue.key && !seen.has(neighbour)) {
        seen.add(neighbour)
        out.push(neighbour)
      }
    }
  }
  return out
}

/**
 * BFS layers of constraints outward from a given frontier cell: layer 1 is every
 * constraint touching the cell directly, layer 2 shares a frontier cell with layer 1, etc.
 * Same-distance constraints land in one layer (sorted by key for determinism), never
 * split by a per-cell tie-break.
 *
 * Yields one layer per pull rather than walking the component to exhaustion, because
 * `growSufficientSet` stops as soon as the accumulated set resolves the cell - typically at layer
 * 1 or 2 - and every layer built past that was thrown away. Abandoning the generator mid-walk
 * leaves the rest of the component unexpanded. Seeding, the same-distance-one-layer rule, and the
 * per-layer sort are preserved verbatim, which is what keeps layer contents (and so grow order,
 * QuickXplain's split order, and the final explanation) identical.
 */
export function* walkClueLayers(index: ComponentIndex, xKey: string): Generator<RawConstraint[]> {
  const visited = new Set<string>()
  let layerKeys = [...new Set(index.constraints.filter((c) => c.cells.includes(xKey)).map((c) => c.key))].sort()

  while (layerKeys.length > 0) {
    for (const k of layerKeys) visited.add(k)
    yield layerKeys.map((k) => index.constraintByKey.get(k)!)

    const next = new Set<string>()
    for (const k of layerKeys) {
      for (const neighbourKey of neighboursOf(index, index.constraintByKey.get(k)!)) {
        if (!visited.has(neighbourKey)) next.add(neighbourKey)
      }
    }
    layerKeys = [...next].sort()
  }
}

/** A component's flagged cells that are also independently, globally forced. */
export interface FlagGivens {
  readonly forcedSafe: ReadonlySet<string>
  readonly forcedMine: ReadonlySet<string>
}

// --- Subset verdict cache ---
// The oracle's work depends only on the candidate constraint subset and `flagGivens`, never on
// which cell is asking - so cache each distinct subset's *full* forced-status result and let any
// later query (from this cell's own grow/trim search or a different cell's) read its answer off it.

export interface SubsetVerdict {
  readonly forcedMine: ReadonlySet<string>
  readonly forcedSafe: ReadonlySet<string>
}

/**
 * One subset's cached verdicts, kept as two tiers so the exponential half stays lazy: a query
 * Tier-0 already answers must never pay for enumeration just to fill the cache for other cells.
 */
export interface SubsetCacheEntry {
  /** Tier-0 fixpoint over the subset, seeded with `flagGivens`. */
  readonly tier0: SubsetVerdict
  /** Backtracking-derived verdict, unseeded by flags; computed on first demand only. */
  enumerated?: SubsetVerdict
}

export type SubsetVerdictCache = Map<string, SubsetCacheEntry>

/**
 * Canonical key of a candidate subset within its component: its clues' ids, sorted, behind the
 * component's once-serialized givens prefix. Equal key guarantees equal verdict, since within one
 * `computeExplanations` call `buildConstraints` emits at most one constraint per numbered cell -
 * so a clue's id pins down its `key`, `cells`, and `requiredMines` completely, and re-hashing that
 * content per query would only re-derive what the id already fixes.
 */
export function subsetKey(index: ComponentIndex, constraints: readonly RawConstraint[]): string {
  incrementSubsetKeyCallCount()
  const ids = constraints.map((c) => index.idByClueKey.get(c.key)!)
  ids.sort((a, b) => a - b)
  return `${index.givensPrefix}|${ids.join(',')}`
}

/**
 * The subset's Tier-0 verdict, memoized per subset in the component's own cache.
 * `growTrimCallCount` increments here and only here: a miss is exactly one genuine
 * (re)computation of a grow/trim search step.
 */
export function resolveSubset(index: ComponentIndex, constraints: readonly RawConstraint[]): SubsetCacheEntry {
  const cacheKey = subsetKey(index, constraints)
  const cached = index.cache.get(cacheKey)
  if (cached) return cached

  incrementGrowTrimCallCount()
  const { forcedSafe, forcedMine } = applyTrivialDeduction(
    constraints,
    index.flagGivens.forcedSafe,
    index.flagGivens.forcedMine,
  )
  const entry: SubsetCacheEntry = { tier0: { forcedMine, forcedSafe } }
  index.cache.set(cacheKey, entry)
  return entry
}

/**
 * The subset's backtracking verdict, derived for *every* cell in the subset at once from
 * assignment agreement - that is what lets a later query about a different cell be a cache hit.
 */
export function resolveSubsetByEnumeration(
  entry: SubsetCacheEntry,
  constraints: readonly RawConstraint[],
): SubsetVerdict {
  if (entry.enumerated) return entry.enumerated

  const componentCells = [...new Set(constraints.flatMap((c) => c.cells))]
  const assignments = enumerateComponent(componentCells, constraints)
  const forcedMine = new Set<string>()
  const forcedSafe = new Set<string>()
  if (assignments.length > 0) {
    for (const cellKey of componentCells) {
      if (assignments.every((a) => a.assignment.get(cellKey) === 1)) forcedMine.add(cellKey)
      else if (assignments.every((a) => a.assignment.get(cellKey) === 0)) forcedSafe.add(cellKey)
    }
  }
  entry.enumerated = { forcedMine, forcedSafe }
  return entry.enumerated
}

export function verdictHas(verdict: SubsetVerdict, xKey: string, targetValue: 0 | 1): boolean {
  return targetValue === 1 ? verdict.forcedMine.has(xKey) : verdict.forcedSafe.has(xKey)
}

/**
 * Whether `constraints` alone force `xKey` to `targetValue`, via Tier-0 first (seeded with
 * `flagGivens`), exact backtracking as fallback (unseeded - the flag shortcut only applies to
 * the Tier-0 pass).
 */
export function resolvesTo(
  index: ComponentIndex,
  constraints: readonly RawConstraint[],
  xKey: string,
  targetValue: 0 | 1,
): boolean {
  const entry = resolveSubset(index, constraints)
  if (verdictHas(entry.tier0, xKey, targetValue)) return true
  return verdictHas(resolveSubsetByEnumeration(entry, constraints), xKey, targetValue)
}

/**
 * Grow phase: add BFS layers one at a time until the accumulated set resolves `xKey`.
 *
 * Returns `null` when the layers drain without ever resolving it - QuickXplain's "no p-set" case
 * (Junker 2004, Alg. 1 line 1), which here means the cell is certain for a reason outside its
 * component's clues, namely the board's global mine budget. Draining the layers is exactly the
 * `p(A u B) = 0` test that case is defined by, since the last candidate is the whole component.
 */
export function growSufficientSet(
  index: ComponentIndex,
  xKey: string,
  targetValue: 0 | 1,
  layers: Iterable<readonly RawConstraint[]>,
): RawConstraint[] | null {
  let candidate: RawConstraint[] = []
  for (const layer of layers) {
    candidate = [...candidate, ...layer]
    if (resolvesTo(index, candidate, xKey, targetValue)) return candidate
  }
  return null
}

/**
 * Trim phase: QuickXplain's divide-and-conquer minimization - procedure QX' of Alg. 1 in
 * Rodler, "Understanding the QuickXPlain Algorithm" (arXiv:2001.01835), itself Junker 2004.
 * Adapted to our "sufficiency" polarity: `p(S)` = "S forces the cell", which is the monotone
 * property the proof requires, since a superset of a sufficient set can only ever gain information.
 *
 * Returns an irreducible subset of `candidates` that, together with `background`, still satisfies
 * `p`. Callers must only pass a `candidates` set already known sufficient - `growSufficientSet`
 * returning non-`null` is that guarantee - since the paper places the `p(A u B) = 0` check in QX,
 * above QX', and QX' has no way to signal it.
 *
 * `p` is a parameter, not a closed-over `resolvesTo` call, for the reason the paper gives for its
 * own formulation (Sec. 1, criterion (i)): the predicate is a black box taking a subset and
 * returning a bit, nothing more. That keeps the algorithm free of anything minesweeper-specific
 * and lets `quickXplainPaper.test.ts` drive this exact function with the paper's own worked
 * example instead of a re-implementation of it.
 */
export function quickXplain<T>(
  p: (subset: readonly T[]) => boolean,
  background: readonly T[],
  candidates: readonly T[],
): T[] {
  if (candidates.length === 0) return []
  if (p(background)) return []
  if (candidates.length === 1) return [...candidates]

  const mid = Math.ceil(candidates.length / 2)
  const first = candidates.slice(0, mid)
  const second = candidates.slice(mid)
  const delta2 = quickXplain(p, [...background, ...first], second)
  const delta1 = quickXplain(p, [...background, ...delta2], first)
  return [...delta1, ...delta2]
}

/** 2.3 Premise cells: unrevealed cells whose own forced status the trimmed set relies on, excluding `xKey` itself. */
export function extractPremiseKeys(
  index: ComponentIndex,
  trimmed: readonly RawConstraint[],
  xKey: string,
): string[] {
  // `trimmed` is the subset `quickXplain` just worked over, so this is normally a cache hit -
  // a map lookup in place of a second full Tier-0 fixpoint pass.
  const { forcedSafe, forcedMine } = resolveSubset(index, trimmed).tier0
  // A flag-seeded fact is only a genuine premise of this explanation when it's actually a
  // neighbor referenced by one of S's own constraints - otherwise seeding could surface an
  // unrelated (if real) forced cell from elsewhere in the component.
  const cellsInS = new Set(trimmed.flatMap((c) => c.cells))
  return [...new Set([...forcedSafe, ...forcedMine])].filter((k) => k !== xKey && cellsInS.has(k))
}

export interface CellExplanation {
  readonly clueKeys: readonly string[]
  readonly premiseKeys: readonly string[]
}

const NO_EXPLANATION: CellExplanation = { clueKeys: [], premiseKeys: [] }

/**
 * Runs the grow-then-trim search for a single certain frontier cell, reporting the
 * empty explanation when the component's clues do not force the cell at all.
 */
export function computeExplanationForCell(
  index: ComponentIndex,
  xKey: string,
  targetValue: 0 | 1,
): CellExplanation {
  const grown = growSufficientSet(index, xKey, targetValue, walkClueLayers(index, xKey))
  if (!grown) return NO_EXPLANATION
  const trimmed = quickXplain((subset) => resolvesTo(index, subset, xKey, targetValue), [], grown)
  const premiseKeys = extractPremiseKeys(index, trimmed, xKey)
  return { clueKeys: trimmed.map((c) => c.key), premiseKeys }
}

export interface FrontierExplanation extends Coord {
  readonly clueCells: readonly Coord[]
  readonly premiseCells: readonly Coord[]
}

/**
 * Batch-computes the minimal explanation set for every frontier cell whose reported
 * probability is exactly 0 or 1, keyed by cell - run once per solve, not lazily per hover.
 */
export interface ExplanationsWithCache {
  readonly explanations: ReadonlyMap<string, FrontierExplanation>
  readonly cache: ComponentCache
}

export function computeExplanations(
  decomposition: Decomposition,
  solveResult: SolveResult,
  flaggedCells: ReadonlySet<string>,
  previousCache: ComponentCache,
): ExplanationsWithCache {
  const { componentSlices, frontierCoordByKey, numberedCoordByKey } = decomposition

  const certainByKey = new Map<string, FrontierCellResult>()
  for (const f of solveResult.frontier) {
    if (f.probability === 0 || f.probability === 1) certainByKey.set(key(f.row, f.col), f)
  }

  // Per component, reuse a previously-cached enumeration/explanations set when the component's
  // own signature (constraints + flagged subset of its cells) matches. The signature is built
  // here rather than in the shared decomposition because it is the one part of this setup that
  // depends on flags: `solve` signs the same components with the empty flagged set, and both
  // must keep doing so.
  const newCache = new Map<string, ComponentCacheEntry>()
  const result = new Map<string, FrontierExplanation>()

  for (const { cells, relevantConstraints } of componentSlices) {
    const signature = componentSignature(cells, relevantConstraints, flaggedCells)
    const cached = previousCache.get(signature)
    let enumeration = cached?.enumeration
    if (!enumeration) {
      incrementEnumerationCallCount()
      enumeration = enumerateComponentFull(cells, relevantConstraints)
    }

    // The flags corroborated by real (untrimmed) deduction over the component's full
    // constraint set.
    const flagGivens: FlagGivens = {
      forcedMine: new Set([...enumeration.forcedMine].filter((k) => flaggedCells.has(k))),
      forcedSafe: new Set([...enumeration.forcedSafe].filter((k) => flaggedCells.has(k))),
    }

    let explanationsForComponent = cached?.explanations
    if (!explanationsForComponent) {
      // Built once here - clue index and subset-verdict cache both - and shared by
      // every certain cell in this component. Subsets from different components are disjoint, so
      // a per-component cache loses no hit a call-scoped one could have served.
      const index = buildComponentIndex(relevantConstraints, flagGivens)
      const map = new Map<string, FrontierExplanation>()
      for (const xKey of cells) {
        const f = certainByKey.get(xKey)
        if (!f) continue
        const targetValue: 0 | 1 = f.probability === 1 ? 1 : 0
        const { clueKeys, premiseKeys } = computeExplanationForCell(index, xKey, targetValue)
        map.set(xKey, {
          row: f.row,
          col: f.col,
          clueCells: clueKeys.map((k) => numberedCoordByKey.get(k)!),
          premiseCells: premiseKeys.map((k) => frontierCoordByKey.get(k)!),
        })
      }
      explanationsForComponent = map
    }

    newCache.set(signature, { enumeration, explanations: explanationsForComponent })
    for (const [k, v] of explanationsForComponent) result.set(k, v)
  }

  return { explanations: result, cache: newCache }
}
