// Exact probabilistic inference over a minesweeper board's frontier.
// See openspec/changes/entropy-minesweeper/specs/frontier-solver/spec.md and design.md.

export interface SolverCell {
  readonly revealed: boolean
  readonly adjacentMines: number
}

export interface SolverBoard {
  readonly width: number
  readonly height: number
  readonly mineCount: number
  readonly cells: readonly (readonly SolverCell[])[]
}

export interface Coord {
  readonly row: number
  readonly col: number
}

export type CellOutcome = { readonly type: 'mine' } | { readonly type: 'safe'; readonly adjacentMines: number }

export interface FrontierCellResult extends Coord {
  readonly probability: number
  readonly eig: number
  readonly outcomeProbabilities: ReadonlyMap<string, number>
}

export interface SolveResult {
  readonly frontier: readonly FrontierCellResult[]
  readonly nonFrontierProbability: number | null
  readonly nonFrontierCells: readonly Coord[]
  readonly totalEntropyBits: number
}

function key(row: number, col: number): string {
  return `${row},${col}`
}

function isNumbered(cell: SolverCell): boolean {
  return cell.revealed && cell.adjacentMines > 0
}

function neighbors(board: SolverBoard, row: number, col: number): Coord[] {
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

interface RawConstraint {
  /** Coordinate key of the revealed numbered cell this constraint comes from. */
  readonly key: string
  readonly cells: string[]
  readonly requiredMines: number
}

function buildConstraints(board: SolverBoard): RawConstraint[] {
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
function applyTrivialDeduction(
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
function computeComponents(frontierKeys: string[], constraints: readonly RawConstraint[]): Map<string, string[]> {
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

interface ComponentAssignment {
  readonly assignment: ReadonlyMap<string, 0 | 1>
  readonly mineCount: number
}

interface ReducedConstraint {
  readonly cells: string[]
  readonly required: number
}

function isPartiallyConsistent(assignment: Map<string, 0 | 1>, reduced: readonly ReducedConstraint[]): boolean {
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

interface ComponentEnumeration {
  readonly assignments: ComponentAssignment[]
  readonly forcedMine: ReadonlySet<string>
  readonly forcedSafe: ReadonlySet<string>
}

/**
 * Test-only call-count probes (cache-frontier-explanations-by-component tasks 2.4/3.2/3.3).
 * `enumerationCallCount` counts a component's full (exponential-in-component-size) enumeration
 * being (re)computed from scratch - incremented at `solve`'s and `computeExplanations`'s
 * top-level per-component cache-miss call sites, not inside `enumerateComponentFull` itself, so
 * it doesn't also count `resolvesTo`'s much smaller per-subset backtracking runs during grow/trim.
 * `growTrimCallCount` counts those grow/trim searches instead, via `resolvesTo`.
 */
let enumerationCallCount = 0
export function resetEnumerationCallCountForTest(): void {
  enumerationCallCount = 0
}
export function getEnumerationCallCountForTest(): number {
  return enumerationCallCount
}

let growTrimCallCount = 0
export function resetGrowTrimCallCountForTest(): void {
  growTrimCallCount = 0
}
export function getGrowTrimCallCountForTest(): number {
  return growTrimCallCount
}

/**
 * 3.4 Per-component exact backtracking enumeration, with Tier 0 pre-applied. Also exposes
 * the component's real (untrimmed) forced-mine/forced-safe sets (design.md Decision 5, step 1)
 * instead of discarding them, so they can be intersected with flagged cells elsewhere.
 */
function enumerateComponentFull(componentCells: string[], constraints: readonly RawConstraint[]): ComponentEnumeration {
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

function enumerateComponent(componentCells: string[], constraints: readonly RawConstraint[]): ComponentAssignment[] {
  return enumerateComponentFull(componentCells, constraints).assignments
}

// --- Component cache (cache-frontier-explanations-by-component) ---
// See openspec/changes/cache-frontier-explanations-by-component/design.md decisions 1-4.

export interface ComponentCacheEntry {
  readonly enumeration: ComponentEnumeration
  readonly explanations?: ReadonlyMap<string, FrontierExplanation>
}

export type ComponentCache = ReadonlyMap<string, ComponentCacheEntry>

/**
 * design.md Decision D1: canonical signature of a component's own constraint structure
 * (clue cells, required-mine counts, member cells) plus the flagged subset of its cells.
 * Equal signature guarantees equal cached output by construction, since this is exactly
 * the input `enumerateComponentFull`/`computeExplanationForCell` are a pure function of.
 */
function componentSignature(
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

/** Test-only view of a frontier component's canonical cache signature (design.md Decision D1). */
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

// --- Certainty explanations (frontier-certainty-explanation) ---
// Given a certain (p=0/p=1) frontier cell, find a minimal subset of the constraints
// (revealed numbered cells) that alone reproduce that certainty, via insertion-based
// ("grow") search followed by deletion-based ("trim") minimization - see design.md
// decisions 1-4 of openspec/changes/frontier-certainty-explanation.

/** 1.1 Clue-adjacency: two constraints are adjacent when they share a frontier cell. */
function buildClueAdjacency(constraints: readonly RawConstraint[]): Map<string, string[]> {
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
  const result = new Map<string, string[]>()
  for (const [k, v] of adjacency) result.set(k, [...v])
  return result
}

/**
 * 1.2 BFS layers of constraints outward from a given frontier cell: layer 1 is every
 * constraint touching the cell directly, layer 2 shares a frontier cell with layer 1, etc.
 * Same-distance constraints land in one layer (sorted by key for determinism), never
 * split by a per-cell tie-break.
 */
function computeBfsLayers(xKey: string, constraints: readonly RawConstraint[]): RawConstraint[][] {
  const adjacency = buildClueAdjacency(constraints)
  const byKey = new Map(constraints.map((c) => [c.key, c]))
  const visited = new Set<string>()
  const layers: RawConstraint[][] = []

  let layerKeys = constraints.filter((c) => c.cells.includes(xKey)).map((c) => c.key)
  layerKeys = [...new Set(layerKeys)].sort()

  while (layerKeys.length > 0) {
    for (const k of layerKeys) visited.add(k)
    layers.push(layerKeys.map((k) => byKey.get(k)!))

    const next = new Set<string>()
    for (const k of layerKeys) {
      for (const neighborKey of adjacency.get(k) ?? []) {
        if (!visited.has(neighborKey)) next.add(neighborKey)
      }
    }
    layerKeys = [...next].sort()
  }

  return layers
}

/** design.md Decision 5: a component's flagged cells that are also independently, globally forced. */
interface FlagGivens {
  readonly forcedSafe: ReadonlySet<string>
  readonly forcedMine: ReadonlySet<string>
}

const NO_FLAG_GIVENS: FlagGivens = { forcedSafe: new Set(), forcedMine: new Set() }

/**
 * Whether `constraints` alone force `xKey` to `targetValue`, via Tier-0 first (seeded with
 * `flagGivens`, design.md Decision 5 step 3), exact backtracking as fallback (unseeded -
 * the flag shortcut only applies to the Tier-0 pass, per Decision 5).
 */
function resolvesTo(
  constraints: readonly RawConstraint[],
  xKey: string,
  targetValue: 0 | 1,
  flagGivens: FlagGivens = NO_FLAG_GIVENS,
): boolean {
  growTrimCallCount++
  const { forcedSafe, forcedMine } = applyTrivialDeduction(constraints, flagGivens.forcedSafe, flagGivens.forcedMine)
  if (targetValue === 1 && forcedMine.has(xKey)) return true
  if (targetValue === 0 && forcedSafe.has(xKey)) return true

  const componentCells = [...new Set(constraints.flatMap((c) => c.cells))]
  if (!componentCells.includes(xKey)) return false
  const assignments = enumerateComponent(componentCells, constraints)
  if (assignments.length === 0) return false
  return assignments.every((a) => a.assignment.get(xKey) === targetValue)
}

/** 2.1 Grow phase: add BFS layers one at a time until the accumulated set resolves `xKey`. */
function growSufficientSet(
  xKey: string,
  targetValue: 0 | 1,
  layers: readonly RawConstraint[][],
  flagGivens: FlagGivens = NO_FLAG_GIVENS,
): RawConstraint[] {
  let candidate: RawConstraint[] = []
  for (const layer of layers) {
    candidate = [...candidate, ...layer]
    if (resolvesTo(candidate, xKey, targetValue, flagGivens)) return candidate
  }
  return candidate
}

/** 2.2 Trim phase: deletion-based minimization in a fixed order (grow order), dropping redundant members. */
function trimToMinimal(
  candidate: readonly RawConstraint[],
  xKey: string,
  targetValue: 0 | 1,
  flagGivens: FlagGivens = NO_FLAG_GIVENS,
): RawConstraint[] {
  let current = [...candidate]
  for (const c of candidate) {
    if (!current.some((cc) => cc.key === c.key)) continue
    const without = current.filter((cc) => cc.key !== c.key)
    if (resolvesTo(without, xKey, targetValue, flagGivens)) current = without
  }
  return current
}

function parseKey(k: string): Coord {
  const [row, col] = k.split(',').map(Number)
  return { row, col }
}

/** Test-only view of 1.1/1.2's BFS clue layering, exposed the same way computeFrontierComponents is. */
export function computeClueBfsLayers(board: SolverBoard, x: Coord): Coord[][] {
  const constraints = buildConstraints(board)
  const layers = computeBfsLayers(key(x.row, x.col), constraints)
  return layers.map((layer) => layer.map((c) => parseKey(c.key)))
}

/**
 * Test-only view of a frontier component's real (untrimmed) forced-mine/forced-safe sets
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

/** 2.3 Premise cells: unrevealed cells whose own forced status the trimmed set relies on, excluding `xKey` itself. */
function extractPremiseKeys(
  trimmed: readonly RawConstraint[],
  xKey: string,
  flagGivens: FlagGivens = NO_FLAG_GIVENS,
): string[] {
  const { forcedSafe, forcedMine } = applyTrivialDeduction(trimmed, flagGivens.forcedSafe, flagGivens.forcedMine)
  // A flag-seeded fact is only a genuine premise of this explanation when it's actually a
  // neighbor referenced by one of S's own constraints - otherwise seeding could surface an
  // unrelated (if real) forced cell from elsewhere in the component. See design.md Decision 4.
  const cellsInS = new Set(trimmed.flatMap((c) => c.cells))
  return [...new Set([...forcedSafe, ...forcedMine])].filter((k) => k !== xKey && cellsInS.has(k))
}

interface CellExplanation {
  readonly clueKeys: readonly string[]
  readonly premiseKeys: readonly string[]
}

/** Runs the grow-then-trim search (2.1-2.3) for a single certain frontier cell. */
function computeExplanationForCell(
  xKey: string,
  targetValue: 0 | 1,
  constraints: readonly RawConstraint[],
  flagGivens: FlagGivens = NO_FLAG_GIVENS,
): CellExplanation {
  const layers = computeBfsLayers(xKey, constraints)
  const grown = growSufficientSet(xKey, targetValue, layers, flagGivens)
  const trimmed = trimToMinimal(grown, xKey, targetValue, flagGivens)
  const premiseKeys = extractPremiseKeys(trimmed, xKey, flagGivens)
  return { clueKeys: trimmed.map((c) => c.key), premiseKeys }
}

export interface FrontierExplanation extends Coord {
  readonly clueCells: readonly Coord[]
  readonly premiseCells: readonly Coord[]
}

/**
 * 3.1 Batch-computes the minimal explanation set for every frontier cell whose reported
 * probability is exactly 0 or 1, keyed by cell (design.md decision 3: run once per solve,
 * not lazily per hover).
 */
export interface ExplanationsWithCache {
  readonly explanations: ReadonlyMap<string, FrontierExplanation>
  readonly cache: ComponentCache
}

export function computeExplanations(
  board: SolverBoard,
  solveResult: SolveResult,
  flaggedCells: ReadonlySet<string>,
  previousCache: ComponentCache,
): ExplanationsWithCache {
  const constraints = buildConstraints(board)

  const frontierCoords = identifyFrontier(board)
  const frontierCoordByKey = new Map(frontierCoords.map((c) => [key(c.row, c.col), c]))
  const frontierKeys = frontierCoords.map((c) => key(c.row, c.col))

  const numberedCoordByKey = new Map<string, Coord>()
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      const cell = board.cells[row][col]
      if (isNumbered(cell)) numberedCoordByKey.set(key(row, col), { row, col })
    }
  }

  const certainByKey = new Map<string, FrontierCellResult>()
  for (const f of solveResult.frontier) {
    if (f.probability === 0 || f.probability === 1) certainByKey.set(key(f.row, f.col), f)
  }

  // design.md Decisions D1/D3: per component, reuse a previously-cached enumeration/explanations
  // set when the component's own signature (constraints + flagged subset of its cells) matches.
  const components = computeComponents(frontierKeys, constraints)
  const newCache = new Map<string, ComponentCacheEntry>()
  const result = new Map<string, FrontierExplanation>()

  for (const cells of components.values()) {
    const cellSet = new Set(cells)
    const relevantConstraints = constraints.filter((c) => c.cells.some((k) => cellSet.has(k)))
    const signature = componentSignature(cells, relevantConstraints, flaggedCells)
    const cached = previousCache.get(signature)
    let enumeration = cached?.enumeration
    if (!enumeration) {
      enumerationCallCount++
      enumeration = enumerateComponentFull(cells, constraints)
    }

    // design.md Decision 5, steps 1-2: the flags corroborated by real (untrimmed) deduction
    // over the component's full constraint set.
    const flagGivens: FlagGivens = {
      forcedMine: new Set([...enumeration.forcedMine].filter((k) => flaggedCells.has(k))),
      forcedSafe: new Set([...enumeration.forcedSafe].filter((k) => flaggedCells.has(k))),
    }

    let explanationsForComponent = cached?.explanations
    if (!explanationsForComponent) {
      const map = new Map<string, FrontierExplanation>()
      for (const xKey of cells) {
        const f = certainByKey.get(xKey)
        if (!f) continue
        const targetValue: 0 | 1 = f.probability === 1 ? 1 : 0
        const { clueKeys, premiseKeys } = computeExplanationForCell(xKey, targetValue, constraints, flagGivens)
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

function cartesianProduct<T>(arrays: readonly T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, arr) => acc.flatMap((prefix) => arr.map((item) => [...prefix, item])), [[]])
}

/** C(n, k), computed iteratively as a float to stay numerically stable for large n. */
function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  const kk = Math.min(k, n - k)
  let result = 1
  for (let i = 0; i < kk; i++) {
    result = (result * (n - i)) / (i + 1)
  }
  return result
}

function shannonEntropy(weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return 0
  let h = 0
  for (const w of weights) {
    if (w <= 0) continue
    const p = w / total
    h -= p * Math.log2(p)
  }
  return h
}

export function outcomeKey(outcome: CellOutcome): string {
  return outcome.type === 'mine' ? 'mine' : `safe:${outcome.adjacentMines}`
}

interface ComboData {
  readonly weight: number
  readonly remaining: number
  readonly fullAssignment: ReadonlyMap<string, 0 | 1>
}

interface NeighborInfo {
  readonly frontierNeighborKeys: string[]
  readonly shadowNeighborCount: number
}

function computeNeighborInfo(board: SolverBoard, x: Coord, frontierSet: ReadonlySet<string>): NeighborInfo {
  let shadowNeighborCount = 0
  const frontierNeighborKeys: string[] = []
  for (const n of neighbors(board, x.row, x.col)) {
    const cell = board.cells[n.row][n.col]
    if (cell.revealed) continue
    const k = key(n.row, n.col)
    if (frontierSet.has(k)) {
      frontierNeighborKeys.push(k)
    } else {
      shadowNeighborCount++
    }
  }
  return { frontierNeighborKeys, shadowNeighborCount }
}

/**
 * 3.7/3.8 EIG and outcome distribution for one frontier cell.
 *
 * A frontier cell can have unrevealed neighbors that are themselves non-frontier
 * (not adjacent to any revealed number yet). Their mine/safe status still affects
 * what number this cell will show once revealed, so rather than tracking them
 * individually (which would force merging otherwise-independent components), their
 * contribution is folded in exactly via the hypergeometric distribution already
 * implied by "R remaining mines spread uniformly across K non-frontier cells" -
 * this cell's shadow neighbors are just a known subset of those K cells.
 */
function computeFrontierCellResult(
  x: Coord,
  xKey: string,
  info: NeighborInfo,
  combosData: readonly ComboData[],
  K: number,
  probabilityOf: (k: string) => number,
): FrontierCellResult {
  const entries: { outcome: string; weight: number }[] = []

  for (const combo of combosData) {
    const xValue = combo.fullAssignment.get(xKey)
    if (xValue === 1) {
      entries.push({ outcome: 'mine', weight: combo.weight })
      continue
    }
    const knownCount = info.frontierNeighborKeys.reduce(
      (sum, nk) => sum + (combo.fullAssignment.get(nk) === 1 ? 1 : 0),
      0,
    )
    const sx = info.shadowNeighborCount
    const maxJ = Math.min(sx, combo.remaining)
    for (let j = 0; j <= maxJ; j++) {
      const w = binomial(sx, j) * binomial(K - sx, combo.remaining - j)
      if (w > 0) entries.push({ outcome: `safe:${knownCount + j}`, weight: w })
    }
  }

  const totalWeight = entries.reduce((s, e) => s + e.weight, 0)
  const groupWeights = new Map<string, number>()
  for (const e of entries) groupWeights.set(e.outcome, (groupWeights.get(e.outcome) ?? 0) + e.weight)

  const outcomeProbabilities = new Map<string, number>()
  for (const [outcome, w] of groupWeights) {
    outcomeProbabilities.set(outcome, totalWeight > 0 ? w / totalWeight : 0)
  }

  const hFull = shannonEntropy(entries.map((e) => e.weight))
  let expectedConditional = 0
  for (const [outcome, groupWeight] of groupWeights) {
    const groupEntryWeights = entries.filter((e) => e.outcome === outcome).map((e) => e.weight)
    const hGroup = shannonEntropy(groupEntryWeights)
    const pOutcome = totalWeight > 0 ? groupWeight / totalWeight : 0
    expectedConditional += pOutcome * hGroup
  }
  const eig = hFull - expectedConditional

  return {
    row: x.row,
    col: x.col,
    probability: probabilityOf(xKey),
    eig,
    outcomeProbabilities,
  }
}

const EMPTY_FLAGGED_CELLS: ReadonlySet<string> = new Set()

export interface SolveWithCache {
  readonly result: SolveResult
  readonly cache: ComponentCache
}

interface WorldEnumeration {
  readonly frontierCoords: readonly Coord[]
  readonly frontierKeys: readonly string[]
  readonly frontierSet: ReadonlySet<string>
  readonly nonFrontierCells: readonly Coord[]
  /** One entry per surviving combination of component assignments, with its mine-count weight. */
  readonly combosData: readonly ComboData[]
  /** Total (unnormalized) weight across `combosData`. */
  readonly Z: number
  readonly sumMineWeight: ReadonlyMap<string, number>
  readonly sumNonFrontierWeighted: number
  readonly cache: ComponentCache
}

/**
 * 3.5 The enumeration half of the pipeline: frontier -> components -> worlds, each world
 * weighted by how many ways its leftover mines can fall across the non-frontier cells.
 * `solve` turns this into probabilities/EIG; `enumerateWeightedWorlds` hands it to the
 * explainer verbatim. Both read the same output, so neither can drift from the other.
 */
function enumerateWorlds(board: SolverBoard, previousCache: ComponentCache): WorldEnumeration {
  const frontierCoords = identifyFrontier(board)
  const frontierKeys = frontierCoords.map((c) => key(c.row, c.col))
  const frontierSet = new Set(frontierKeys)

  const constraints = buildConstraints(board)
  const components = computeComponents(frontierKeys, constraints)

  const newCache = new Map<string, ComponentCacheEntry>()
  const componentResultsList = [...components.values()].map((cells) => {
    const cellSet = new Set(cells)
    const relevantConstraints = constraints.filter((c) => c.cells.some((k) => cellSet.has(k)))
    const signature = componentSignature(cells, relevantConstraints, EMPTY_FLAGGED_CELLS)
    const cached = previousCache.get(signature)
    let enumeration = cached?.enumeration
    if (!enumeration) {
      enumerationCallCount++
      enumeration = enumerateComponentFull(cells, constraints)
    }
    newCache.set(signature, { enumeration, explanations: cached?.explanations })
    return enumeration.assignments
  })

  const nonFrontierCells: Coord[] = []
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      const cell = board.cells[row][col]
      if (cell.revealed) continue
      const k = key(row, col)
      if (frontierSet.has(k)) continue
      nonFrontierCells.push({ row, col })
    }
  }
  const K = nonFrontierCells.length
  const remainingMines = board.mineCount

  const combos = cartesianProduct(componentResultsList)

  const sumMineWeight = new Map<string, number>()
  for (const k of frontierKeys) sumMineWeight.set(k, 0)

  let Z = 0
  let sumNonFrontierWeighted = 0
  const combosData: ComboData[] = []

  for (const combo of combos) {
    let M = 0
    const fullAssignment = new Map<string, 0 | 1>()
    for (const compAssignment of combo) {
      M += compAssignment.mineCount
      for (const [k, v] of compAssignment.assignment) fullAssignment.set(k, v)
    }
    const remaining = remainingMines - M
    if (remaining < 0 || remaining > K) continue
    const weight = binomial(K, remaining)
    if (weight <= 0) continue
    Z += weight
    sumNonFrontierWeighted += weight * remaining
    for (const [k, v] of fullAssignment) {
      if (v === 1) sumMineWeight.set(k, (sumMineWeight.get(k) ?? 0) + weight)
    }
    combosData.push({ weight, remaining, fullAssignment })
  }

  return {
    frontierCoords,
    frontierKeys,
    frontierSet,
    nonFrontierCells,
    combosData,
    Z,
    sumMineWeight,
    sumNonFrontierWeighted,
    cache: newCache,
  }
}

/** One enumerated possible world: what every frontier cell is, and how much it weighs. */
export interface WeightedWorld {
  /** 1 (mine) or 0 (safe) for every frontier cell, keyed by the solver's own `row,col` key. */
  readonly assignment: ReadonlyMap<string, 0 | 1>
  /** This world's share of the total probability mass; weights across all worlds sum to 1. */
  readonly weight: number
  /** How many of the board's mines this world leaves for the non-frontier cells. */
  readonly nonFrontierMines: number
}

export interface WeightedWorlds {
  /** Frontier cells in the order the solver enumerated them - the demo's branching order. */
  readonly frontierCells: readonly Coord[]
  readonly worlds: readonly WeightedWorld[]
  readonly nonFrontierCellCount: number
}

/**
 * Demo-oriented view of the solver's internals for the explainer page's worlds-tree
 * illustration (add-explainer-page design.md decision 2). `solve` already enumerates and
 * weights exactly these worlds on its way to per-cell probabilities and EIG, but only reports
 * the aggregates; this returns the underlying list so the illustration can draw the individual
 * worlds instead of recomputing (and eventually mis-computing) them.
 *
 * Deliberately narrow: not part of the solver's gameplay-facing contract, and nothing in the
 * live game calls it.
 */
export function enumerateWeightedWorlds(board: SolverBoard): WeightedWorlds {
  const { frontierCoords, nonFrontierCells, combosData, Z } = enumerateWorlds(board, new Map())
  return {
    frontierCells: frontierCoords,
    nonFrontierCellCount: nonFrontierCells.length,
    worlds: combosData.map((combo) => ({
      assignment: combo.fullAssignment,
      weight: Z > 0 ? combo.weight / Z : 0,
      nonFrontierMines: combo.remaining,
    })),
  }
}

/**
 * 3.5/3.6 Runs the full solver pipeline: frontier -> components -> worlds -> probabilities/EIG.
 *
 * Has no access to flagged cells, so its per-component signature always uses an empty
 * flagged-cell set (design.md D1/D3, entropy-minesweeper) - `enumerateComponentFull`'s result
 * never depends on flags, so this is always safe, only occasionally missing a cache hit that
 * `computeExplanations` (which does know the real flags) could otherwise have supplied within
 * the same pass.
 */
export function solve(board: SolverBoard, previousCache: ComponentCache): SolveWithCache {
  const {
    frontierCoords,
    frontierSet,
    nonFrontierCells,
    combosData,
    Z,
    sumMineWeight,
    sumNonFrontierWeighted,
    cache: newCache,
  } = enumerateWorlds(board, previousCache)
  const K = nonFrontierCells.length

  const probabilityOf = (k: string): number => (Z > 0 ? (sumMineWeight.get(k) ?? 0) / Z : NaN)
  const nonFrontierProbability = K > 0 && Z > 0 ? sumNonFrontierWeighted / (Z * K) : null

  const frontierResults = frontierCoords.map((x) => {
    const xKey = key(x.row, x.col)
    const info = computeNeighborInfo(board, x, frontierSet)
    return computeFrontierCellResult(x, xKey, info, combosData, K, probabilityOf)
  })

  const totalEntropyBits = Z > 0 ? Math.log2(Z) : 0

  return {
    result: { frontier: frontierResults, nonFrontierProbability, nonFrontierCells, totalEntropyBits },
    cache: newCache,
  }
}
