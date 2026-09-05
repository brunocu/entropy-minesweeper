## Context

See proposal.md - Why/What Changes. Relevant existing machinery:

- `frontierSolver.ts` already partitions the frontier into connected components (`computeFrontierComponents`) where cross-component reasoning never applies (components only share cells via a common revealed-numbered neighbor), and already runs, per component, a Tier-0 trivial-deduction pass (`applyTrivialDeduction`) whose `forcedSafe`/`forcedMine` output is discarded after being folded into `enumerateComponent`'s backtracking.
- `boardRenderer.ts` already draws an additive inset-stroke "certainty ring" on top of a cell's fill for `p === 0 || p === 1` (`render()`, "Certainty ring" comment), which is the precedent for layering a new stroke without disturbing existing fill/marker logic.
- `main.ts` already tracks the hovered cell and maintains a text readout (`hoverReadout`) updated on `mousemove`.
- `GameController.reveal()` is the only path that calls `solveFn` and replaces `latestSolve`; `toggleFlag()` never does (flags are UI-only, consistent with the frontier-solver spec) and this remains true - the *probability/EIG* view of board state only changes on reveal, never on flag toggle or plain mouse movement. `latestExplanations` is different: per Decision 5, it now also depends on flag state, so `toggleFlag()` recomputes it (reusing the unchanged `latestSolve`) without calling `solveFn` or `recordMove()` - flag toggles still never touch `solveFn` call count or `uncertaintyHistory`, an invariant `gameController.test.ts` already asserts and this change must not break.
- `solver.worker.ts` / `solverClient.ts` / `solverProtocol.ts` already exist as scaffolding for running the exact solver off the main thread for responsiveness on large boards, though `main.ts` currently calls `solve()` synchronously and doesn't wire this in. This is the established escape hatch if a future computation ever needs to be deferred - not something this change needs to adopt itself.

## Goals / Non-Goals

