## Context

See proposal.md — Why. The move itself is mechanical; one part of it is not, and that is what this document is mostly about.

Constraints worth stating before the decisions:
- Vitest's default include glob (`**/*.{test,spec}.?(c|m)[jt]s?(x)`) already matches files under `__tests__/`, and there is no `test` block in `vite.config.ts` overriding it. No config change is needed.
- `tsconfig.json` includes all of `src`, so tests stay type-checked by `npm run build` after the move, exactly as now.
- `bottleneckProfile.test.ts` is gated behind `PROFILE=1` and its header documents the command to run it by path.

## Goals / Non-Goals

**Goals:**
- A source directory listing that shows only what ships.
- One shared home for test helpers, so a seventh copy of the board-literal parser is harder to write than to reuse.
- No test-only code left in a shipped module.

**Non-Goals:**
- Changing what any test asserts. Bodies move verbatim; only imports and the helper they call change.
- Excluding tests from `tsc`. They stay under `src` and stay type-checked.
- Splitting or renaming test files. `*.spec.test.ts` is treated as a naming convention and moves as-is.

## Decisions

### D1: Sibling `__tests__/` per source directory, plus `src/__tests__/` for the rest

```
  src/
    board/      board.ts  chessLabel.ts
      __tests__/  board.test.ts  board.spec.test.ts  chessLabel.test.ts
    game/       __tests__/ ...
    render/     __tests__/ ...
    solver/     __tests__/ ...
    explainer/  __tests__/ ...
    __tests__/
      informationVisualization.spec.test.ts
      support/    prng.ts  solverBoard.ts  boardFactory.ts
```

*Alternative considered:* a single top-level `tests/` tree mirroring `src/`. Rejected — it doubles the distance between a module and its test, and the author asked for colocation.

### D2: Shared helpers under `src/__tests__/support/`, imported upward

Tests in `src/solver/__tests__/` import support from `../../__tests__/support/...`. The import direction is always test -> test; no shipped module ever imports from `__tests__/`, which is the property that makes the boundary meaningful. The relative depth is uglier than a path alias would be, but adding a `tsconfig` path mapping for it is a build-config change this refactor does not need.

Three helpers land there: the seeded PRNG and solver-board snapshotter from the deleted `testSupport.ts`, and one board-literal parser replacing the five duplicated `makeBoard` definitions. The five copies differ slightly (some accept `.` for a revealed blank, some do not), so the shared version takes the union of the characters they accept — this is a widening, and no existing call site changes meaning.

### D3: `Board.fromMineLayout` moves out, and the constructor gains an optional layout

This is the one decision with a real trade-off, because the method is not a pure helper — it writes state the class keeps private:

```
  fromMineLayout(layout):
      cells[r][c].isMine = ...      <- public array, contents mutable
      computeAdjacentCounts()       <- private
      minesPlaced = true            <- private
      status = 'playing'            <- public
```

A test-side factory can set `isMine` and `status`, and can recount adjacency itself, but it cannot set `minesPlaced`. That flag is load-bearing: without it the first `reveal` calls `placeMines` and overwrites the fixed layout with a random one.

**Chosen:** `Board`'s constructor takes an optional pre-placed mine layout; the test factory lives in `src/__tests__/support/boardFactory.ts` and calls it. Net production surface goes from one public static method that advertises itself as a test helper, to one optional constructor parameter — and the class stops claiming a "test/debug" API.

*Alternative considered:* leave `fromMineLayout` on `Board` and rename it to something that does not say "test helper". Cheapest option, but it keeps a method with zero production callers on a production class, which is precisely what the author asked to stop.

*Alternative considered:* move the factory out and widen `minesPlaced` and `computeAdjacentCounts` to public. Rejected — it trades one test-only public member for two, and exposes an internal invariant instead of an input.

*Alternative considered:* infer `minesPlaced` from whether any cell is a mine. Rejected — it is a behavior change to production logic in service of a test move, and it degenerates on a zero-mine board.

## Risks / Trade-offs

- **[Risk] A test is silently dropped from the suite by a bad move.** → Record the test count and pass/fail totals from `npm test` before the move and compare after; the numbers must match exactly.
- **[Risk] `bottleneckProfile.test.ts`'s documented run command breaks.** → Its header comment names the path (`PROFILE=1 npx vitest run src/solver/bottleneckProfile.test.ts`). Update the comment along with the path; the `PROFILE=1` gate itself is unaffected.
- **[Risk] D3 changes a constructor signature that every `new Board(...)` call site uses.** → The parameter is optional and trailing, so existing call sites are unchanged; only the four `fromMineLayout` callers move to the new factory.
- **[Trade-off] Deep relative imports (`../../__tests__/support/...`) in solver and explainer tests.** Accepted over introducing a path alias, which would mean touching build config for a file-move change.
