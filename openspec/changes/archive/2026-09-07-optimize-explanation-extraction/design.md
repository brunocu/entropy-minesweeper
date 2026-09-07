## Context

See proposal.md - Why/What Changes for motivation and scope.

Relevant existing structure (`src/solver/frontierSolver.ts`):

- `computeExplanationForCell(xKey, targetValue, constraints, flagGivens)` runs, per certain cell: `computeBfsLayers` -> `growSufficientSet` (insertion-based: add whole clue-adjacency layers until the accumulated set forces `xKey`, checked via `resolvesTo`) -> `trimToMinimal` (deletion-based: single fixed-order pass, testing removal of each member via another `resolvesTo` call) -> `extractPremiseKeys` (a further, separate `applyTrivialDeduction` call over the trimmed set).
- `resolvesTo(constraints, xKey, targetValue, flagGivens)` is the sufficiency oracle: it runs `applyTrivialDeduction` (a Tier-0 fixpoint, cheap) over `constraints`, and only if that alone doesn't resolve `xKey` falls back to `enumerateComponent` (exponential backtracking) over the candidate's free variables. Both `applyTrivialDeduction` and `enumerateComponent` are computed over the *entire subset*, not per-cell - but today's `resolvesTo` discards every cell's forced status except `xKey`'s, even though the same call already computed the answer for every other cell in the subset too.
- `computeExplanations` calls `computeExplanationForCell` once per certain cell within a component, all sharing the same `constraints` (the component's `relevantConstraints`) and the same `flagGivens` (computed once per component, not per cell). Different cells get different BFS layers (since layers radiate outward from each cell's own directly-touching clues) and so different grow orders, but profiling shows heavy overlap: nearby certain cells' candidate subsets share most of their members, and the *same* candidate subset is frequently re-tested - both within one cell's own grow/trim search (grow's prefixes and trim's removal-tests revisit overlapping subsets) and, unexploited today, across *different* cells' searches within the same component.
- Profiling (`src/solver/bottleneckProfile.test.ts`) shows `computeExplanations` costing 6-16x more than `solve`'s enumeration even on boards with small, easy components - consistent with this being a redundant-recomputation problem, not a CSP-hardness problem.
- `growTrimCallCount` (test-only probe, `getGrowTrimCallCountForTest`/`resetGrowTrimCallCountForTest`) currently increments on every `resolvesTo` call, used by `frontierSolver.test.ts` to assert the outer `ComponentCache` correctly skips grow/trim entirely on a cache hit (`toBe(0)`) and does real work on a miss (`toBeGreaterThan(0)`).

## Goals / Non-Goals

**Goals:**
- Replace `trimToMinimal`'s linear, fixed-order deletion scan with QuickXplain's divide-and-conquer minimization, using the existing sufficiency oracle unchanged in its logical contract.
- Eliminate redundant oracle recomputation both within one cell's grow/trim search and across different certain cells' searches in the same `computeExplanations` call, by caching each distinct candidate subset's *full* forced-status result (every cell's status, not just the one cell that happened to ask first) and reusing it for any later query - whether from the same cell's own search or a different cell's.
- Preserve the `frontier-solver` spec's actual contract: a locally minimal (irreducible) explanation set, deterministic for a fixed board state (see "Minimal Certainty Explanation" and "Explanation is deterministic for a fixed board state"). Preserve `growTrimCallCount`'s role as a "real recomputation happened" probe.

**Non-Goals:**
- Bit-identical explanation *sets* to today's linear-deletion-order output in every case. When a certain cell has more than one equally-minimal (same-size, irreducible) explanation, QuickXplain's divide-and-conquer split can select a different one than left-to-right deletion would - both are valid per spec (irreducible, deterministic-per-query), but they need not coincide. See Risks.
- Persisting the new cache across `computeExplanations` calls (across moves) - it is scoped to one call, matching the proposal's framing. This is independent of, and does not replace, the existing cross-call `ComponentCache`.
- Bounding or capping the exponential enumeration `resolvesTo` falls back to for a single hard subset - that's the separate, already-scoped-out "uncapped enumeration on large ambiguous components" follow-up.
- Changing `growSufficientSet`'s layer-based growth strategy itself (still insertion-based, still BFS-layer-at-a-time) - only its downstream trim and the oracle's cost per call are addressed here.

