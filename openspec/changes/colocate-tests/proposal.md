## Why

`src/` holds more test files than source files (32 vs 26 today; 31 vs 23 once `remove-dead-solver-worker` lands), interleaved in the same directories, so reading a module's directory tells you nothing about which files ship. Test-only code has also leaked into production modules — a test PRNG, a board snapshotter, and a "test/debug helper" static method on `Board` — while five test files each hand-roll their own copy of the same board-literal parser.

## What Changes

- Move every `*.test.ts` into a sibling `__tests__/` directory: `src/board/__tests__/`, `src/game/__tests__/`, `src/render/__tests__/`, `src/solver/__tests__/`, `src/explainer/__tests__/`.
- Create `src/__tests__/` for cross-cutting tests and shared helpers. `informationVisualization.spec.test.ts`, which traces to a spec rather than to a source module, lands here.
- Move `src/solver/testSupport.ts` (`mulberry32`, `snapshotSolverBoard`) into `src/__tests__/support/`. It is a test file that was not named like one, imported by five tests and nothing else.
- Move `Board.fromMineLayout` off the production `Board` class into a test-side board factory. Its own docstring calls it a "test/debug helper"; it has four test callers and zero production callers.
- Replace the five duplicated `makeBoard` grid-literal parsers with one shared helper in `src/__tests__/support/`. `fixtures.parseSolverBoard` is the same idea a sixth time, but it stays in `fixtures.ts` and stops being exported: it is used only inside that module, and `fixtures.ts` itself ships (the explainer build imports it).
- `*.spec.test.ts` is treated as a plain naming convention, not a separate category — those files move alongside the rest.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change relocates files and moves test-only code out of shipped modules; no requirement under `openspec/specs/` changes. It sets `skip_specs: true`.

## Impact

- **Every test file's import paths** change by one directory level. This is the churn the change is made of; it is mechanical and the test suite is the verification.
- **`src/board/board.ts`** loses a public static method. The four tests using it switch to the test-side factory.
- **`src/solver/testSupport.ts`** and the duplicated `makeBoard` definitions are deleted.
- **No config change needed.** Vitest's default include glob (`**/*.{test,spec}.?(c|m)[jt]s?(x)`) already matches files under `__tests__/`, and `tsconfig.json` includes all of `src`, so tests stay type-checked by `npm run build` exactly as they are now.
- **Ordering:** best run after `remove-dead-solver-worker` (one fewer test file and one fewer `makeBoard` copy to move) and before `split-solver-modules`, so the solver split is reviewed without test files interleaved in the directory it is reorganizing.