**Goals:**
- Define the algorithm for computing a minimal, sufficient explanation set for a frontier cell's H(p)=0 certainty.
- Define which unrevealed cells qualify as "premise" cells within that set.
- Define when this computation runs, so hovering never triggers fresh search work.
- Define the visual encoding so clue and premise roles are distinguishable, without hiding any cell's existing certainty/fill state.
- Define how a flagged cell may shorten an explanation without weakening its soundness guarantee (every highlighted premise remains a provable fact, never an assumption borrowed from the player's flag).

**Non-Goals:**
- Non-frontier certainty explanations (out of scope per proposal.md).
- Smallest-cardinality (globally minimum) explanation sets - first-found minimal set only.
- Recursively explaining a premise cell's own certainty (its own upstream clues are not highlighted).
- Deferring the explanation computation to a Worker or idle callback. Precomputing at solve time (Decision 3) already keeps hover itself free of computation; moving the precomputation step off the main thread is a separate concern, left to the existing (currently unwired) worker scaffolding if it's ever needed.
- Trusting a flag unconditionally as a premise. A flag is only ever a *filter* over facts already proven true by real deduction (Decision 5) - it is never itself treated as evidence. An incorrect flag (one that doesn't match the real forced-mine/forced-safe result for that cell) has no effect on any explanation.

## Decisions

### 1. Explanation scope: hovered cell's frontier component only

`identifyFrontier` + `computeFrontierComponents` already guarantee no deduction needs cells outside a given cell's component (component boundary = no shared revealed-numbered neighbor, directly or transitively). So the candidate constraint set for search is exactly the revealed-numbered cells already gathered by `buildConstraints` that touch that cell's component - no new component-discovery logic needed.

### 2. Search strategy: insertion-based ("grow"), then trim for minimality

This is a recognized technique in the MUS-extraction / minimal-explanation literature - "insertion-based" (or "construction-based") MUS extraction, part of the broader "seed-and-shrink" family (see e.g. Liffiton & Sakallah's MARCO algorithm; Marques-Silva & Lynce's direct deletion-vs-insertion comparison; Junker's QuickXplain as the divide-and-conquer alternative). Insertion-based search alone only guarantees *sufficiency*; a trim (deletion-style) pass over the small accumulated set is what recovers the minimality guarantee - both phases are required, not just the first.

For a certain cell `X` (probability exactly 0 or 1) in frontier component with constraint set `C`:

1. **Layer** `C`'s constraints into BFS distance bands from `X` over the clue-adjacency graph already implicit in `buildConstraints`/`computeComponents` (clues directly touching `X` = layer 1, clues sharing a frontier cell with those = layer 2, etc.) - not raw board distance, since this is the graph actual deduction chains follow.
2. **Grow**: starting from `S = {}`, add each layer's constraints to `S` as a whole batch, layer by layer outward, rather than one clue at a time. After each layer is added, check whether `S` already forces `X` to its known value - first via the cheap Tier-0 pass (`applyTrivialDeduction(S)`), falling back to exact backtracking restricted to `S` only if Tier-0 doesn't resolve it. Stop at the first layer whose addition resolves `X`. Batching by layer avoids needing any tie-break rule among same-distance clues: only cells whose certainty required this search at all (Tier-0-only cells resolve at layer 1 and never need more) typically depend on several clues together anyway, so a same-distance batch is usually needed in full regardless of what order its members would otherwise be tried in.
3. **Trim**: run the existing deletion-based check (try removing each member of `S`, keep the removal if `X` still resolves) over this accumulated `S` only - cheap, since `S` spans only the layers actually needed, typically a small handful of constraints even when the full component is large. This step, not the layer batching, is what guarantees minimality.

Compared to a deletion-only approach (repeatedly shrinking from the full component), this avoids ever running the exact solver against a near-full-size constraint set for the common case where only a few nearby clues matter - the search naturally terminates as soon as sufficiency is reached, rather than starting there.

**Alternative considered:** deletion-based minimization only (originally proposed). Superseded - correct, but pays near-full-component cost on every hover-worthy cell regardless of how local the actual reasoning is.

**Alternative considered:** exhaustive subset search for a globally smallest explanation. Rejected per proposal.md scope decision (first-found minimal set is sufficient and avoids combinatorial cost).

**Known pitfall (accepted):** growth order can still affect which minimal set is found when a component admits more than one non-comparable minimal explanation - inherent to the MUS problem, not a defect. Layer batching removes the grow phase's tie-break question entirely (BFS layers are a deterministic property of the graph, no per-cell choice involved); the remaining determinism requirement moves to the trim phase - see Risks below.

### 3. When it runs: precomputed once per solve, and again on flag toggle - never per hover

Probability/EIG (`latestSolve`) only changes on `reveal()` (Context, above) - mouse movement never invalidates it, and flag toggles still don't either. `latestExplanations` is a second, separate pass with a wider set of triggers: it's recomputed after every `solve()` pass (on `reveal()`) as before, and, per Decision 5, also recomputed on `toggleFlag()` - since which flagged cells qualify as free premises can change without any change to `latestSolve`. Either way, explanations are computed eagerly for *every* frontier cell whose probability is exactly 0 or 1 - not lazily on the first hover of each cell.

- Stage 1 (unchanged): `solve(board)` returns frontier probabilities/EIG exactly as today; rendering is unblocked immediately, with no behavior change to this stage.
- Stage 2 (extended): `computeExplanations(board, solveResult, ...)` (or equivalent), run right after stage 1 on every `reveal()` *and* on every `toggleFlag()` (reusing the current `latestSolve` unchanged on the latter), iterates the certain frontier cells and applies Decision 2's search (now flag-aware per Decision 5) to each, producing a `Map`/lookup from cell to explanation set (clue cells + premise cells).
- The hover handler in `main.ts` remains a pure lookup into this precomputed map - no search, no memoization bookkeeping, on `mousemove`.
- `GameController.toggleFlag()` calls `computeExplanations` again but never `solveFn` and never `recordMove()` - flag toggles stay outside the uncertainty-history chart and the "one solve per settled board state" guarantee (Context, above).

This mirrors how `solve()` already eagerly computes probability/EIG for the whole frontier rather than lazily per-hover, so it's consistent with the existing architecture rather than a new pattern. Given Decision 2's typical cost (cheap for the common single/few-clue case), this stays synchronous within the same call as stage 1 for this change - no `Promise`/worker plumbing added to `GameController`, which is fully synchronous today. Structuring stage 2 as a distinct function (not inlined into `solve()`) keeps a future move onto the existing worker scaffolding (Context, above) a drop-in change if it's ever needed, without committing to that now (Non-Goals).

**Alternative considered:** compute lazily on first hover of each cell, memoized by `(latestSolve reference, cell)`. Rejected - board state changes are already known exactly (on `reveal()` only), so there's no benefit to laziness here: every certain cell is equally likely to be hovered, and computing eagerly avoids both the memoization bookkeeping and any hover-time latency, however small.

**Not pursued (noted for later):** certain cells sharing a frontier component could in principle share work across their individual searches. Not worth the complexity given Decision 2's typical cost; revisit only if profiling shows it matters.

### 4. Premise-cell criterion

Within the final trimmed set `S` for cell `X`, run the same Tier-0 trivial-deduction pass (`applyTrivialDeduction(S)`) that Decision 2's grow phase already uses. Any unrevealed cell that appears in `forcedSafe` or `forcedMine` from this pass - **whether forced mine or forced safe** - and that is a member of at least one constraint's original neighbor list in `S`, qualifies as a premise cell. Both directions count symmetrically: a neighbor already known-safe that lets a constraint's remaining count resolve is exactly as much a premise as a neighbor already known-mine that satisfies a count.

Because `S` is already minimal (Decision 2's trim step), constraints that don't contribute to forcing `X` were already dropped, so forced cells surviving this pass should, in practice, all be load-bearing for `X`'s derivation. This is not separately re-verified per premise cell - flagged under Risks below.

`X` itself is never listed as its own premise, and premise cells are not recursively expanded to show *their* forcing clues (proposal.md non-goal).

### 5. Flag-aware premises: a flag filters real facts, it never asserts new ones

Motivation: Decision 2's grow phase must pull in whatever BFS layers are needed to make a premise cell's forced status derivable *within S*. When that premise cell is already flagged by the player, forcing the search to re-derive it locally (by importing extra clue layers whose only job is to prove that one neighbor) makes the explanation larger than it needs to be for a player who already treats that cell as known.

This must not compromise the minimal-*sufficient* guarantee Decisions 1-4 establish: a highlighted premise is a proof obligation, not a hint. So a flagged cell is only ever eligible for this shortcut when it is independently, globally forced - by the real deduction over its full frontier component, not merely within the trimmed `S` under construction. The flag never supplies a fact the board doesn't already establish; it only tells the search which already-true facts the player has pre-identified, so their justifying clues don't need to be pulled into `S`.

1. **Compute real forced sets once per component, per solve.** `enumerateComponent` already computes a `fixed` map (`forcedMine`/`forcedSafe` over the component's *full* constraint set, via `applyTrivialDeduction` to a fixpoint before backtracking) and currently discards it after reducing constraints for backtracking. Expose this instead: for each frontier component, retain its real `forcedMine`/`forcedSafe` sets alongside the existing per-solve pass.
2. **Intersect with flags.** For a given component, `flagGivens = flaggedCells ∩ (forcedMine ∪ forcedSafe)` (restricted to that component's cells). This is the set of flags corroborated by real deduction; an incorrect or not-yet-provable flag is simply not in this set and has no effect.
3. **Seed, don't assert.** When running `resolvesTo`/Tier-0 for a candidate set `S` during grow and trim (Decision 2) and during premise extraction (Decision 4), seed `applyTrivialDeduction`'s `forcedSafe`/`forcedMine` accumulators with `flagGivens` before the fixpoint loop runs, rather than adding a new "given" constraint type. A `flagGivens` cell already carries its true forced value (from step 1), so seeding is sound by construction - it's the same fact Tier-0 would eventually derive, just made available immediately instead of gated behind importing its own justifying layers.
4. **Effect on grow:** a layer whose only purpose was to establish a `flagGivens` cell's status is no longer needed for that purpose (though it may still be needed to resolve `X` some other way) - `resolvesTo` can succeed at an earlier layer.
5. **Effect on premise extraction:** a `flagGivens` cell surfaced this way is still reported as a premise cell exactly as Decision 4 describes (same visual role) - the player sees the same "this cell's status is relied on" signal, just reached with a smaller clue set behind it. There is no separate third highlight role for "flag-sourced" vs. "locally-deduced" premises: both are, by construction, equally real forced facts: the only difference is which BFS layer would otherwise have been required to reveal that fact within `S`, and Decision 4's premise definition doesn't distinguish that.

**Alternative considered (Option A, rejected):** seed `forcedMine`/`forcedSafe` from every flagged cell unconditionally, without checking against a real forced set. Rejected - an incorrect flag would let `resolvesTo` report `X` as forced via an unsound argument (a false premise that happens not to contradict `X`'s true, flag-blind value). The resulting "explanation" would not actually be a proof from the board; Decision 2's entire minimal-*sufficient*-subset framing assumes every member of `S` is a real constraint, not an assumption.

**Alternative considered:** treat *any* globally-forced cell (flagged or not) as a free given, dropping the flag intersection entirely. Rejected for this change - it would shorten more explanations, but it also means a premise cell's presence would stop tracking anything the player did or perceived, which cuts against showing an explanation whose premises are the specific things the player has to already accept; scoping to flagged-and-forced keeps the shortcut tied to a cell the player has already marked as understood. Revisit only if unflagged-but-globally-forced inflation turns out to be common in practice.

### 6. Visual encoding: two-tone additive outline

- Clue cells (revealed numbered cells in the final `S`) get one outline color; premise cells (unrevealed forced cells from Decision 4) get a second, distinct outline color.
- Both are drawn as an *additive* inset stroke in `BoardRenderer.render()`, layered on top of each cell's existing fill and markers (number glyph, mine dot, certainty ring, flag) exactly the way the certainty ring is already layered on top of fill - never replacing or hiding existing rendering. A premise cell keeps its normal p=1/p=0 fill and certainty ring, with the premise outline added on top, not swapped in.
- Colors: two new categorical colors distinct from the existing diverging scale's poles (`SAFE_POLE`/`MINE_POLE` in `probabilityColor.ts`) and the existing sequential EIG scale (`EIG_LOW`/`EIG_HIGH`), so the explanation overlay never reads as "another probability/EIG value." Exact hex values are an implementation detail to select via the project's categorical palette at build time, not a spec-level decision.
- Only rendered while a qualifying cell (frontier, unrevealed, `p === 0 || p === 1`) is actively hovered; no persistent state.

**Alternative considered:** single uniform outline color for the whole explanation set. Rejected - loses the clue-vs-premise distinction the reasoning actually depends on.

**Alternative considered:** append explanation set to the existing text `hoverReadout` panel in addition to outlines. Not adopted for this change - the visual outline alone was judged sufficient; can be revisited later without any solver-side change, since the explanation-set data will already exist.

## Risks / Trade-offs

- **[Risk] Premise-cell set could theoretically include a cell not strictly load-bearing for `X`**, since Decision 4's Tier-0 pass runs to a full fixpoint over `S` rather than being individually minimized per forced cell → Mitigation: `S` itself is already minimal (Decision 2's trim step drops any constraint, and everything it forces, that doesn't affect `X`'s outcome), so in practice a surviving forced cell should always trace back to a still-present constraint that needs it. Verify with test cases during implementation rather than adding a second minimization pass.
- **[Risk] Trim-phase removal order is non-unique** - layer batching removes the grow phase's tie-break question, but the deletion trim step (Decision 2, step 3) can still find different (equally valid) minimal subsets of the grown `S` depending on the order constraints are tried for removal, when a component's constraints admit more than one minimal explanation - a known property of insertion-based MUS extraction, not a defect → Mitigation: process trim candidates in a fixed order (e.g. layer order, then board-scan order within a layer) so repeated solves of the same board state always produce the same explanation, avoiding a UI "flicker" if the same position were ever reached twice.
- **[Trade-off] Every certain frontier cell gets an explanation computed on every reveal, whether or not the player ever hovers it** → Accepted: consistent with `solve()` already eagerly computing probability/EIG for the whole frontier regardless of what's hovered, and Decision 2 keeps the typical per-cell cost small. Revisit only if profiling shows this materially slows down `reveal()` on large/heavily-coupled boards.
- **[Trade-off] `toggleFlag()` now recomputes every certain frontier cell's explanation, not just the ones near the toggled cell** → Accepted for the same reason as the reveal-time pass: Decision 5's seeding only changes Tier-0's starting accumulators, so the recompute is the same batch pass (Decision 3's stage 2) reusing the already-current `latestSolve` - no new solve, no new backtracking over unaffected components. Revisit only if profiling shows flag-toggle latency regressing on large boards.
- **[Risk] Toggling a flag on and off rapidly can flicker a hovered cell's highlighted set** (a premise cell's clue layer can appear and disappear as `flagGivens` gains/loses that cell) → Accepted: this is the correct, sound behavior (the explanation must reflect current flag state exactly), not a bug; Decision 2's fixed removal order (Risk, above) still guarantees the *same* flag state always reproduces the *same* explanation.

## Open Questions

None - all decisions needed to proceed to specs/tasks are resolved above.