## Decisions

### D1: QuickXplain replaces `trimToMinimal`, built on the existing oracle unchanged

`trimToMinimal(candidate, xKey, targetValue, flagGivens)` is replaced by a divide-and-conquer minimizer with the same signature and contract (input: a subset already known sufficient; output: an irreducible subset of it that is still sufficient), using the same `resolvesTo`-shaped sufficiency check as its only primitive - no new oracle semantics.

Standard formulation (Junker 2004), adapted to our "sufficiency" polarity (`resolvesTo(S)` = "S forces `xKey` to `targetValue`", monotone: a superset of a sufficient set is always still sufficient, since `applyTrivialDeduction`/`enumerateComponent` only ever gain information from more constraints):

```
quickXplain(background: RawConstraint[], candidates: RawConstraint[]): RawConstraint[]
  if candidates is empty: return []
  if resolvesTo(background): return []          // background alone already suffices; none of candidates needed
  if candidates has 1 element: return candidates
  (c1, c2) = split candidates in half (stable order from growSufficientSet's grow sequence)
  delta2 = quickXplain(background ++ c1, c2)
  delta1 = quickXplain(background ++ delta2, c1)
  return delta1 ++ delta2
```

Called as `quickXplain([], candidate)` from `trimToMinimal`'s call site. This is a direct algorithm substitution: same inputs, same output contract, same oracle - only the search strategy for finding the irreducible subset changes, from O(n) linear scan to O(2k·log2(n/k)) worst case / O(log2(n/k)+2k) best case oracle calls (k = final explanation size, n = candidate size) [Junker 2004; independently restated in "Understanding the QuickXPlain Algorithm," 2020].

