## Context

See proposal.md - Why/What Changes for motivation and scope.

Relevant existing structure (`src/solver/frontierSolver.ts`, `src/game/gameController.ts`):

- `computeComponents` partitions the frontier into connected components via shared numbered-clue neighbors (union-find over `RawConstraint`s). Components are already the natural unit of independence: `computeBaseSolve` enumerates each component separately, and `computeExplanations` builds per-component `flagGivens` and runs grow/trim per certain cell within a component.
- `computeBaseSolve` (used by `solve`) calls `enumerateComponent(cells, constraints)` per component - the trimmed accessor that returns just `ComponentAssignment[]`, discarding `enumerateComponentFull`'s `forcedMine`/`forcedSafe`.
- `computeExplanations` independently calls `enumerateComponentFull(cells, constraints)` per component (to get `forcedMine`/`forcedSafe` for `flagGivensByCell`), then for every frontier cell with probability exactly 0 or 1, runs `computeExplanationForCell` (BFS layers, then grow/trim - each step of which calls `resolvesTo` -> another `enumerateComponent` over a growing subset).
- `GameController.reveal()` calls `solveFn` then `computeExplanations` every settled move; `toggleFlag()` calls only `computeExplanations` (correctly - flagging can't change probabilities, board.ts:110 refuses to reveal a flagged cell so flagging never changes frontier/constraints either).
- `solve(board: SolverBoard): SolveResult` is exported and used beyond `GameController`: `solver.worker.ts` (production), and `revealFeedback.test.ts`, `solverWorker.test.ts`, `informationVisualization.spec.test.ts`, `stateExport.test.ts`. There is exactly one `solve` - no cache-free variant is kept alongside a cache-aware one; every caller adopts the same signature.
- `Solve = (board: Board) => SolveResult` is `gameController.ts`'s own local injection-seam type, distinct from `solve` itself - `gameController.test.ts` stubs it with plain object literals.

## Goals / Non-Goals

**Goals:**
- Skip re-enumerating a frontier component's worlds and re-deriving its certain cells' explanations when nothing about that component (its constraints, or the flagged subset of its cells) has changed since the last call.
- Make `solve()` and `computeExplanations()` share one enumeration per component within a single `reveal()` pass instead of two.
- One `solve` function, one shape - no parallel cache-free/cache-aware pair to keep in sync.
- Preserve exact output: same board state -> same `latestExplanations` contents as today, every time.

**Non-Goals:**
- Lazy, hover-triggered explanation computation - already considered and rejected; explanations stay precomputed for every certain cell per move (design.md Decision 3 of the original `frontier-certainty-explanation` change).
- Changing the grow/trim algorithm, the minimality guarantee, or any other solver semantics.
- Persisting the cache beyond a single `GameController` instance (e.g. across a new game / board resize) - a fresh controller gets a fresh, empty cache.

## Decisions

### D1: Content-addressed component signature, not manual dirty-cell tracking

Cache reuse is keyed by a canonical signature of a component's own constraint structure plus the flagged subset of its cells, not by computing which cells were "touched" by a move:

```
signature(component) =
  sorted [ `${clueKey}:${requiredMines}:${sortedCellKeys.join(',')}` for each constraint touching the component ]
    .join(';')
  + '|flags=' + sorted(flaggedCells ∩ component.cells).join(',')
```

`computeExplanationForCell` (and the enumeration feeding it) is a pure function of exactly that constraint subset plus `flagGivens`, which is itself derived from `flaggedCells ∩ component.cells`. Equal signature therefore guarantees equal output by construction - there's no need to separately reason about which cells a move touched, no risk of an undercounted "dirty" neighborhood silently serving stale data. This was the alternative considered (track revealed cells + their neighbors as "dirty", invalidate components that overlap); it was rejected because getting the dirty-closure exactly right (e.g. remembering that a newly-revealed cell also shrinks its already-numbered neighbors' constraints) is easy to get subtly wrong, whereas comparing the actual constraint content cannot under-invalidate.

### D2: Immutable cache, threaded functionally - not mutated in place

The cache is a `ReadonlyMap<string, ComponentCacheEntry>` (`ComponentCache`). Every function that touches it follows the pattern already used throughout `frontierSolver.ts` (pure functions, no mutation of inputs) and already used by `GameController` itself (`this.latestSolve`/`this.latestExplanations` are wholesale-reassigned each move, never mutated): a function takes the previous cache and returns a *new* cache built from it, and the caller reassigns its reference. Concretely:

```
export interface ComponentCacheEntry {
  readonly enumeration: ComponentEnumeration                       // assignments + forcedMine + forcedSafe
  readonly explanations?: ReadonlyMap<string, FrontierExplanation> // this component's certain-cell explanations, once known
}
export type ComponentCache = ReadonlyMap<string, ComponentCacheEntry>

export interface SolveWithCache {
  readonly result: SolveResult
  readonly cache: ComponentCache
}
export function solve(board: SolverBoard, previousCache: ComponentCache): SolveWithCache

export interface ExplanationsWithCache {
  readonly explanations: ReadonlyMap<string, FrontierExplanation>
  readonly cache: ComponentCache
}
export function computeExplanations(
  board: SolverBoard,
  solveResult: SolveResult,
  flaggedCells: ReadonlySet<string>,
  previousCache: ComponentCache,
): ExplanationsWithCache
```

Both `solve` and `computeExplanations` gain a required `previousCache: ComponentCache` parameter and change their return type to a `{ ..., cache }` pair - there is no cache-free `solve` kept around for convenience. Every existing caller adopts the new shape:

