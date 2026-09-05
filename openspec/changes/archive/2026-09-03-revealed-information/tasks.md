## 1. Solver: remove superseded surprisal computation

- [x] 1.1 Remove `realizedSurprisal` from `src/solver/frontierSolver.ts` and verify no remaining references via `grep -rn "realizedSurprisal" src/`
- [x] 1.2 Remove the `realizedSurprisal`-based assertions/tests in `src/solver/frontierSolver.test.ts` (the `mineSurprisal`/`safeSurprisal` case) and `src/solver/frontierSolver.spec.test.ts` (the `surprisal` case), updating each spec's surrounding assertions so the test still exercises whatever else it was checking (e.g. `outcomeProbabilities`), and verify `npm test -- frontierSolver` passes

## 2. Game layer: compute revealed information from before/after total uncertainty

- [x] 2.1 In `src/game/revealFeedback.ts`, replace the `realizedSurprisal`-based `RevealFeedback.realizedSurprisal` field with a `revealedInformation` field computed as `preRevealSolve.totalEntropyBits - postRevealSolve.totalEntropyBits`, taking both `SolveResult`s as parameters
- [x] 2.2 Change `computeRevealFeedback` (or its replacement) so it no longer returns `null` for a non-frontier reveal: `predictedEig` becomes `null`/absent when the clicked cell isn't on the frontier, but `revealedInformation` is always computed and returned
- [x] 2.3 Update `src/game/revealFeedback.test.ts`: keep the frontier-reveal case (predicted EIG + revealed information both present) and change the former "returns null for a non-frontier reveal" case to assert `predictedEig` is null/absent while `revealedInformation` is a computed number; verify with `npm test -- revealFeedback`
- [x] 2.4 Add a test covering a cascading reveal (a board where the clicked cell has 0 adjacent mines and flood-fill opens further cells) asserting the reported `revealedInformation` reflects the whole cascade's total-uncertainty reduction, not just the clicked cell's single-cell outcome probability; verify it fails against the old single-cell computation's expected value and passes against the new one

## 3. UI: wire cascade-settled solve into the readout

- [x] 3.1 In `src/main.ts`'s click handler, ensure the `SolveResult` used for the "after" side of the diff is computed on the board state once `controller.reveal(...)` (and any cascade it triggers) has fully returned, before calling the revealed-feedback computation
- [x] 3.2 Update the reveal readout text/label from "Realized surprisal" to "Revealed information", and change the display condition so the revealed-information value renders for every reveal (not gated on `preRevealProbability !== 1` alone) while predicted EIG continues to render only when available
- [x] 3.3 Manually verify in the running app (per project convention for UI/Canvas changes — see the `no_headless_browser` note, ask the user to confirm visually if needed): clicking a frontier cell shows predicted EIG + revealed information; clicking a non-frontier cell or triggering a cascade shows revealed information alone

## 4. Spec conformance

- [x] 4.1 Run `openspec validate --change "revealed-information" --strict` and resolve any reported issues
