## Why

The Web Worker solver pipeline — `solverClient.ts`, `solver.worker.ts`, `solverProtocol.ts` — is built, tested, and wired to nothing. `main.ts` drives `GameController`, which calls `solve` synchronously on the main thread; no production module imports `SolverClient`. Alongside it, a handful of exports survive only because a test asserts on them. Removing all of it first shrinks the surface that the three follow-on cleanup changes have to relocate and restructure.

## What Changes

- Delete the unreached worker subsystem: `src/solver/solverClient.ts`, `src/solver/solver.worker.ts`, `src/solver/solverProtocol.ts`, and `src/solver/solverWorker.test.ts`.
- Make `identifyFrontier` private to `frontierSolver.ts`. It is exported but has only four callers, all inside its own module.
- Remove exports whose only consumers are assertions, relocating the underlying value where a test still needs it: `fromLabel` (`chessLabel.ts`) and `WORLDS_TREE_CONTRAST_CELL` (`fixtures.ts`). The `NEUTRAL_MIDPOINT_COLOR` and `EIG_LOW_COLOR` re-export aliases in `probabilityColor.ts` were considered and deliberately kept: they name hex constants, so removing them would copy the literals into two test files and let the tests drift from the module they check. A named export is the cheaper way to keep one definition.
- Drop the now-unreferenced `SolverCell`/`SolveResult` worker message types along with `solverProtocol.ts`.

Not **BREAKING**: nothing removed here is reachable from either page entry point (`main.ts`, `explainer/main.ts`) or from the Vite build.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. No capability under `openspec/specs/` mentions the worker, off-main-thread execution, or UI responsiveness during enumeration — the worker originated as design decision 3 of the archived `entropy-minesweeper` change and never became a requirement. This change sets `skip_specs: true`.

## Impact

- **Code removed:** three solver modules (~81 lines) and one test file (91 lines).
- **Design decision superseded:** `entropy-minesweeper` design.md decision 3 ("Solver runs in a Web Worker, off the main thread") and the risk it mitigated ("a large connected frontier component stalls the heatmap update"). That mitigation has not actually been in effect at any point — `main.ts` has always solved synchronously — so removing the code changes nothing about the live application's behavior under a pathological frontier. It only stops the repository from claiming a defense it does not deploy. If off-main-thread solving is wanted later, it should be reintroduced against a real requirement and actually wired into `main.ts`.
- **Coverage:** `solverWorker.test.ts` exercised `solve` through a Node `worker_threads` round-trip. The `solve` behavior it covered is already covered directly by `frontierSolver.test.ts`; only the transport is lost, and the transport is what is being deleted.
- **Tests touched:** `chessLabel.test.ts`, `figures.test.ts`, `fixtures.test.ts` adjust to the removed exports. `chessLabel.test.ts` loses its `fromLabel` round-trip and parse-error cases; `toLabel`'s mapping is asserted forward over the same positions instead.
