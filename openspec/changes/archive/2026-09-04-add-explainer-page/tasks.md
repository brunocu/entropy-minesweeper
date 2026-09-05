## 1. Toy scenario fixtures

- [x] 1.1 Author the shared worlds-tree toy `SolverBoard` fixture (≤4 unknown cells, exhibiting a certain cell, an uncertain cell, and two frontier cells with a clear EIG contrast) and verify by unit test that it solves without error and has the intended mix of probabilities
- [x] 1.2 Author the distinct certainty-explanation toy `SolverBoard` fixture (produces at least one certain cell with both a clue and a premise cell in its explanation set) and verify by unit test that `computeExplanations` returns a non-empty explanation for that cell
- [x] 1.3 Author the canned uncertainty-chart trace (`UncertaintyHistoryPoint[]`) with one clear cliff and one flat stretch, and verify by a small assertion/test that the trace contains a move-to-move decrease clearly larger than a separate multi-move flat region

## 2. Solver export for demo reuse

- [x] 2.1 Add a narrowly-scoped export from `src/solver/frontierSolver.ts` returning the enumerated, weighted worlds for a `SolverBoard` (reusing existing component enumeration + mine-count weighting), and verify existing frontier-solver tests still pass unchanged
- [x] 2.2 Add a unit test for the new export against the worlds-tree fixture (1.1), asserting the returned worlds' weights sum to 1 and that summing mine-worlds' weights for a given cell matches that cell's `SolveResult` probability

## 3. Build-time illustration generators

- [x] 3.1 Implement the worlds-tree SVG generator (probability mode): renders the enumerated worlds as a pruned branching structure, marks inconsistent branches as eliminated, highlights surviving mine-branches for a designated cell; verify with a test asserting the highlighted branches' combined weight equals the designated cell's probability
- [x] 3.2 Implement the worlds-tree SVG generator (EIG mode): re-groups the same fixture's surviving branches by a designated cell's outcomes; verify with a test asserting each outcome group's branch set matches the solver's `outcomeProbabilities` partition for that cell
- [x] 3.3 Implement the certainty-explanation static board generator: renders the certainty-explanation fixture (1.2) with clue/premise highlighting baked in, reusing `CLUE_HIGHLIGHT_COLOR`/`PREMISE_HIGHLIGHT_COLOR`; verify by inspecting the generated markup contains both highlight colors on the expected cells
- [x] 3.4 Implement the uncertainty-chart static SVG generator: plots the canned trace (1.3) with annotation markers at the identified cliff and flat stretch; verify by a test asserting the generated markup contains an annotation element at each expected move index

## 4. Vite plugin wiring

- [x] 4.1 Add a second Vite HTML entry point (`explainer.html` + `src/explainer/main.ts`) and register it in `vite.config.ts`'s `build.rollupOptions.input`; verify `vite build` produces both `index.html` and `explainer.html` in `dist/`
- [x] 4.2 Implement a local Vite plugin hooking `transformIndexHtml` for the explainer entry, invoking the three generators from section 3 and injecting their markup into placeholder elements in `explainer.html`; verify by running `vite dev`, requesting `/explainer.html`, and confirming the injected SVG markup is present in the served HTML
- [x] 4.3 Verify the same injection occurs during `vite build` by building and inspecting the emitted `dist/explainer.html` for the same markup

## 5. Explainer page content

- [x] 5.1 Write the blog-style prose sections (pitch, frontier/non-frontier pooling explanation, heatmap reading, EIG meaning, predicted-vs-realized framing, certainty-explanation framing, uncertainty-chart reading) into `explainer.html`, with placeholder elements for each generated illustration from section 3
- [x] 5.2 Verify each spec scenario in `specs/explainer/spec.md` is satisfied by manually walking the rendered explainer page against each scenario

## 6. Predicted-vs-realized interactive demo

- [x] 6.1 Implement the runtime demo in `src/explainer/main.ts`: a trigger control that picks a toy-scenario outcome weighted by its real solver-computed probability and calls `computeRevealFeedback` against the worlds-tree fixture; verify with a test that repeated simulated triggers produce outcomes distributed according to the fixture's known probabilities (e.g. over many trials)
- [x] 6.2 Render the predicted EIG and realized information side by side on trigger, and verify manually that both values update together on each trigger

## 7. Main game UI entry point

- [x] 7.1 Add the "What does any of this mean?" button to the main game UI (`src/main.ts`) linking to `explainer.html`; verify by clicking it in a running `vite dev` session and confirming navigation to the explainer page

## 8. Final verification

- [x] 8.1 Run the full test suite (`npm test`) and verify it passes
- [x] 8.2 Run `npm run build` and verify it completes without errors and both entry points' output exist in `dist/`
