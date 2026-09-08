## 1. Toolchain

- [x] 1.1 Add `solid-js` and `vite-plugin-solid` at their current stable 1.x-compatible versions (design.md decision 5 pins Solid to 1.x, not the 2.0 RC); verify `npm ls solid-js` reports a 1.x version and `npm run build` still succeeds
- [x] 1.2 Set `"jsx": "preserve"` and `"jsxImportSource": "solid-js"` in `tsconfig.json`; verify `npx tsc` passes with no new errors
- [x] 1.3 Register `solidPlugin()` in `vite.config.ts` alongside the two explainer plugins; verify `npm run build` emits both entry points and the explainer illustrations still resolve
- [x] 1.4 Ensure the same plugin applies under Vitest — there is no separate `vitest.config.ts`, so confirm Vitest picks up `vite.config.ts` rather than assuming it; verify by adding a throwaway `.tsx` file that renders a trivial Solid component in a test, running `npm test`, then deleting it (design.md Risks — the plugin must be configured before the first component test exists)

## 2. Application shell

- [x] 2.1 Create `src/ui/App.tsx` mounted from a rewritten `src/main.ts` via `render(() => <App />, document.querySelector('#app')!)`, initially rendering only the existing DOM structure with the `game.css` class names (`toolbar`, `main-row`, `readout` and its modifiers) and no inline styles; verify the page loads with the old layout and no console errors
- [x] 2.2 Introduce the single `game` signal holding the `GameController`, declared with `equals: false` so both replacement on new-game and in-place mutation on reveal/flag notify through it (design.md decision 4); verify a memo reading `game().board` updates after a reveal, after a flag toggle, and after a new game

## 3. Toolbar and readouts

- [x] 3.1 Port the difficulty `<select>` (options from `DIFFICULTIES`, defaulting to Intermediate), the New Game button, and the explainer link (`import.meta.env.BASE_URL + 'explainer.html'`); verify each difficulty starts a board of the right dimensions and the link navigates to the explainer
- [x] 3.2 Port the mines-left readout as a memo over board flags rather than a field of `draw()`; verify the count decrements and increments as flags are toggled
- [x] 3.3 Port the status and entropy readouts as their own memos/effects, independent of the canvas effect (design.md decision 3, last row — splitting these is what removes the repaint question from the handlers); verify win, loss, and the entropy figure all display as before
- [x] 3.4 Port the hover and reveal readouts, including the `toLabel` / `P(mine)` / EIG line assembly and the reveal feedback line; verify hovering an unrevealed frontier cell shows all three lines and revealing prints predicted-vs-revealed information
- [x] 3.5 Decide whether the readout panel is one component or four (design.md Open Questions) and note the choice in a comment where the panel is defined; verify the readouts render identically either way

## 4. Board canvas

- [x] 4.1 Create `src/ui/BoardCanvas.tsx` rendering a bare `<canvas>` with a `ref`, constructing `BoardRenderer` in `onMount`; verify the board paints on load at the correct size for each difficulty
- [x] 4.2 Add the `hoveredCell` signal with `equals: (a, b) => a?.row === b?.row && a?.col === b?.col`, carrying across the existing justification comment about 32px cells and per-event mousemove; verify by instrumenting the setter that moving within one cell notifies no subscriber
- [x] 4.3 Derive `hoveredHighlight` as a memo over `hoveredCell` and `game().latestExplanations`, so a null-to-null transition is a `===` no-op (design.md decision 3, rows 3 and 4); verify moving between two non-explaining cells produces no canvas repaint
- [x] 4.4 Move `toRenderBoard`, `highlightRoleFor`, `countFlags`, `probabilityAt`, and `cellAt` across unchanged in behavior, keeping `pixelToCell`, `cellSolverValues`, and `probabilityColor` untouched; verify existing `src/render/__tests__` still pass
- [x] 4.5 Wire `mousemove`, `mouseleave`, `click`, and `contextmenu` to set signals only — no repaint decisions in the handlers; verify left-click reveals, right-click flags without the context menu, and leaving the canvas clears the hover readout
- [x] 4.6 Hold exactly one `createEffect` calling `renderer.render(toRenderBoard(...))`; verify with a temporary counter around `renderer.render` on an Expert board that a pointer sweep across N cells produces at most N repaints, and that a flag toggle produces exactly one (design.md Risks — the repaint regression tests cannot see)

## 5. Uncertainty chart

- [x] 5.1 Create `src/ui/UncertaintyChart.tsx` wrapping `createUncertaintyChart` behind a container `ref` in `onMount`, with chart height still derived from the Intermediate difficulty and `renderer.marginTop`; verify the chart renders aligned with the board's top edge
- [x] 5.2 Drive `chart.update` from an effect depending on a memo of `uncertaintyHistory.length`, replacing the `plottedHistoryLength` guard and carrying its justification comment across; verify by instrumenting `update` that hovering and flagging trigger zero calls while a reveal triggers exactly one
- [x] 5.3 Call `chart.reset` on new-game; verify starting a new game clears the plot to a single point

## 6. Cleanup and verification

- [x] 6.1 Delete every remaining imperative fragment of the old `src/main.ts` and remove the "until then the two states coexist" note from the header comment of `src/design/game.css`; verify no inline style assignments remain by grepping `src/ui` and `src/main.ts` for `.style.`
- [x] 6.2 Run the full gate — `npx tsc`, `npm test`, `npm run build` — and verify all three pass clean
- [x] 6.3 Human review in a browser on a real board at Expert: hover feels responsive, highlights appear on frontier cells, reveals and flags behave, the chart grows only on reveals. This environment has no headless browser, so this task is verified by the user, not by the agent, and completion is not reported without it (design.md Risks)
