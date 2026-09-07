## Context

See proposal.md — Why. One additional fact shapes everything below: the five concerns inside `frontierSolver.ts` already form a clean dependency DAG. Nothing in the explanation half calls into the probability half or vice versa; both depend downward on enumeration, which depends on decomposition, which depends on the shared types. The split is possible without a single import cycle, and that is the evidence that these are real seams rather than lines drawn to hit a line count.

The one exception is the call counters. `subsetKeyCallCount` and `growTrimCallCount` increment inside `subsetKey`/`resolveSubset` (explanation), while `enumerationCallCount` increments in both `computeExplanations` (explanation, line 838) and `enumerateWorlds` (probability, line 1132). A counter read by tests from both halves cannot live in either.

## Goals / Non-Goals

**Goals:**
- Modules named for a concern, each small enough that an export is a considered interface rather than an accident.
- No `*ForTest` scaffolding in shipped code.
- No import cycles, and a dependency direction that can be stated in one sentence.

**Non-Goals:**
- Any behavior change. Every function keeps its signature and semantics; only its file changes.
- Injectable instrumentation. Ruled out explicitly — the counters stay module-level mutable state.
- Consolidating the `${row},${col}` key convention that nine non-solver modules duplicate by hand. Real, but not this change's concern.
- Reducing the solver's total surface area. Some private functions become exports; that is a deliberate trade, not a regression.

## Decisions

### D1: Six modules, dependency-ordered

```
   types.ts
      ^
      |
   decomposition.ts        instrumentation.ts
      ^                       ^        ^
      |                       |        |
   componentEnumeration.ts    |        |
      ^        ^              |        |
      |        +----------+   |        |
      |                   |   |        |
   explanation.ts         probability.ts
```

| Module | Holds |
|---|---|
| `types.ts` | `SolverCell`, `SolverBoard`, `Coord`, `CellOutcome`, `FrontierCellResult`, `SolveResult`, and `key()` — the `row,col` string convention every other module speaks |
| `decomposition.ts` | `neighbors`, `isNumbered`, `identifyFrontier`, `buildConstraints`, `RawConstraint`, `applyTrivialDeduction`, `computeTrivialDeductions`, `computeComponents`, `computeFrontierComponents` |
| `componentEnumeration.ts` | `isPartiallyConsistent`, `enumerateComponentFull`, `enumerateComponent`, `ComponentEnumeration`, `ComponentAssignment`, `ComponentCache`, `ComponentCacheEntry`, `componentSignature`, `computeComponentSignature` |
| `explanation.ts` | `ComponentIndex` and `buildComponentIndex`, `neighboursOf`, `walkClueLayers`, `subsetKey`, `resolveSubset`, `resolveSubsetByEnumeration`, `SubsetVerdict`/`SubsetVerdictCache`, `verdictHas`, `resolvesTo`, `growSufficientSet`, `quickXplain`, `extractPremiseKeys`, `computeExplanationForCell`, `FrontierExplanation`, `computeExplanations`, `FlagGivens` |
| `probability.ts` | `cartesianProduct`, `binomial`, `shannonEntropy`, `outcomeKey`, `computeNeighborInfo`, `computeFrontierCellResult`, `WorldEnumeration`, `ComboData`, `enumerateWorlds`, `SolveWithCache`, `solve`, `WeightedWorld`, `WeightedWorlds`, `enumerateWeightedWorlds` |
| `instrumentation.ts` | the three counters with their `reset*`/`get*` pairs |

*Alternative considered:* a separate `math.ts` for `cartesianProduct`, `binomial`, and `shannonEntropy`. Rejected — three private helpers with a single consumer each do not earn a module, and pulling them out would put the weighting math a file away from the only code that weights anything.

*Alternative considered:* folding `componentEnumeration.ts` into `decomposition.ts`. Rejected — the component cache and its signature scheme are the enumeration's own contract, and `explanation.ts` and `probability.ts` both depend on it without depending on each other, which is exactly the shape that justifies its own module.

*On the name:* `componentEnumeration.ts`, not `enumeration.ts`. The solver enumerates at two levels — a component's consistent assignments here, and the board's weighted worlds in `enumerateWorlds` (`probability.ts`) — and the unqualified name collides with both. The `component` qualifier is also what every symbol in the module already carries (`ComponentAssignment`, `enumerateComponentFull`, `ComponentCache`, `componentSignature`), so the file name was the one place it was missing. The line between the two levels is the `binomial(K, remaining)` mine-budget weight: everything below it is "what is consistent", everything above is "how likely".

### D2: No barrel

`frontierSolver.ts` is deleted outright rather than kept as a re-export shim. Confirmed with the author. A barrel would keep ~20 import statements valid at the price of a file whose only purpose is avoiding an edit, and it would let importers keep treating the solver as one undifferentiated blob — which is the thing being fixed.

### D3: Two kinds of test-only export, treated differently

Not every test-only export is scaffolding. They separate cleanly:

**Adapters — deleted, logic moves into the test file.** These do no solver work; they build a `ComponentIndex` from a board, call an internal, and map string keys back to `Coord`s. That adaptation is a test's own business.

