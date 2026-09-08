## Why

`src/solver/frontierSolver.ts` is 1270 lines carrying five genuinely different concerns — board decomposition, component enumeration, explanation extraction, probability/EIG computation, and the shared types they all speak. Roughly fifteen of its exports exist only so tests can reach inside it: nine `*ForTest` adapter wrappers, three pairs of call counters, and five internals (`computeTrivialDeductions`, `computeFrontierComponents`, `quickXplain`, `computeClueBfsLayers`, `computeComponentSignature`) exported with no production caller. The wrappers are pure test scaffolding living in shipped code, and they exist only because the real internals are unreachable from outside one enormous module.

## What Changes

- Split `frontierSolver.ts` into modules along its existing concern boundaries: `types.ts`, `decomposition.ts`, `componentEnumeration.ts`, `explanation.ts`, `probability.ts`, and a small `instrumentation.ts`. Exact membership is design.md's job.
- Delete the nine `*ForTest` adapter functions (`countLayersPulledForTest`, `computeCluesByCellForTest`, `computeClueBfsLayersForComponent`, `computeComponentForcedSets`, `createSubsetVerdictCacheForTest`, `computeSubsetKeyForTest`, `resolveSubsetForTest`, `quickXplainForTest`, `computeCellExplanationForTest`). Their tests import the real internals directly and do their own board-to-index adaptation in the test file.
- Accept that some currently-private functions (`buildComponentIndex`, `subsetKey`, `resolveSubset`, `growSufficientSet`, and friends) become module exports. Within a focused module named for its concern this is an honest interface, where the same export on a 1270-line catch-all was not.
- Split the solver tests to mirror the new modules. `frontierSolver.test.ts` (737 lines, 30 `describe` blocks spanning all four concerns) breaks into `decomposition.test.ts`, `componentEnumeration.test.ts`, `explanation.test.ts`, and `probability.test.ts`; the already-concern-focused suites keep their contents and lose the `frontierSolver` name where they carry it.
- Keep the three call counters. They move to `instrumentation.ts` because their increment sites straddle two of the new modules; they are not made injectable.
- **BREAKING** (internal only): `frontierSolver.ts` ceases to exist. No re-export barrel is left behind, so all ~20 importing modules update their import specifiers.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. Every function keeps its behavior, signature, and semantics; only the file it lives in changes. No requirement under `openspec/specs/` changes. This change sets `skip_specs: true`.

## Impact

- **`src/solver/frontierSolver.ts`** is replaced by six modules. ~20 importing files across `src/game/`, `src/render/`, `src/explainer/`, and the solver's own tests update their imports.
- **`src/solver/__tests__/`** is reorganized so each solver module has a test module named for it. Cross-cutting suites that are not about one module (the spec-scenario trace and the profiling harness) stay whole. No assertion is added, removed, or rewritten — `describe` blocks move between files verbatim.
- **Solver test files** lose their `*ForTest` entry points and reach the internals directly. Where a wrapper did real adaptation work (building a `ComponentIndex` from a board, mapping keys back to `Coord`s), that work moves into the test file rather than disappearing — the assertions are unchanged.
- **No barrel module.** Confirmed as a deliberate choice: leaving a re-export shim would keep every existing import valid but leave a vestigial file whose only purpose is to avoid an edit.
- **Ordering:** run after `colocate-tests`, so tests are already in `__tests__/` and the split is not simultaneously moving them; run before `share-solver-decomposition`, which introduces a shared decomposition value that belongs in `decomposition.ts` and would otherwise be added to the monolith and then immediately moved.
- **Risk concentration:** this is the largest mechanical change of the four, and it is a pure refactor. The existing solver test suite is the safety net, which is precisely why the test relocation precedes it.
