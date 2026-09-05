## 1. Cascade probability field

- [x] 1.1 Add `cascadeProbability` to `FrontierCellResult` in `src/solver/frontierSolver.ts`, sourced directly from the existing `outcomeProbabilities.get('safe:0')` computed in `computeFrontierCellResult` — no new enumeration. Verify with a unit test asserting it equals the existing `safe:0` outcome probability for a known fixture board.

## 2. Cascade-aware BFS propagation

- [x] 2.1 Implement the layered BFS propagation described in design.md Decision 2: starting from a frontier cell `x` with `p(x) = 1`, propagate `p(n) += p(parent) * zero(parent)` outward one BFS layer at a time over `x`'s unrevealed-neighbor graph, where `zero(cell)` is the exact solver probability (`cascadeProbability`, or 1/0 for a resolved cell) when `cell` is itself an enumerated frontier cell, and the density estimate `q0(cell) = (1-q)^d(cell)` otherwise (`q` = `nonFrontierProbability`, `d(cell)` = that cell's true unrevealed-neighbor count). Verify with unit tests covering: an interior cell (`d=8`), an edge cell (`d=5`), and a corner cell (`d=3`), each on a fixture board with a known local density.
- [x] 2.2 Add probability-threshold pruning (a tunable `epsilon`) so BFS expansion stops once `p(cell)` decays below it, and a hard max-node-count backstop as a safety net per design.md's "Worst-case BFS cost" risk (resolves Open Question 1 with concrete defaults rather than leaving it unbounded). Verify with a test on a large, low-density fixture board that the computation completes within a defined time/node budget.
- [x] 2.3 Skip the BFS entirely when `cascadeProbability(x) === 0` (design.md Decision 2's early-exit consequence) as a performance shortcut. Verify with a test that a frontier cell with `cascadeProbability === 0` produces `expectedCascadeInfo === 0` without walking the BFS (e.g. via a spy/call-count assertion, or by asserting equivalent output with the shortcut disabled).
- [x] 2.4 Cap each cell's accumulated reveal probability `p(n)` at 1 during BFS propagation (design.md Decision 2's correction), applied where a layer's predecessor contributions are summed so the cap also bounds what gets propagated to the next layer. Verify with a unit test on a fixture region where multiple already-processed predecessors converge on one cell such that their uncapped contributions would sum to more than 1, asserting the reported reach probability is exactly 1 (not the uncapped sum).

## 3. Per-cell entropy and composition into EIG

- [x] 3.1 Implement per-cell self-entropy `H(n)` for shadow cells per design.md Decision 3 (`H(n) = -q*log2(q) - (1-q)*log2(1-q) + (1-q)*H(Binomial(d(n), q) | non-mine)`), reusing the existing `shannonEntropy` helper pattern in `frontierSolver.ts` where practical. Verify with a unit test checking `H(n)` against a hand-computed value for a known `(q, d)` pair.
- [x] 3.2 Compute `expectedCascadeInfo(x) = sum over n in CascadeBFS(x), n != x of p(n) * H(n)` and add it to `eig` in `computeFrontierCellResult`, per design.md Decision 1's additive composition. Verify with a unit test on a fixture board with a known cascade-eligible cell, asserting the reported `eig` exceeds what today's single-reveal-only calculation would have produced.
- [x] 3.3 Update existing `frontierSolver.test.ts` / `frontierSolver.spec.test.ts` fixtures asserting exact single-reveal `eig` values to account for the added cascade term (per the documented **BREAKING** change in proposal.md), or introduce an internal-only accessor for the pre-cascade single-reveal figure if a test specifically needs to isolate it. Verify by running the full solver test suite and confirming it's green.

## 4. Spec scenario coverage

- [x] 4.1 Add/confirm test coverage for every scenario in `specs/frontier-solver/spec.md`'s delta: cascade-eligible cell's EIG includes a non-negative cascade term; zero cascade probability contributes exactly 0; greater estimated cascade reach yields greater EIG (two fixture cells, same single-outcome entropy, different reach); non-frontier cells still report no EIG; cascade probability matches the zero-outcome probability; a certain non-mine-adjacent-zero cell reports cascade probability exactly 0. Verify each scenario maps to a passing test.

## 5. Wiring check (no code change expected)

- [x] 5.1 Confirm `src/game/revealFeedback.ts`'s `predictedEig` (which reads `frontierResult.eig`) picks up the cascade-aware value with no code change, by running `revealFeedback.test.ts` and confirming it's still green (update fixtures only if they assert exact old single-reveal values).
