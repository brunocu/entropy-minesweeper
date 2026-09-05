## Context

See proposal.md - Why. The existing pipeline (`design.md` decision 4/5 of the archived `entropy-minesweeper` change) already produces, per frontier cell, both a mine probability `p` and an EIG value in the same `SolveResult.frontier` list; non-frontier cells share one pooled `nonFrontierProbability` with no per-cell EIG. `probabilityColor(p)` (`src/render/probabilityColor.ts`) draws the diverging fill; `BoardRenderer.fillColorFor` (`src/render/boardRenderer.ts`) picks it per cell and draws the white certainty ring on top for `p === 0 || p === 1`; `main.ts`'s `mousemove` and `click` handlers read `findFrontierEig` / `computeRevealFeedback` (`src/game/revealFeedback.ts`) to populate the two hover/reveal readout lines. This change only touches that display layer.

## Goals / Non-Goals

**Goals:**
- Keep the EIG-gradient and probability-hover logic as pure functions over data the solver already produces — no new solver computation, no new fields on `SolveResult`/`FrontierCellResult`.
- Keep the p=1 exclusion and the p=0 gradient symmetric with the existing certainty-ring logic (`cell.probability === 0 || cell.probability === 1`) so the three stay visually/logically consistent instead of drifting.

**Non-Goals:**
- No change to how probability or EIG are computed (`frontierSolver.ts` is untouched).
- No accessibility/colorblind-safe tuning pass beyond picking a palette distinct from the existing diverging pair — deferred to implementation using the `dataviz` skill, same as the original heatmap (per archived design.md's Open Questions).

## Decisions

**1. EIG-gradient scale is computed once per `render()` call, from the same cell list already being drawn, not memoized across frames.**
`BoardRenderer.render` already iterates every cell once per draw. Adding a first pass that collects `{eig}` for cells with `probability === 0` and frontier membership, takes min/max, then a second pass (the existing loop) that maps each such cell's EIG through that per-render range is a small constant-factor cost on top of an already O(cells) redraw — no new render loop needed, and it stays correct automatically as the board and its p=0/EIG set change every move. Alternative considered: maintaining running min/max across draws — rejected, since it would show stale scale positions after a reveal changes which cells are even in the p=0 set, and the proposal explicitly calls for per-render normalization.

**2. `RenderCell` gains an optional `eig: number | null` field; `BoardRenderer` decides frontier-vs-non-frontier membership from whether `eig` is non-null, not from a separate frontier flag.**
`main.ts`'s `toRenderBoard` already distinguishes frontier cells (present in the `probabilities` map, built from `controller.latestSolve.frontier`) from non-frontier cells (falling back to `nonFrontierProbability`). Passing each frontier cell's `eig` through the same `RenderCell` (null for non-frontier cells and for revealed/flagged cells) lets `fillColorFor` and the new gradient logic key off one field instead of introducing a second boolean that must be kept in sync with the probability lookup. Mirrors the existing `probability: number | null` convention on the same interface.

**3. New sequential palette lives alongside `probabilityColor` as a second exported function (`eigGradientColor` or similar) in `src/render/probabilityColor.ts`, not a new file.**
The two color functions share the same hex-mixing helpers (`hexToRgb`/`rgbToHex`/`mixHex`) already defined in that module; splitting the sequential scale into its own file would duplicate them or force an extra import. The module's purpose (per its existing top comment) is "p -> color mapping for the visualization," which a second scale still fits — the file's header comment gets a small addendum, not a rename.

**4. Probability-hover formatting (`P(mine): 42%`) and the EIG line stay as two separate lines in the existing `hoverReadout` div, built in `main.ts`'s `mousemove` handler.**
No new DOM element: `hoverReadout.textContent` becomes multi-line (or two child text nodes) assembled from up to two independently-computed strings (probability line, EIG line), each present only when its own condition holds (0<p<1 for the probability line; frontier and p≠1 for the EIG line). This keeps the existing single-readout-element structure rather than adding a second dedicated element for probability.

**5. The p=1 exclusion is implemented by checking the cell's own probability at the call site (`main.ts`), not by having `findFrontierEig`/`computeRevealFeedback` return `null` for p=1.**
`findFrontierEig` and `computeRevealFeedback` (`src/game/revealFeedback.ts`) already return the `FrontierCellResult`/derived feedback for any frontier cell; their existing null cases mean "not a frontier cell" (per their doc comments — "only frontier cells have one (6.1)" and "no predicted EIG to compare against"). Overloading that same `null` to also mean "frontier cell, but p=1" would conflate two different reasons for absence and make the functions' contracts harder to state precisely. `main.ts` already has the frontier cell's probability at hand (from `controller.latestSolve.frontier` / the pre-reveal solve), so the exclusion is a simple guard at the two call sites instead.

## Risks / Trade-offs

- **[Risk] Two independently-normalized color scales (diverging probability heatmap, sequential EIG gradient) on adjacent cells could read as one continuous scale to a player who hasn't internalized the certainty-ring convention.** → Mitigation: the certainty ring already exists specifically to mark "this cell's color means something different now" (per the archived design's decision 5 and the Probability Heatmap Coverage requirement's certainty-marker scenario); this change relies on that existing marker rather than introducing a new one, consistent with how the proposal frames it ("the white border now denotes H(p)=0").
- **[Risk] A board with zero probability-0 frontier cells makes the EIG-gradient min/max computation vacuous.** → Mitigation: no rendering path depends on that range unless a p=0 frontier cell exists to consume it; the first pass simply produces an empty range and the second pass never queries it in that case.