- `solver.worker.ts` keeps one `ComponentCache` per worker (module-level `let`, reassigned from each response's `cache`) and calls `solve(message.board, cache).result` for the message payload.
- `revealFeedback.test.ts`, `solverWorker.test.ts`, `informationVisualization.spec.test.ts`, `stateExport.test.ts` each call `solve(board, new Map()).result` wherever they don't care about cache reuse across calls (all but the "consistent across pre/post reveal" pairs, which naturally still want two independent fresh calls with `new Map()` each, since they're deliberately comparing before/after solves of different boards, not reusing a cache).
- `computeExplanations`'s callers (`GameController` and `frontierSolver.test.ts`) pass a cache and destructure `.explanations`.

This is a real, if mechanical, ripple through every `solve` call site - accepted deliberately, rather than kept as two parallel functions (a cache-free `solve` wrapping a cache-aware `solveWithCache`) purely to avoid touching them.

`GameController`'s local `Solve` injection type changes to match: `export type Solve = (board: Board, cache: ComponentCache) => SolveWithCache`, defaulting to `solve`. `gameController.test.ts`'s stubs return a bare `SolveResult`-shaped object today; they'll be updated to return `{ result: {...}, cache: new Map() }` to match the new return shape (their 0-arg `vi.fn(() => ...)` shape itself still satisfies the 2-parameter type - TS allows a callback with fewer declared parameters to satisfy a type expecting more - so only the *returned value* shape needs updating, not the mock signatures).

### D3: One cache entry serves both consumers

`computeBaseSolve` (inside `solve`) switches from `enumerateComponent` to `enumerateComponentFull` (which already computes everything `enumerateComponent` does, plus the forced sets - `enumerateComponent` is literally `enumerateComponentFull(...).assignments` today, so this is a no-op for the solve pipeline's existing output) and, per component: on a signature hit against `previousCache`, reuses the cached `enumeration` (carrying over any cached `explanations` unchanged into the new cache); on a miss, computes fresh and stores `{ enumeration, explanations: undefined }` in the new cache.

`computeExplanations`, per component, against the cache `solve` just produced: if the entry already has `explanations`, copy it straight into the result (full skip - no enumeration, no grow/trim). If the entry exists but `explanations` is `undefined` (a miss `solve` just filled in, or a component `solve` never touched because `toggleFlag()` doesn't call it), reuse `enumeration` and only run grow/trim for that component's certain cells, producing the entry's `explanations` in the new cache. If there's no entry at all for this signature (first time seen, e.g. `toggleFlag()` calling `computeExplanations` with a cache that never had a `solve` pass over this exact signature), compute `enumeration` via `enumerateComponentFull` too.

Net effect: within one `reveal()`, `solve`'s enumeration is always reused by the following `computeExplanations()` call - the duplicate backtracking pass is gone. Across moves, an unchanged component's explanations are reused outright.

### D4: Pruning is implicit in building a fresh map each call

Both `solve` and `computeExplanations` build their returned cache by iterating *only* the current call's component partition and looking up each one's signature in `previousCache` - never copying the previous cache wholesale. A signature that no longer corresponds to a live component (because the board or flags changed) is therefore simply never copied into the new map; no separate deletion/pruning pass is needed. This keeps the cache bounded to the current move's live components instead of accumulating every signature ever seen over a long game. A one-off caller that passes `new Map()` (no reuse intended) simply gets a full, freshly-populated cache back, which it's free to discard.

## Risks / Trade-offs

- **[Signature string cost]** Building a canonical signature is `O(component size)` per component per call - negligible next to the exponential enumeration it replaces, and component sizes are bounded by board size (max 480 cells on Expert).
- **[Every `solve` call site changes]** Making `cache` required means `solver.worker.ts` and four test files all need updating in the same change, not just `gameController.ts`. Mitigated by the change being entirely mechanical (add `, new Map()` and destructure `.result`) and caught immediately by the type checker if any site is missed - there's no way to forget one and have it silently compile.
- **[Silent staleness if a signature is built from the wrong inputs]** The signature must include every input `computeExplanationForCell`'s result actually depends on (constraints touching the component + flagged subset of its own cells). Mitigated by deriving the signature directly alongside `enumerateComponentFull`'s own input construction (same `relevantConstraints`/`componentCells` values), so it can't drift from what's actually being cached.

## Migration Plan

Single-repo, no external consumers or deployed state to migrate. Implementation order: (1) add the signature helper and `ComponentCache`/`ComponentCacheEntry` types in `frontierSolver.ts`, (2) switch `computeBaseSolve` to `enumerateComponentFull` and change `solve`'s signature to require and return a cache, (3) update every existing `solve` call site (`solver.worker.ts` and the four test files) to the new signature, (4) rework `computeExplanations` to require/return the same cache shape and consult it before enumerating or running grow/trim, updating its own call sites (`gameController.ts`, `frontierSolver.test.ts`), (5) wire `GameController`'s `Solve` type and `componentCache` field through the constructor, `reveal()`, and `toggleFlag()`, updating `gameController.test.ts`'s stubs, (6) run the full test suite to confirm behavior is unchanged apart from the updated call sites, (7) add new tests asserting cache hits actually skip enumeration/grow-trim (e.g. via a spy or a call-count probe on the exported enumeration function) and that stale entries drop out of the returned cache. No rollback concerns beyond reverting the commit - there's no data migration or external state.