- The nine `*ForTest` functions.
- `computeClueBfsLayers` and `computeComponentForcedSets` — not `*ForTest`-named, but the same shape: an internal wrapped in `parseKey` mapping.
- Their private support falls with them: `toFlagGivens`, `FlagGivensInput`, `constraintsForClues`, and `parseKey`, all of which are reachable only from the adapters today. `parseKey` in particular is the inverse of `key()`, and no production path parses a key back into a `Coord` — the explanation builder uses `numberedCoordByKey`/`frontierCoordByKey` lookups instead. It moves to the test helpers; if a later change needs it in production, it comes back with that caller.

**Real functions — kept as module exports.** These compute something and merely happen to have no production caller yet: `computeTrivialDeductions`, `computeFrontierComponents`, `quickXplain`, `computeComponentSignature`. They live in their concern's module and are exported there.

The internals the deleted adapters wrapped (`buildComponentIndex`, `subsetKey`, `resolveSubset`, `growSufficientSet`, `walkClueLayers`, `computeExplanationForCell`) become exports of `explanation.ts`. This widens the nominal API, which is the accepted cost of D3 — but "exported from a 250-line module named `explanation.ts`" carries information that "exported from a 1270-line module named `frontierSolver.ts`" did not.

### D4: Counters keep their current semantics

`instrumentation.ts` exports the same six functions with the same names and the same module-level mutable state. The increment sites import and call an `increment*` function instead of touching a local variable. This is the smallest possible move that lets the counters straddle two modules, and it deliberately stops short of the injectable instrumentation the author ruled out of scope.

### D5: Tests split to mirror the modules

`frontierSolver.test.ts` has the same problem as the module it tests: 737 lines and 30 `describe` blocks covering decomposition, the component cache, explanation extraction, and probability. It splits the same way, so that each solver module has a sibling test module named for it.

| Test module | Takes over |
|---|---|
| `decomposition.test.ts` | frontier identification (3.1), Tier 0 trivial deduction (3.2), frontier component decomposition (3.3) |
| `componentEnumeration.test.ts` | component cache signature (1.2), solve component cache (2.4), `computeExplanations` component cache (3.2, 3.3), toggleFlag-shaped cache reuse (3.4, 3.5), component cache pruning (3.6) |
| `explanation.test.ts` | clue-adjacency BFS layering, grow-then-trim, trim minimality, premise extraction, determinism (with and without flags), exclusion cases, per-component forced sets, flag seeding and rejection, batch computation, subset key and its injectivity, subset verdict cache, QuickXplain minimization, the call-count probes, the per-component clue index, lazy layer walking |
| `probability.test.ts` | exact joint world enumeration (3.4), global mine-count weighting (3.5), non-frontier probability (3.6), expected information gain (3.7), outcome probabilities (3.8), total joint uncertainty |

Suites that are already about one concern keep their contents and change only where their name still says `frontierSolver`: `cachePerformance.test.ts`, `enumerateWeightedWorlds.test.ts`, `explanationProperties.test.ts`, `explanationSnapshot.test.ts`, and `quickXplainPaper.test.ts` are untouched apart from their import specifiers.

Two suites are deliberately *not* split, because they are not about a single module:

- `frontierSolver.spec.test.ts` traces 1:1 to the scenarios in the frontier-solver spec and spans decomposition and `solve` on purpose; splitting it would break the correspondence that is its whole point. **It also keeps its name**, which is not the module's name but the spec's: the repo convention is that a `*.spec.test.ts` file is named for the `openspec/specs/` directory it verifies (`board.spec.test.ts` ↔ `minesweeper-board`, `informationVisualization.spec.test.ts` ↔ `information-visualization`, `frontierSolver.spec.test.ts` ↔ `frontier-solver`). Renaming it would sever that link, and the spec directory is not being renamed. This is the one place where `frontierSolver` legitimately survives the change.
- `bottleneckProfile.test.ts` is a profiling harness that drives the full pipeline end to end. Unchanged.

The mapping above is a *move* of `describe` blocks, exactly as D1 is a move of functions: no assertion is added, removed, or reworded. The one edit inside a test body is the adaptation logic inherited from the deleted `*ForTest` adapters (D3), which lands in whichever test file now owns the block that used it.

## Risks / Trade-offs

- **[Risk] A pure refactor of the project's most intricate module, verified only by its own test suite.** → The suite is unusually strong here (`frontierSolver.test.ts` at 760 lines, plus property, snapshot, paper-conformance, and cache-performance suites), and `colocate-tests` runs first specifically so this change is not moving test files and solver code in the same commit. Land it as a mechanical move with no opportunistic edits: if a function looks improvable while being moved, that is a separate change.
- **[Risk] Reviewers cannot tell a move from an edit in a diff this large.** → Move functions verbatim, preserving comment blocks and internal ordering, so the diff reads as deletions from one file and identical additions in another. The same discipline applies to the test split (D5): `describe` blocks move whole.
- **[Risk] The test suite is being restructured in the same change it is meant to be verifying.** → The safety net is the assertion count and the pass count, not the file layout: every `describe` block moves verbatim, so the same tests run before and after, and a suite that silently stops running is caught by comparing vitest's reported test totals across the change.
- **[Trade-off] The solver's export surface grows even as the file shrinks.** Accepted per D3. The alternative — keeping the nine adapters — leaves test scaffolding in shipped code, which is the thing being removed.
- **[Risk] `explanation.ts` is still the largest module after the split** and may itself want dividing (index construction vs. QuickXplain extraction). → Left as-is. Splitting on a boundary that has not yet caused pain would be speculative, and the module is now named for one concern, which was the goal.
