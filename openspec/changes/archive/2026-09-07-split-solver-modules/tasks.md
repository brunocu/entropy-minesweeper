## 1. Baseline

- [x] 1.1 Record the pre-change test totals by running `npm test` and noting vitest's reported file/test/assertion counts; this number is the safety net for the whole change and must match at the end

## 2. Establish the new module skeleton

- [x] 2.1 Create `src/solver/types.ts` with `SolverCell`, `SolverBoard`, `Coord`, `CellOutcome`, `FrontierCellResult`, `SolveResult`, and `key()` moved verbatim from `frontierSolver.ts`; verify `npx tsc --noEmit` reports no errors in the new file
- [x] 2.2 Create `src/solver/instrumentation.ts` holding the three counters with their existing `*ForTest` `reset*`/`get*` names (D4 keeps them) plus an `increment*` function for each; verify the module imports nothing from any other solver module
- [x] 2.3 Create `src/solver/decomposition.ts` with `neighbors`, `isNumbered`, `identifyFrontier`, `buildConstraints`, `RawConstraint`, `applyTrivialDeduction`, `computeTrivialDeductions`, `computeComponents`, `computeFrontierComponents` moved verbatim, importing only from `types.ts`; verify `npx tsc --noEmit` passes for it
- [x] 2.4 Create `src/solver/componentEnumeration.ts` with `isPartiallyConsistent`, `enumerateComponentFull`, `enumerateComponent`, `ComponentEnumeration`, `ComponentAssignment`, `ComponentCache`, `ComponentCacheEntry`, `componentSignature`, `computeComponentSignature` moved verbatim, importing only from `types.ts` and `decomposition.ts`; verify `npx tsc --noEmit` passes for it

## 3. Move the two upper modules

- [x] 3.1 Create `src/solver/explanation.ts` with the explanation set from design.md D1 (`ComponentIndex`/`buildComponentIndex`, `neighboursOf`, `walkClueLayers`, `subsetKey`, `resolveSubset`, `resolveSubsetByEnumeration`, `SubsetVerdict`/`SubsetVerdictCache`, `verdictHas`, `resolvesTo`, `growSufficientSet`, `quickXplain`, `extractPremiseKeys`, `computeExplanationForCell`, `FrontierExplanation`, `computeExplanations`, `FlagGivens`), exporting the internals the deleted adapters wrapped; verify it imports nothing from `probability.ts`
- [x] 3.2 Create `src/solver/probability.ts` with `cartesianProduct`, `binomial`, `shannonEntropy`, `outcomeKey`, `computeNeighborInfo`, `computeFrontierCellResult`, `WorldEnumeration`, `ComboData`, `enumerateWorlds`, `SolveWithCache`, `solve`, `WeightedWorld`, `WeightedWorlds`, `enumerateWeightedWorlds`; verify it imports nothing from `explanation.ts`
- [x] 3.3 Replace the counter increment sites in `explanation.ts` (`subsetKey`, `resolveSubset`, `computeExplanations`) and `probability.ts` (`enumerateWorlds`) with calls to the `increment*` functions from `instrumentation.ts`; verify by inspection that no counter variable is declared outside `instrumentation.ts`
- [x] 3.4 Delete `src/solver/frontierSolver.ts` and confirm the dependency DAG holds: verify `npx tsc --noEmit` passes and each module's imports match the D1 diagram with no cycle

## 4. Remove the test-only scaffolding

- [x] 4.1 Delete the nine `*ForTest` adapters plus `computeClueBfsLayers` and `computeComponentForcedSets` and their private support (`toFlagGivens`, `FlagGivensInput`, `constraintsForClues`, `parseKey`) so they never appear in the new modules; verify `grep -r 'ForTest' src/solver/*.ts` matches only `instrumentation.ts`
- [x] 4.2 Move `parseKey` and the board→`ComponentIndex` adaptation the deleted adapters performed into `src/__tests__/support/`, alongside the existing solver test helpers; verify the helper is imported only by test files and by no production module

## 5. Split the tests to mirror the modules

- [x] 5.1 Create `src/solver/__tests__/decomposition.test.ts` by moving the frontier identification (3.1), Tier 0 trivial deduction (3.2), and frontier component decomposition (3.3) `describe` blocks verbatim out of `frontierSolver.test.ts`; verify `npx vitest run src/solver/__tests__/decomposition.test.ts` passes
- [x] 5.2 Create `src/solver/__tests__/componentEnumeration.test.ts` by moving the five component-cache `describe` blocks (signature 1.2, solve cache 2.4, `computeExplanations` cache 3.2/3.3, toggleFlag reuse 3.4/3.5, pruning 3.6); verify the file passes on its own
- [x] 5.3 Create `src/solver/__tests__/explanation.test.ts` by moving the remaining explanation `describe` blocks per design.md D5 (layering, grow-then-trim, trim minimality, premise extraction, determinism with and without flags, exclusion cases, forced sets, flag seeding/rejection, batch, subset key and injectivity, verdict cache, QuickXplain, call-count probes, clue index, lazy walking), folding in the adaptation from task 4.2 where a block used a deleted adapter; verify the file passes on its own
- [x] 5.4 Create `src/solver/__tests__/probability.test.ts` by moving the world-enumeration, mine-count weighting, non-frontier probability, EIG, outcome probability, and total-entropy `describe` blocks; verify the file passes and that `frontierSolver.test.ts` is now empty and can be deleted
- [x] 5.5 Leave `frontierSolver.spec.test.ts` whole and keep its filename per D5 — a `*.spec.test.ts` file is named for the spec directory it verifies (`frontier-solver`), not for a module — updating only its import specifiers; verify it still passes and its header comment still points at the frontier-solver spec
- [x] 5.6 Update import specifiers only (no body edits) in `cachePerformance.test.ts`, `enumerateWeightedWorlds.test.ts`, `explanationProperties.test.ts`, `explanationSnapshot.test.ts`, `quickXplainPaper.test.ts`, and `bottleneckProfile.test.ts`; verify `git diff` for these six files touches import lines only
- [x] 5.7 Run `npx vitest run src/solver` including the gated suites (`PROFILE=1` and `SNAPSHOT=1`) and confirm the totals match the task 1.1 baseline for these files — no test silently stopped running

## 6. Update importers and verify the whole tree

- [x] 6.1 Update the import specifiers in the ~20 non-solver files that referenced `frontierSolver` (`src/board/`, `src/explainer/`, `src/game/`, `src/__tests__/`) to point at the concern module that now owns each symbol; verify no import specifier anywhere resolves to `frontierSolver.ts` (`grep -rn "frontierSolver" src` matches nothing — the surviving `frontierSolver.spec.test.ts` is a filename, not a reference)
- [x] 6.2 Run `npm run build` (tsc + vite) and confirm it succeeds with no unresolved imports
- [x] 6.3 Run the full `npm test` suite and confirm the test totals match the task 1.1 baseline with every test green and no snapshot updates — a pure refactor must not change a single result
