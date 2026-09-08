## Context

See proposal.md - Why for the motivation and the profiling evidence.

Current structure in `src/solver/frontierSolver.ts`, as left by `optimize-explanation-extraction`:

```
computeExplanations(board, solveResult, flaggedCells, previousCache)
  constraints = buildConstraints(board)          // ALL clues on the board
  subsetCache = new Map()                        // one per call, shared across components
  for each component:
      relevantConstraints = constraints.filter(touches this component)   // used only for the signature
      flagGivens = { ... }                                               // fixed for this component
      for each certain cell xKey in the component:
          computeExplanationForCell(subsetCache, xKey, targetValue, constraints, flagGivens)
                                                                         ^^^^^^^^^^^
              computeBfsLayers(xKey, constraints)
                  buildClueAdjacency(constraints)     // O(sum deg^2) closure, identical every call
                  BFS to exhaustion, sorting each layer
              growSufficientSet(...)                  // pulls layers until resolvesTo, usually 1-2
              quickXplain(...)                        // ~2k*log2(n/k) oracle calls
              extractPremiseKeys(...)                 // one cache hit
```

Facts the design leans on:

- **Frontier components are exactly the connected components of the clue graph.** `computeComponents` (line 193) unions `c.cells[0]` with every other cell of each constraint, and every constraint's cells are unrevealed neighbours of a numbered cell, i.e. frontier cells. So each constraint's cells lie wholly inside one component, `relevantConstraints` is exactly that component's clue set, and a BFS over the "clues share an unrevealed cell" relation starting from a cell in that component can never leave it.
- **`flagGivens` is already computed once per component**, not per cell (line 720).
- **`RawConstraint.key` is the numbered cell's coordinate**, and `buildConstraints` emits at most one constraint per numbered cell. Within one `computeExplanations` call, a constraint's position in the single `constraints` array therefore fully determines its `key`, `cells`, and `requiredMines`.
- Every oracle query routes through `resolveSubset`, which builds `subsetSignature(constraints, flagGivens)` before its map lookup - on hits and misses alike.
- `growTrimCallCount` (test-only probe) counts `resolveSubset` misses. `frontierSolver.test.ts` asserts on it around the outer `ComponentCache`'s behaviour and around cross-cell reuse.

## Goals / Non-Goals

**Goals:**

- Remove the per-certain-cell fixed setup cost from `computeExplanations`: the adjacency rebuild, the discarded BFS layers, and the per-query string canonicalization.
- Preserve what the `frontier-solver` spec actually requires of an explanation - irreducible, sufficient, confined to the cell's own frontier component, and deterministic for a fixed board state - and verify those properties directly rather than by pinning exact output.
- Attribute the result per fix, by staging the four changes and re-measuring after each, so the record says which one paid and which did not.
- Correct the record in `optimize-explanation-extraction/design.md` without rewriting its original findings.

**Non-Goals:**

- Capping or bounding `enumerateComponent`'s exponential fallback for a single hard subset - still the separate follow-up, and still the owner of the multi-second Expert hangs.
- Changing `growSufficientSet`'s layer-at-a-time growth strategy, `quickXplain`'s divide-and-conquer split, or `resolvesTo`'s Tier-0-then-enumerate structure. Only the inputs they are handed and how those inputs are indexed change.
- Persisting anything new across `computeExplanations` calls. `ComponentCache` remains the only cross-move cache.
- Optimizing `solve`. Its timings are the experimental control.

## Decisions

### D1: A per-component index replaces loose `constraints`/`flagGivens`/cache arguments

Rather than four separate hoists threaded through five signatures, introduce one object built once inside the existing component loop and passed down:

