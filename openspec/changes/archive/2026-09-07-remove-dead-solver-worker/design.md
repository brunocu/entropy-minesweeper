## Context

See proposal.md — Why. This change involves no architectural decisions; it is recorded because the workflow's `tasks` artifact requires a design, and because two of the four deletions deserve a written rationale rather than a silent `rm`.

The relevant state: `main.ts` constructs `GameController`, which calls `solve` synchronously. `SolverClient` has no importer. `solver.worker.ts` and `solverProtocol.ts` are reachable only from `solverWorker.test.ts`, which loads the worker through Node's `worker_threads` to exercise it as a real OS thread.

## Goals / Non-Goals

**Goals:**
- Remove code no entry point reaches, and leave the record of *why* it existed intact.

**Non-Goals:**
- Reintroducing off-main-thread solving in any form.
- Addressing the underlying risk the worker was meant to mitigate (a pathological frontier component stalling the UI). That risk is unmitigated today and stays unmitigated; this change only stops the repository from implying otherwise.
- Any wider sweep for unused exports. The four removals here were each verified individually; a general audit is not in scope.

## Decisions

### D1: Delete outright rather than deprecate

The worker has never run in production — `main.ts` has always solved synchronously — so there is no deprecation window to honor and no consumer to migrate. Git holds the implementation if off-main-thread solving is wanted later, and reintroducing it would want a real requirement and actual wiring into `main.ts` rather than a restored file.

*Alternative considered:* keep the modules and wire them up instead, finishing the abandoned feature. Rejected as a different change entirely — it would need a requirement, and `GameController` is synchronous throughout, so making the solve asynchronous ripples into every consumer of `latestSolve`.

### D2: `solverWorker.test.ts` goes with it, including its synthetic-frontier generator

The test covered `solve` end-to-end through a worker round-trip. The `solve` behavior is covered directly by `frontierSolver.test.ts`; only the transport coverage is lost, and the transport is what is being deleted. Its `buildLargeSyntheticFrontier` helper (k independent 2-cell components, so the cross-component product grows as 2^k) has no other consumer — `bottleneckProfile.test.ts` builds its boards a different way, from real difficulty presets. Nothing reusable is lost.

### D3: `identifyFrontier` is privatized here, not deferred

It will move to `decomposition.ts` in `split-solver-modules` regardless, so privatizing it now costs one keyword and means the split does not also have to decide its visibility. Same reasoning for the small unused exports: they are removed while the file is already being touched, so the later structural change moves less.

### D4: The color aliases stay exported

`NEUTRAL_MIDPOINT_COLOR` and `EIG_LOW_COLOR` were slated for removal alongside the other test-only exports, but they differ in kind: they name hex string constants rather than behavior. Removing them means copying `'#c0c0c0'` and `'#e3dff5'` into `probabilityColor.test.ts` and `informationVisualization.spec.test.ts`, where a later palette change in the module would leave the tests asserting a stale color — a duplicated definition that can silently disagree. `fromLabel` and `WORLDS_TREE_CONTRAST_CELL` carry no such risk: the first is a function with no remaining caller, the second a two-field coordinate whose value the tests already encode in their expectations.

*Decided during apply, at the user's direction, after the removal had been implemented and reverted.*

## Risks / Trade-offs

- **[Risk] A future reader finds `entropy-minesweeper` design decision 3 and its risk entry, and assumes the mitigation is live.** → The proposal's Impact section records the supersession explicitly, so the archived decision and its removal are both findable.
- **[Trade-off] Losing the only test that exercised the solver across a thread boundary.** Accepted: nothing crosses a thread boundary after this change.
