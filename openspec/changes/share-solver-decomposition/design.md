## Context

See proposal.md — Why. Two facts from the current code constrain the approach.

**The two consumers disagree about flags, and must keep disagreeing.** `enumerateWorlds` signs each component with `EMPTY_FLAGGED_CELLS`; `computeExplanations` signs with the real flagged set. That is not an oversight — `enumerateComponentFull`'s result never depends on flags, and the `frontier-solver` spec requires that two board states differing only in a flag report identical probabilities, EIG, and total uncertainty. Whatever is shared between them must be strictly flag-free.

**The consumers are not called in lockstep.** `GameController.reveal` calls `solve` then `computeExplanations`; `GameController.toggleFlag` calls `computeExplanations` alone, against the previous `solve`'s result. So the shared value cannot be something `solve` produces on its way through.

## Goals / Non-Goals

**Goals:**
- Compute the board decomposition once per board state, not once per consumer.
- Make it structurally impossible to pair a decomposition with the wrong board.
- Remove the hand-rolled frontier lookups without inventing a second way to do the same thing.

**Non-Goals:**
- Changing any reported value. Probabilities, EIG, explanations, and total uncertainty are identical before and after.
- Touching the component cache scheme, the enumeration, or QuickXplain. This change is about what happens *before* those run.
- Micro-optimizing the render path beyond what falls out of D4 — see D6.
- Consolidating the `${row},${col}` key convention duplicated across nine non-solver modules. Still real, still separate.

## Decisions

### D1: `Decomposition` carries the board it was derived from

```
  decompose(board) -> Decomposition {
      board                    the SolverBoard this was derived from
      frontierCoords           \
      frontierKeys              |  today rebuilt in both consumers
      frontierSet               |
      frontierCoordByKey        |
      constraints               |
      components                |
      componentSlices           /  per component: cells + relevantConstraints
      nonFrontierCells         only enumerateWorlds builds this today
      numberedCoordByKey       only computeExplanations builds this today
  }

  solve(decomposition, cache)
  computeExplanations(decomposition, solveResult, flaggedCells, cache)
```

Holding `board` inside the value means callers cannot desynchronize the two arguments, which is the failure mode a `(board, decomposition)` pair invites. It also collapses the signatures to one required argument each.

*Alternative considered:* keep `solve(board, cache)` and memoize decomposition behind a `WeakMap` keyed on the board object. Rejected — it makes a real cost invisible, ties correctness to object identity in a codebase that freely constructs fresh `SolverBoard` literals, and hides the very thing this change exists to make explicit.

*Alternative considered:* `analyze(board)` returning solve result and explanations together. Rejected — `toggleFlag` needs explanations against an unchanged solve, so a combined entry point would either recompute the solve or grow a mode flag.

### D2: The decomposition holds no flag-dependent value

`componentSlices` carries each component's cells and its `relevantConstraints` filter result — the O(components x constraints) scan currently paid twice — but **not** the component signature. Signatures stay with each consumer, because they are the one part of the per-component setup that depends on flags: `solve` signs with the empty set, `computeExplanations` with the real one. Drawing the line here is what preserves the spec invariant in D-Context, and it is why the `Decomposition` type deliberately has no flag field to pass one in.

### D3: `SolveResult` gains `frontierByKey`

A `readonly frontierByKey: ReadonlyMap<string, FrontierCellResult>` built once where the frontier is built. Consumers read `frontierByKey.get(key)?.probability` in place of seven `frontier.find(...)` scans and three hand-built probability/EIG map pairs.

Carrying a derived index on a result record is already this codebase's convention, not a new pattern: `WorldEnumeration` carries `frontierKeys` and `frontierSet` beside `frontierCoords`, and `ComponentIndex` is nothing but build-once lookup maps. `frontier` stays as-is — it is ordered, and `enumerateWeightedWorlds` and the worlds-tree drawing depend on that order.

*Alternative considered:* a free `frontierIndex(result)` helper. Rejected on the convention above — a helper would be rebuilt at each call site, which is the pattern being removed.

### D4: `buildTree` gets both views from one enumeration