```ts
interface ComponentIndex {
  /** This component's clues - today's `relevantConstraints`, already computed at line 709. */
  readonly constraints: readonly RawConstraint[]
  /** cellKey -> the clues referencing it. The on-demand replacement for `buildClueAdjacency`. */
  readonly cluesByCell: Map<string, string[]>
  readonly constraintByKey: Map<string, RawConstraint>
  /** Dense id per clue, assigned in `constraints` order. The subset key alphabet (D4). */
  readonly idByClueKey: Map<string, number>
  readonly flagGivens: FlagGivens
  /** `flagGivens` serialized once; prefixed onto every subset key in this component (D4). */
  readonly givensPrefix: string
  /** Component-scoped subset-verdict cache (D5). */
  readonly cache: SubsetVerdictCache
}
```

Everything the per-cell pipeline needs now comes from one value that is built `O(m*d)` once per component instead of `O(sum deg^2)` once per certain cell. `computeExplanationForCell(index, xKey, targetValue)` replaces the current five-argument form.

Passing `index.constraints` (the component's clues) where the whole board's `constraints` are passed today is provably layer-identical, per the Context's first bullet: BFS cannot reach the clues being dropped. That equivalence is exactly why this is a correctness fix rather than a behaviour change - and exactly what is fragile about the status quo. `frontier-solver`'s "Minimal Certainty Explanation" requirement scopes an explanation to "that cell's frontier-component revealed numbered cells", and today nothing enforces that: `computeExplanationForCell` receives the whole board and stays in-component only because the BFS reach argument happens to hold. The invariant is a property of an argument, not of the code. Change the layer seeding, the adjacency relation, or the grow strategy and it fails silently, producing cross-component explanations that no test would catch. Narrowing the input makes the confinement structural - the clues that must not appear are not in scope to appear.

This is why D1, D2, and D3 land unconditionally (D6): D1 states the invariant, and D2 and D3 are what let it be stated without paying for a whole-component adjacency closure and a full layer walk per certain cell.

**Alternatives considered:** hoisting `buildClueAdjacency`'s result to a single per-call memo, keeping every other signature as-is. Rejected as a strictly weaker version of the same idea: it still builds the whole-board `deg^2` closure once, still leaves `computeExplanationForCell` reading whole-board `constraints`, and gives D3 and D4 nowhere natural to hang their per-component state, so all three fixes would each need their own hoist.

### D2: Clue adjacency is derived on demand from `cluesByCell`, never materialized

`buildClueAdjacency` is deleted. Its `byCell` half survives as `ComponentIndex.cluesByCell`; its expensive half - the pairwise `deg^2` closure into a `Map<string, Set<string>>` followed by a full copy into a `Map<string, string[]>` - is replaced by:

```
neighboursOf(clue) = union over clue.cells of cluesByCell.get(cell)
```

evaluated only for clues the walker actually reaches. For a cell whose grow search stops at layer 1, the closure over the rest of the component never happens, for any cell.

**Alternatives considered:** keeping the materialized adjacency but caching it on the `ComponentIndex`. Rejected because it still pays the full `deg^2` closure for every component even when grow stops at layer 1 everywhere in it - the closure's cost is proportional to the whole component, while the work actually consumed is proportional to a two-layer neighbourhood. Building the index the walker needs, and nothing more, is both cheaper and less code.

### D3: BFS layers are produced lazily, one layer per pull

`computeBfsLayers(xKey, constraints): RawConstraint[][]` becomes a walker that yields one layer at a time:

```ts
function* walkClueLayers(index: ComponentIndex, xKey: string): Generator<RawConstraint[]> {
  const visited = new Set<string>()
  let layerKeys = [...new Set(index.constraints.filter((c) => c.cells.includes(xKey)).map((c) => c.key))].sort()
  while (layerKeys.length > 0) {
    for (const k of layerKeys) visited.add(k)
    yield layerKeys.map((k) => index.constraintByKey.get(k)!)
    const next = new Set<string>()
    for (const k of layerKeys) {
      for (const cell of index.constraintByKey.get(k)!.cells) {
        for (const neighbour of index.cluesByCell.get(cell) ?? []) if (!visited.has(neighbour)) next.add(neighbour)
      }
    }
    layerKeys = [...next].sort()
  }
}
```

`growSufficientSet` iterates it and `return`s as soon as `resolvesTo` holds, so the generator is abandoned mid-walk and the remaining layers are never built. Seeding, the same-distance-lands-in-one-layer rule, and the per-layer `sort()` are all preserved verbatim, which is what keeps layer contents - and therefore grow order, QuickXplain's split order, and the final explanation - identical to today.

`computeClueBfsLayers`, the test-only full-layering export used at `frontierSolver.test.ts:337,350`, becomes `[...walkClueLayers(...)]` and keeps its exact current output.

**Alternatives considered:** keeping the eager function but bounding it at a depth passed in by the caller. Rejected because the caller cannot know the depth in advance - "how many layers until it resolves" is exactly what the grow loop is discovering - so any bound is either a guess that sometimes forces a second full walk, or the generator with extra steps.

### D4: Subset keys are sorted integer ids with a per-component givens prefix

`subsetSignature`'s per-call work today is, per constraint, a spread-and-`sort()` of its cell list plus a template-string allocation, then a `sort()` over those strings and a `join`. Replace it with:

```ts
function subsetKey(index: ComponentIndex, constraints: readonly RawConstraint[]): string {
  const ids = constraints.map((c) => index.idByClueKey.get(c.key)!)
  ids.sort((a, b) => a - b)
  return `${index.givensPrefix}|${ids.join(',')}`
}
```

No per-constraint allocation, numeric rather than string comparisons in the sort, and `flagGivens` serialized once per component instead of once per query.

This is sound because of the Context's third bullet: within one call there is exactly one constraint per numbered cell, so a clue id determines the constraint's `key`, `cells`, and `requiredMines` completely. The content that `subsetSignature` hashes is not additional information - it is a redundant re-derivation of what the id already pins down. The `givensPrefix` is retained rather than dropped so the "different givens must produce a different key" property that `frontierSolver.test.ts:562` asserts survives, at zero per-query cost.

**Alternatives considered:** a bitmask key (one `number` for components of <= 32 clues, `BigInt` above). Rejected for now as two code paths and a size cliff for a win over an already-cheap numeric sort of a handful of ids; worth revisiting only if stage 4's measurement shows keys still material. Also considered: threading a key incrementally through `quickXplain`'s recursion so a subset key is derived from its parent's rather than rebuilt. Rejected as premature - it entangles the cache key with QuickXplain's control flow, and D4's cheap key may already make the rebuild negligible.

### D5: The subset-verdict cache is scoped per component, not per call

`optimize-explanation-extraction` made the cache call-scoped and shared across components. That sharing is provably worthless: constraint sets from different components are disjoint, so no subset drawn from component A can ever equal one drawn from component B, and no cross-component query can ever hit. Moving the cache onto `ComponentIndex` therefore loses nothing, and it is what makes `flagGivens` constant within a cache and so hoistable into `givensPrefix` (D4).

It also makes the invariant structural instead of conventional: a cache that lives on the component index cannot be handed a subset from another component by accident.

`growTrimCallCount` keeps its current meaning - incremented on a `resolveSubset` miss - and the existing assertions around it stay valid, because per-component scoping removes only hits that could never have occurred.

**Alternatives considered:** leaving the cache call-scoped and keeping `flagGivens` in every key. Rejected: it preserves a sharing property with no reachable benefit at the cost of per-query givens serialization, and it leaves the "don't mix components" rule as caller discipline rather than a type.

### D6: The fixes land as measured stages, but only the last two are contingent on the measurements

Each of D1/D2, D3, D4, D5 is landed and profiled separately against a baseline captured in the same session on the same machine, producing a per-stage attribution table appended to this document. `solve`'s totals are the control, exactly as `optimize-explanation-extraction` used them: this change touches nothing `solve` runs, so a drifting `solve` column means the run is noise and must be repeated.

**Measurement attributes; it does not gate D1-D3.** Those three carry the component-scoping invariant of D1, which is required whatever the profiler says - a correctness property is not bought at an exchange rate against milliseconds. Their rows in the attribution table record what the restructuring happened to cost or save, and a disappointing row is a finding to write down, not a reason to revert. D4 and D5 are different: they buy speed and nothing else, and they add a dropped content-hashing safety net (D4) and a narrowed cache scope (D5) as their price. Those two are worth landing only if the numbers say so.

This is the measurement plan *instead of* a separate instrumentation spike. Timing individual phases would mean `performance.now()` calls inside functions that run in microseconds, where the probe distorts what it measures; ablation measures the same thing end-to-end with no distortion, and each ablation step is a change worth landing on its own. One cheap counter is still added - `subsetKeyCallCount`, alongside the existing `growTrimCallCount`/`enumerationCallCount` probes - to size how many key builds a move actually performs, which is what tells us whether D4 is worth its complexity before it is written.

The hypothesis being tested is stated in advance so it can fail: **D1+D2+D3 together should remove a majority of Beginner's per-move explain time**, since Beginner has almost no oracle work for anything else to be. If Beginner barely moves after stage 2, the cost model behind this change is wrong; D1-D3 stay regardless, and D4/D5 are then reconsidered from scratch rather than landed on the strength of a model the measurements just contradicted.

**Alternatives considered:** landing all four together and measuring once. Rejected because the change would then repeat `optimize-explanation-extraction`'s exact mistake - a plausible mechanism, a single before/after, and no way to tell which part of it actually paid.

## Risks / Trade-offs

- **[Every fix here is *argued* to preserve output, and an argument is not a check]** -> D1's BFS-reach equivalence, D3's verbatim-preserved layer ordering, and D4/D5's identical verdicts are all proofs on paper. The properties that must hold regardless are the spec's - irreducibility, sufficiency, component confinement, determinism - so those are asserted directly (task 1.5) and are the actual gate. Output byte-identity is kept as a *tripwire* on top: a snapshot diff after each stage, whose failure means one of the equivalence arguments is wrong and must be diagnosed before proceeding. Diagnosis can legitimately end in "genuine equally-minimal tie, fixture updated" - the same latitude `optimize-explanation-extraction` had - but it must end in a diagnosis, not a shrug.
- **[D1's argument narrowing rests on a claim about component structure]** -> If frontier components were *not* the connected components of the clue graph, D1 would silently truncate layers. Mitigated by an explicit test asserting that `walkClueLayers` over `relevantConstraints` and over whole-board `constraints` yield identical layers for every certain cell on a battery of boards, so the claim is checked rather than assumed.
- **[D4 removes a content-hashing safety net]** -> The id-based key trusts that a clue id pins down its constraint's content. Mitigated by assigning ids from the single `relevantConstraints` array built once per call (never from a re-derived list) and by a test asserting that distinct clue subsets of a component never share a key, plus the retained `givensPrefix` property test.
- **[Generators are a new idiom in this module]** -> `frontierSolver.ts` is otherwise plain functions over arrays. The laziness is the point of D3, so this is a deliberate exception rather than drift; it is confined to one walker whose only consumers are `growSufficientSet` and the test-only full-layering export.
- **[The profiling harness is noisy and slow]** -> Five runs (baseline + four stages) at 20 seeds x 3 difficulties. Mitigated by the `solve`-column control, by running all five in one session on one machine, and by reporting per-difficulty totals rather than single moves.
- **[The hypothesis may be wrong]** -> D6 states the falsifier up front. If Beginner's per-move explain time does not fall substantially by stage 2, stop and re-diagnose before D4/D5 rather than continuing on momentum. This does not put D1-D3 back in play: they carry the component-scoping invariant and stay whether or not they turn out to be fast.
- **[A correctness fix with no failing test to show for it]** -> D1-D3 are output-preserving, so nothing currently fails and nothing newly passes. The guard against the invariant decaying again is therefore structural (the component's clues are the only ones in scope) plus task 1.4's explicit equivalence test, not a regression test - there is no state of the code where the bug is observable to write a test against.
- **[Correcting a completed change's design doc]** -> The addendum to `optimize-explanation-extraction/design.md` appends a dated correction and leaves the original table, reasoning, and conclusion text in place, so the record shows what was concluded and why it was revised, not a silently rewritten history.

## Migration Plan

Single-repo, no external consumers, no persisted state touched. Stages 2 and 3 below (D1-D3) are not revertible on performance grounds - they carry D1's invariant and land regardless of what the profiler reports. Stage 4 (D4, D5) is independently revertible, and is reverted if it does not pay.

1. Capture a fresh baseline profiler run, the spec-property tests (task 1.5), and an output snapshot over the harness's boards to serve as the tripwire.
2. Stage 1 - D1 + D2 (`ComponentIndex`, component-scoped constraints, `cluesByCell` replacing `buildClueAdjacency`). Measure.
3. Stage 2 - D3 (lazy layer walker). Measure.
4. Stage 3 - D5 (component-scoped cache), then D4 (id-based keys, givens prefix), in that order since D4 depends on D5's scoping. Measure.
5. Append the attribution table to this document; append the dated addendum to `optimize-explanation-extraction/design.md`.

## Measured Results

All rows from one session on one machine (WSL2, Node via vitest 4.1.11), harness at 20 seeds x 3
difficulties. `solve` is the control: this change touches nothing it runs, so a drifting `solve`
column means the run is noise. It stayed within ~1.5% of baseline on every row.

| Stage | Beginner solve/explain | Intermediate solve/explain | Expert solve/explain | explain per move (B / I / E) | subset keys per move (B / I / E) |
|---|---|---|---|---|---|
| Baseline | 29 / 417 ms | 421 / 5038 ms | 2077 / 9375 ms | 1.227 / 3.496 / 11.201 ms | 149.3 / 313.2 / 557.6 |
| Stage 1 - D1+D2 (component index, on-demand adjacency) | 29 / 390 ms | 415 / 4177 ms | 2101 / 8136 ms | 1.147 / 2.899 / 9.721 ms | 149.3 / 313.2 / 557.6 |
| Stage 2 - D3 (lazy layer walker) | 29 / 348 ms | 414 / 2947 ms | 2103 / 4796 ms | 1.024 / 2.045 / 5.730 ms | 149.3 / 313.2 / 557.6 |
| Stage 3 - D5+D4 (per-component cache, id-based keys) | 28 / 310 ms | 426 / 2547 ms | 2073 / 4137 ms | 0.911 / 1.767 / 4.942 ms | 149.3 / 313.2 / 557.6 |

Per stage, as a share of the explain time entering it:

| Stage | Beginner | Intermediate | Expert | Paid? |
|---|---|---|---|---|
| Stage 1 - D1+D2 | -6.5% | -17.1% | -13.2% | Yes, and more the larger the component |
| Stage 2 - D3 | -10.8% | -29.4% | -41.1% | Yes - the largest single win, and the steepest gradient |
| Stage 3 - D5+D4 | -10.9% | -13.6% | -13.7% | Yes, and unusually flat across difficulties |
| **Cumulative** | **-25.7%** | **-49.4%** | **-55.9%** | |

The subset-key count is byte-identical at every stage and every difficulty, which is the check that
none of the five decisions changed *which* subsets the search queries - only how it reaches, keys,
and caches them. Output is byte-identical to baseline after every stage, across the full
snapshot battery (393 board states, ~14.5k explanation lines), and no explainer fixture moved.

Stage 3 is worth a note: a direct microbenchmark put `subsetSignature` at 0.76 us per build against
the id-based key's 0.12 us, which at 149-558 keys per move predicts only 0.09-0.36 ms saved - about
6-9%. It delivered 11-14%. The extra is most likely the keys themselves being shorter: every one of
those builds is followed by a `Map` lookup that must hash and compare the string, and an id list is
far shorter than a full constraint-content serialization. The cost being removed was never only the
building.

Unlike stages 1 and 2, stage 3's win is nearly flat across difficulties (-10.9 / -13.6 / -13.7%),
which is the signature the proposal *predicted for D1-D3 and did not find*: a cost per query rather
than per component. Beginner's floor, in other words, was more key-and-cache overhead than graph
setup.

### D6's falsifier: fired

The hypothesis stated in advance was that **D1+D2+D3 together should remove a majority of
Beginner's per-move explain time**. They removed **16.5%** (1.227 -> 1.024 ms). The falsifier fires:
the cost model behind this change is wrong in its Beginner reading.

What the measurements say instead is that the setup cost D1-D3 removed *scales with component
size*, and does not explain a fixed per-certain-cell floor. Both fixes are proportional to the
component: `buildClueAdjacency`'s closure is `O(sum of deg^2)` over the whole component, and the
layers `growSufficientSet` discarded are the ones past the resolving layer, of which there are more
the larger the component. On Expert, where components are large, that is nearly half of explain
time; on Beginner, where a component is a handful of clues, the eager work was never large to
begin with. The proposal read Beginner's small improvement under `optimize-explanation-extraction`
as the signature of a *fixed* per-cell cost; the correct reading is that Beginner simply has less
of every kind of per-component work, and its remaining ~1.02 ms per move is not dominated by any
one of the three sources this change identified.

Per D6, this does not put D1-D3 back in play: they carry the component-scoping invariant of D1,
which is required whatever the profiler says, and they did in fact pay - substantially so on the
two difficulties that were slow enough to matter.

D4/D5 were then reconsidered from scratch rather than landed on the contradicted model, as D6
requires. The case for them was re-made from the microbenchmark above (0.76 us -> 0.12 us per key,
at a measured 149-558 keys per move) rather than from the cost model, and they were landed on that
basis. They then beat the estimate, for the reason given in the stage-3 note.

### The enumeration cap is untouched and still outstanding

Every table here excludes the moves the harness skips as dangerous (worst component above 22 free
variables): 0 on Beginner, 94 on Intermediate, **709 on Expert**, and those counts are identical at
baseline and after all three stages - this change neither speeds up nor newly admits a single one of
them. They are the moves that would run `enumerateComponent`'s uncapped exponential path, and they
remain the owner of the multi-second Expert hangs. That is a different problem from the per-explain
setup overhead measured above, and capping the enumeration is still the separate follow-up both this
change and `optimize-explanation-extraction` scope out.

### An unrelated limitation this change's tests surfaced

Building the task 1.5 property tests turned up a pre-existing gap, confirmed with the user as known
and out of scope here: **a frontier cell can be certain because of the board's global mine budget
rather than because of its component's clues**. On one 9x9 state in the battery, cell (6,0) is
reported `probability === 0` by `solve` while its component's constraints admit three satisfying
assignments, one of which makes it a mine. `solve`'s world weighting knows the mine count; the
explainer, scoped to frontier constraints by design, does not. For such cells `growSufficientSet`
exhausts every layer without resolving - QuickXplain's "no p-set" case (Junker 2004, Alg. 1
line 1) - and the cell reports the empty explanation, so nothing is highlighted.

The property tests therefore assert sufficiency and irreducibility only for cells their component
actually forces, and assert separately that every excluded cell reports exactly the empty
explanation, so the exclusion is a named and checked category rather than a hole.
Component confinement and determinism are asserted for all certain cells without exception.
Nothing in D1-D5 touches this, and output was byte-identical across it at every stage.