**Alternatives considered:** Deletion-based extraction with model-rotation-style reuse (Belov/Marques-Silva) was considered as the primary replacement instead of QuickXplain, since it more directly targets D2's redundancy goal too. Rejected as the *trim*-phase algorithm specifically because model rotation's speedup comes from reusing partial *assignments* found during a SAT-style search, which doesn't map cleanly onto our CSP backtracking oracle's return shape (a boolean, not a model to inspect) without deeper rearchitecting on `enumerateComponent`; QuickXplain needs no such internal access and is a strict drop-in. Model rotation's actual generalizable idea - reuse byproducts across calls - is still captured by D2's subset-verdict cache, applied uniformly to every oracle call (grow, QuickXplain's trim, and `extractPremiseKeys`) rather than being specific to one search style.

### D2: Oracle results are cached per candidate-subset signature, keyed to answer every cell in the subset - not just the cell that asked

The oracle's expensive work (`applyTrivialDeduction`'s fixpoint; `enumerateComponent`'s backtracking) depends only on the candidate constraint subset and `flagGivens` - not on which cell (`xKey`) or which target value is being asked. Today's `resolvesTo` throws this away: it computes the full `forcedSafe`/`forcedMine` sets (and, on the exponential path, every component cell's assignment-agreement) but reports only `xKey`'s status.

Introduce a per-`computeExplanations`-call cache, `SubsetVerdictCache` (a plain mutable `Map<string, SubsetVerdict>` local to one `computeExplanations` invocation - not threaded through a public return value the way `ComponentCache` is, since it never needs to survive past the call that created it):

```ts
interface SubsetVerdict {
  readonly forcedMine: ReadonlySet<string>
  readonly forcedSafe: ReadonlySet<string>
}

function resolveSubset(
  cache: Map<string, SubsetVerdict>,
  constraints: readonly RawConstraint[],
  flagGivens: FlagGivens,
): SubsetVerdict {
  const signature = subsetSignature(constraints, flagGivens)
  const cached = cache.get(signature)
  if (cached) return cached

  growTrimCallCount++   // a genuine cache miss - real recomputation, matches the probe's existing intent
  const { forcedSafe, forcedMine } = applyTrivialDeduction(constraints, flagGivens.forcedSafe, flagGivens.forcedMine)
  // ... if some cell of interest isn't resolved by Tier-0 alone, fall back to enumerateComponent
  // and derive forced status for *every* component cell from assignment agreement, not just one -
  // this is what makes the cache answer other cells' future queries, not just the current one.
  const verdict: SubsetVerdict = { forcedMine, forcedSafe }
  cache.set(signature, verdict)
  return verdict
}

function resolvesTo(cache, constraints, xKey, targetValue, flagGivens): boolean {
  const { forcedMine, forcedSafe } = resolveSubset(cache, constraints, flagGivens)
  return targetValue === 1 ? forcedMine.has(xKey) : forcedSafe.has(xKey)
}
```

`subsetSignature` is a canonical string over the subset's constraint keys plus `flagGivens` (sorted `clueKey` list, joined; `flagGivens` is already fixed per component per call, but included in the key for correctness rather than relying on caller discipline) - the same style as the existing `componentSignature` helper, scoped one level finer (per candidate subset within a component, not per whole component).

This cache is consulted from all three of `growSufficientSet`, `quickXplain` (D1), and `extractPremiseKeys` (which today runs its own separate, uncached `applyTrivialDeduction` over the trimmed set - D4) - every oracle-shaped query in the explanation pipeline routes through it, so a subset re-tested anywhere (within one cell's search, or from a different cell's search that happens to probe the same subset) is a cache hit.

**Alternatives considered:** Keying the cache by `(subset, xKey, targetValue)` instead - rejected because it captures reuse only within one cell's own repeated queries (which QuickXplain's reduced call count already shrinks), not the cross-cell reuse that the profiling data's overlapping-candidate-sets observation specifically motivates; keying by subset alone (answering every cell at once) is what makes a different cell's identical or overlapping query a hit. Threading the cache immutably (à la `ComponentCache`, new map returned each call) was considered for consistency with the existing codebase style - rejected as unnecessary ceremony here: this cache never crosses a public function boundary as part of the module's API surface (unlike `ComponentCache`, which `GameController` persists across moves), so a plain mutable local, created and discarded within `computeExplanations`, is simpler and has no correctness downside.

### D3: `growTrimCallCount` now counts cache misses (real recomputation), not raw oracle-call sites

`growTrimCallCount` is incremented inside `resolveSubset` only on a cache miss, not inside the `resolvesTo`/`quickXplain`/`extractPremiseKeys` call sites that consult the cache. This matches the probe's existing documented intent ("counts those grow/trim searches... being (re)computed", per its current doc comment) more precisely than today's implementation does, and keeps `frontierSolver.test.ts`'s existing assertions (`toBeGreaterThan(0)` on a first real call, `toBe(0)` when the outer `ComponentCache` skips `computeExplanations` entirely) valid without modification, since both of those assert around the *outer* `ComponentCache`'s behavior, not this cache's internals.

### D4: `extractPremiseKeys` consults the same cache instead of running its own separate deduction

`extractPremiseKeys(trimmed, xKey, flagGivens)` currently calls `applyTrivialDeduction(trimmed, ...)` directly. Since `trimmed` is exactly the final subset `quickXplain` just verified sufficient (necessarily already in the cache as a byproduct of that verification), route this through `resolveSubset(cache, trimmed, flagGivens)` instead - a guaranteed cache hit, turning a second full Tier-0 fixpoint pass into a map lookup.

## Risks / Trade-offs

- **[Tie-breaking can differ from today's exact output]** When a certain cell has more than one equally-minimal explanation, QuickXplain's split order can select a different one than left-to-right linear deletion. Both are spec-valid (irreducible, deterministic per query) - bit-identical output to today's algorithm is explicitly a non-goal, not a requirement. Existing tests in this project aren't contracts (they're written after the code to verify behavior, not to pin it), so a `frontierSolver.test.ts` fixture asserting exact `clueCells`/`premiseCells` content is free to break if it hit a genuine tie; the fix is to replace that assertion with one that checks the spec's actual properties (irreducibility, determinism) rather than exact content, not to preserve the old assertion's specific output.
- **[Cache correctness depends on the signature capturing every input the oracle's answer depends on]** `resolveSubset`'s result depends on exactly `constraints` (by content, not identity) and `flagGivens`. Mitigated by deriving the signature the same way `componentSignature` already does for the outer cache - directly alongside the actual inputs passed to `applyTrivialDeduction`, so it can't drift.
- **[Local mutable cache breaks from the module's usual immutable-threading style]** `frontierSolver.ts` otherwise threads caches immutably (`ComponentCache`). A plain mutable `Map` for this one, call-scoped cache is a deliberate, narrower exception (D2's alternatives-considered) - worth flagging in review so it isn't mistaken for an oversight.

## Migration Plan

Single-repo, no external consumers. Implementation order: (1) add `SubsetVerdict`/`subsetSignature`/`resolveSubset` and rewire `resolvesTo` to use it, moving the `growTrimCallCount` increment into the cache-miss path (D2, D3); (2) implement `quickXplain` and swap it in for `trimToMinimal`'s call site (D1); (3) route `extractPremiseKeys` through `resolveSubset` (D4); (4) create and thread one cache instance per `computeExplanations` call through `computeExplanationForCell`'s call sites; (5) run the full test suite, replacing any fixture assertion that breaks on a genuine tie (per the tie-breaking risk above) with one asserting irreducibility/determinism instead of exact content; (6) add tests asserting the new cache actually skips recomputation across two cells sharing a subset (e.g. via `getGrowTrimCallCountForTest`) and that QuickXplain's output is still irreducible and deterministic; (7) rerun `src/solver/bottleneckProfile.test.ts` (PROFILE=1) to confirm the measured `computeExplanations`-vs-`solve` overhead has shrunk, and record the before/after numbers in the PR description.

## Measured Results

Task 5.2's before/after run of the profiling harness, both on the same machine in the same session:
`PROFILE=1 npx vitest run src/solver/bottleneckProfile.test.ts --reporter=verbose`
(20 seeds per difficulty, up to 200 moves per game, components above 22 free variables skipped as dangerous).

| Difficulty | solve before | solve after | explain before | explain after | explain ÷ solve |
| --- | --- | --- | --- | --- | --- |
| Beginner (340 timed moves) | 31ms | 29ms | 472ms | 427ms | 15.2x -> 14.7x |
| Intermediate (1441 timed moves) | 421ms | 426ms | 5993ms | 5147ms | 14.2x -> 12.1x |
| Expert (837 timed moves) | 2064ms | 2159ms | 12167ms | 9639ms | 5.9x -> 4.5x |

`solve` totals are flat across the two runs (the same enumeration work, untouched by this change),
which is what makes the `explain` column comparable rather than machine noise. On the identical
worst-case board both runs report (Intermediate, seed 15, move 10), oracle recomputations fall from
202 to 128 grow/trim calls (-37%) and that move's explain time from 18.2ms to 16.9ms.

The overhead shrank on every difficulty but is still several times `solve`'s cost. That is the
expected outcome, not a shortfall: the remaining gap is dominated by the uncapped exponential
enumeration on large ambiguous components, which the proposal explicitly scopes out to a follow-up
change. Note also that the 709 Expert moves the harness skips as dangerous are exactly the cases
that follow-up targets, so this table understates the worst-case cost that is still outstanding.

### Addendum (2026-09-06): the residual is setup cost, not enumeration

The paragraph above attributes the remaining `explain`-vs-`solve` gap to "the uncapped exponential
enumeration on large ambiguous components." A later reading of the same table does not support that,
and the follow-up change `reduce-explanation-setup-overhead` was opened on the corrected reading.
The original numbers and reasoning are left in place above; this addendum records what they turn out
to show.

Two things in the table point away from enumeration:

- **Oracle calls fell far faster than time.** On the worst-case board (Intermediate seed 15, move 10)
  recomputations dropped 37% (202 -> 128) while that move's explain time dropped 7% (18.2ms -> 16.9ms).
  If cache-missing oracle work dominated that move, a 37% cut would have bought roughly 37% of the
  time. It bought a fifth of that, so most of the move's cost is work this change did not touch. Note
  also that every miss eliminated becomes a *hit*, and a hit still pays `subsetSignature`'s full
  string canonicalization before its map lookup - so the trade was a Tier-0 fixpoint for a signature
  build, not for nothing.
- **The easiest difficulty has the worst ratio and improved least.** Beginner is 9x9 with 10 mines;
  Tier-0 resolves nearly everything and `enumerateComponent`'s exponential path essentially never
  runs. Yet Beginner shows the *highest* explain/solve ratio of the three (14.7x, 1.39ms per move)
  and the *smallest* improvement (-9.5%, versus -20.8% on Expert). The improvement gradient tracks
  CSP hardness because QuickXplain and the verdict cache reduce oracle call count - which means the
  residual floor beneath it does not track CSP hardness at all.

Both observations fit a fixed per-certain-cell setup cost: `buildClueAdjacency` rebuilding the same
graph once per certain cell over the whole board's constraints, `computeBfsLayers` expanding every
layer when grow consumes one or two, and `subsetSignature` re-serializing subsets on every query.
None of those scale with how hard the CSP is, which is why they are invisible in the Expert row and
dominant in the Beginner row.

This does not retract the change. Its diagnosis correctly ruled out CSP hardness as the cause of the
6-16x gap; it then attributed the whole gap to redundant *search* when most of it was redundant
*setup*, and QuickXplain plus the verdict cache remain the right lever for the search half - which is
why Expert, where oracle work is the largest share, improved the most.

The scoped-out enumeration follow-up is still real and still needed. It owns the multi-second Expert
hangs - the 709 Expert moves this harness skips as dangerous, which the table excludes entirely - but
it cannot own the 1.39ms-per-move floor on Beginner, where there is no enumeration to blame.

### Addendum 2 (2026-09-06): what the staged measurements actually showed

The addendum above was written when `reduce-explanation-setup-overhead` was proposed, before it was
built. That change has now landed its five decisions in three measured stages, and the numbers
qualify the addendum's own reasoning as well as the original conclusion. Both are left in place
above; this records the outcome. The full per-stage table is in
`openspec/changes/reduce-explanation-setup-overhead/design.md` under Measured Results.

The residual was indeed setup rather than enumeration - explain time fell 25.7% on Beginner, 49.4%
on Intermediate and 55.9% on Expert with output byte-identical throughout, none of it by touching
`enumerateComponent`. But the addendum's characterization of that setup as a cost that "does not
scale with how hard the CSP is" was wrong in its Beginner reading. The two fixes aimed squarely at
the per-certain-cell graph work - the adjacency rebuild and the discarded BFS layers - are both
proportional to component size, and they paid accordingly: -41.1% on Expert against -10.8% on
Beginner. What did behave like a flat per-query cost was the third item, `subsetSignature`: replacing
it with an id-based key and scoping the verdict cache per component won 10.9 / 13.6 / 13.7% across
the three difficulties, nearly independent of difficulty.

So the corrected attribution is: the Beginner floor was mostly per-*query* key and cache overhead,
not per-cell graph setup, and the gradient the addendum read as evidence of a fixed cost was better
explained by Beginner simply having less of every kind of per-component work.

The scoped-out enumeration-cap follow-up is unaffected by any of this and remains outstanding. It
owns the multi-second Expert hangs - the 709 Expert moves the harness skips as dangerous, excluded
from every table in both documents - which is a different problem from the setup overhead
`reduce-explanation-setup-overhead` addressed, and neither change makes those moves any faster.