`worldsTree.ts:buildTree` calls `enumerateWeightedWorlds(board)` and `solve(board, new Map())` back to back — two full world enumerations of the same board.

An earlier draft of this decision said the second was used only to read one frontier cell's probability, and proposed deriving that from the worlds in hand. That was wrong about the code: `buildTree` reads three values off the solve result — `focus.probability`, `focus.eig`, and `result.totalEntropyBits`. Only the first is recoverable from `worlds`. EIG needs the outcome distribution with `computeFrontierCellResult`'s hypergeometric shadow-neighbor folding, and `totalEntropyBits` is `log2(Z)`, which `enumerateWeightedWorlds` normalizes away and never exposes. Deriving either in the explainer would re-implement solver arithmetic outside the solver — the opposite of what this change is for.

`solve` and `enumerateWeightedWorlds` are already two views of a single `enumerateWorlds` call. So: expose one entry point returning both, make each of them a thin wrapper over it, and have `buildTree` call it once. One enumeration instead of two, and every number the illustration quotes still comes straight from the solver.

This removes rather than manages the numeric risk the earlier draft carried: nothing is recomputed a second way, so there is no second way for it to disagree. `worldsTree.test.ts` and the explainer's `focus-probability` figure value still pin the values.

### D5: One decomposition-and-solve per explainer fixture, threaded explicitly

`renderBoardSvg`, `renderCertaintyBoard`, `renderWorldsTree`, and `computeFigureValues` each solve their fixture independently. Rather than adding a build-time cache, the solved result becomes a parameter that `buildIllustrationFiles` and `computeFigureValues` pass down. Explicit threading over memoization for the same reason as D1: the point is that there is one authoritative solve of each fixture, and a cache would leave the multiple call sites in place while merely making them cheap.

### D6: Guard the redraws rather than optimize the redraw

`draw()` runs on every `mousemove`. The cost is not where a glance suggests:

```
  per draw()                                  changes when
  ------------------------------------------  ----------------------
  uncertaintyChart.update -> plot.setData     per reveal
    two fresh arrays + full uPlot repaint     (recordMove only)
  BoardRenderer.render, full canvas           per move or hover
  RenderBoard matrix, ~480 cell objects       per move or hover
  probability + EIG map builds                per move   [D3 removes]
  countFlags, ~480-cell scan                  per flag toggle
```

The chart repaint dominates, and its data is provably identical between reveals. Cutting the calls is therefore worth more than making each one cheaper, and it subsumes the question: a `RenderBoard` rebuild that does not happen needs no memoizing.

Six guards, each keyed on something that demonstrably did not change:

| Handler | Skip when |
|---|---|
| `mousemove` | the pointer is still in the cell it was in on the previous event |
| `mousemove` | no highlight before and none after — the canvas output is identical, and only `hoverReadout`'s text changed |
| `mouseleave` | `hoveredHighlight` was already `null` |
| `click` | `controller.reveal` returned `false` (flagged cell, already-revealed cell, or finished game) |
| `contextmenu` | the event hit no cell |
| `contextmenu` | the toggle was a no-op |

The last one needs `GameController.toggleFlag` to return a boolean instead of `void`; `Board.toggleFlag` already reports it and the controller currently discards it (`gameController.ts`). Separately, `uncertaintyChart.update` moves behind a check that the history actually grew, so a board-only redraw does not repaint the chart.

The same-cell guard is the load-bearing one: it converts hover redraws from one per `mousemove` event to one per cell transition. Cells are 32px, so a pointer crossing one currently fires however many move events the browser emits over that distance and repaints identically each time; the exact ratio depends on pointer speed and event coalescing and has not been measured.

*Alternative considered:* memoize the move-scoped parts of `draw()` and keep calling it per event. Rejected — it makes every redraw cheaper while leaving the chart repaint, which is the expensive part, either still running or needing its own guard anyway. Guarding the call is simpler and strictly stronger.

*Alternative considered (previously chosen here):* move `highlightRole` off `RenderCell` and pass highlight sets to `BoardRenderer.render` separately, making `RenderBoard` purely move-scoped and memoizable. No longer relevant — with the guards in place there is nothing left to memoize, and the renderer API stays as it is.

