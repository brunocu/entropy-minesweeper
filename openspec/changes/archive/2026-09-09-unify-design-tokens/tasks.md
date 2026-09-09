## 1. Token module and generator

- [x] 1.1 Add `src/design/tokens.ts` exporting the canonical token set (`ink`, `inkSoft`, `rule`, `surface`, `page`, `safe`, `mine`, `eig`, `clue`, `premise`, plus `neutral` midpoint, `eigLow`/`eigHigh` ramp endpoints, and the neutral-ramp steps for flagged and unknown-probability fills), copying values verbatim from `explainer.html`'s `:root` block and `probabilityColor.ts`; carry each dataviz-palette slot/reason comment across unchanged. Verify with `npx tsc --noEmit` and by diffing the new literals against the two existing sources — every value must already appear in one of them.
- [x] 1.2 Add `scripts/generate-tokens.mjs`, a plain Node script that reads the token module and writes `src/design/tokens.css` as a single `:root` block of `--<kebab-name>: <value>;` lines with a "generated — do not edit" header. Verify by running `node scripts/generate-tokens.mjs` and confirming the emitted file contains one custom property per exported token.
- [x] 1.3 Wire the generator into `package.json` as `predev` and `prebuild`, and commit the generated `src/design/tokens.css`. Verify `npm run build` regenerates the file and leaves the working tree clean.
- [x] 1.4 Add a freshness test under `src/design/__tests__/` that regenerates the CSS in memory and asserts it matches the committed `tokens.css` byte-for-byte. Verify it passes with `npm test`, then confirm it *fails* after editing a token value without rerunning the generator, and restore.

## 2. Point existing consumers at the tokens

- [x] 2.1 Replace `probabilityColor.ts`'s local `SAFE_POLE`, `MINE_POLE`, `NEUTRAL_MIDPOINT`, `EIG_LOW`, `EIG_HIGH`, `CLUE_HIGHLIGHT`, and `PREMISE_HIGHLIGHT` literals with imports from `tokens.ts`, preserving the exported `*_COLOR` names. Verify the existing colour tests pass with `npm test` and no test file was edited.
- [x] 2.2 Delete `explainer.html`'s `:root` block and link `src/design/tokens.css` instead. Verify every `var(--…)` still referenced in `explainer.html` resolves to a property present in the generated file (grep the two files and compare the name sets), and ask the user to confirm the page is visually unchanged — this sandbox has no headless browser.

## 3. Game page stylesheet

- [x] 3.1 Add a stylesheet for the game page defining classes for the chrome `main.ts` currently styles inline — toolbar, main row, board column, and the hover / reveal / status / entropy readouts — expressed against the shared tokens, and link it plus `tokens.css` from `index.html`. Verify each inline style assignment in `main.ts` has a corresponding declaration in the new stylesheet (enumerate them side by side); leave `main.ts` untouched, per design.md — Decision 4.

## 4. Reconcile stray colors (separate commit — the only visible change)

- [x] 4.1 Replace `uncertaintyChart.ts`'s `#2b6cb0` series stroke with the `safe` token. Verify no hex literal remains in the file.
- [x] 4.2 Replace `boardRenderer.ts`'s `#e74c3c` / `#c0392b` revealed-mine fills with the `mine` token, `#1a1a1a` labels and cell numbers with `ink`, and `#7f8c8d` flagged / `#95a5a6` unknown-probability fills with the neutral-ramp tokens; settle design.md's open question (two ramp steps or three) by checking both stay distinct from the `neutral` midpoint. Verify `grep -n '#[0-9a-fA-F]\{6\}' src/render/boardRenderer.ts` returns nothing and `npm test` passes.
- [x] 4.3 Fix `boardRenderer.fillColorFor`'s stale comment citing `#f0efec` as the neutral midpoint; state the midpoint by token name rather than by value so it cannot go stale again.
- [x] 4.4 Have the user review both pages in a browser and confirm the four changed fills read correctly — no automated check covers appearance, and this step must be revertable on its own if not.