### D7: One name for the cell-fill rule; the two conversions stay separate

The original decision here was to merge `main.ts`'s and `explainer/revealDemo.ts`'s `SolveResult` + board -> `RenderBoard` conversions into one function in `render/` taking an optional reveal overlay, on the premise that the overlay was their only difference. It set its own bar: *the overlay stays the only difference; a second divergence is a signal to split them again rather than add a second parameter.*

Read side by side, that premise is false and the bar is not met. They differ three ways:

| field | `main.ts` | `revealDemo.ts` |
|---|---|---|
| `revealed` | `cell.revealed` | `cell.revealed \|\| isRevealedTarget` |
| `flagged` / `isMine` | from `Board` | `false` / from the overlay (`SolverBoard` has neither) |
| `adjacentMines` | `cell.adjacentMines` | overlay-substituted |
| `probability` / `eig` | **identical** | **identical** |
| `highlightRole` | `highlightRoleFor(cellKey)` | always `null` |

Merging would need an overlay parameter *and* a highlight callback *and* a board type widened over `Board`/`SolverBoard` — exactly the per-caller flag accretion the bar was set against. So the rule this decision gave for that case applies: leave the two conversions where they are.

What is genuinely shared is one *rule*, not one function: **a revealed cell has no fill; otherwise take its frontier entry's value, falling back to the pooled non-frontier probability.** That rule is written out three times — `main.ts`, `revealDemo.ts`, and `boardSvg.ts`. D7 originally expected `boardSvg.ts` to share only the lookup maps, which D3 removes; the rule itself survived D3 in all three. It gets one name in `render/`, and all three call it. Each keeps its own loop and its own per-caller fields.

The three copies had already started to drift — `boardSvg.ts` does not null `eig` on a revealed cell, relying on revealed cells having no frontier entry. Equivalent today, and precisely the failure mode one named rule prevents.

## Risks / Trade-offs

- **[Risk] A flag-dependent value leaks into the shared decomposition, breaking the "flagged and unflagged states solve identically" requirement.** → D2 keeps signatures out of the decomposition, and the `Decomposition` type has no flag field to pass one through. The existing flag-invariance test — `'flagging a cell does not satisfy a neighbor's mine count'`, in `decomposition.test.ts`'s Tier 0 block — is the direct check; run it before anything else.
- **[Resolved] D4 changing a reported number.** The original approach recomputed the focus probability a second way and could have drifted from the solver's. The approach D4 now takes derives nothing by hand — both views come from one enumeration — so there is no second computation to disagree. The worlds-tree tests and the `focus-probability` figure value still pin the values.
- **[Risk] The call-counter tests (`cachePerformance`, `bottleneckProfile`) start failing because the work legitimately stopped happening twice.** → Expected, and the point. Those assertions get updated to the new counts, which is how this change proves it worked. Per house rule, a test broken by a deliberate spec-valid change is rewritten, not preserved.
- **[Risk] A missed invalidation leaves a stale screen — the one failure mode here that no test catches.** Every other item in this change is output-identical and pinned by the solver suite; D6 changes *when* rendering happens, and a wrong guard shows as a highlight that will not clear or a mines-left count that will not update, with every assertion still green. This project also has no headless browser, so it cannot be checked in the sandbox. → Treat manual browser verification as part of the definition of done, not as a follow-up: hover across cells and within a single cell, click a flagged cell, flag and unflag, mouse off the board, and start a new game, confirming the chart advances per reveal and resets. If a guard is uncertain, leave the redraw in — an unnecessary repaint is a cost, a missed one is a bug.
- **[Trade-off] ~10 call sites take a new argument shape**, several of which currently pass a throwaway `new Map()` and will pass a fresh `decompose(board)` alongside it. More ceremony at one-shot explainer call sites, in exchange for the two-consumer path in `GameController` — the only hot one — doing the work once.
- **[Risk] Sequencing.** This change assumes `split-solver-modules` has landed so `decompose` has a module. If the order slips, `Decomposition` would be added to the monolith and moved immediately after.
