## 1. Research and dependency swap

- [x] 1.1 Verify current versions of `unified`, `remark-parse`, `remark-directive`, `remark-math`, `remark-rehype`, `rehype-raw`, `rehype-mathjax`, `rehype-stringify`, `unist-util-visit`, `remark-github-markdown-alerts`, and confirm (from current docs/source, not from memory): what `rehype-mathjax/browser` emits and which `mathjax-full`-compatible CDN version/URL it expects the browser to load; and whether `remark-github-markdown-alerts` can fully suppress an alert's title bar via config
- [x] 1.2 Add the packages from 1.1 as dependencies; remove `marked`; verify `npm install` resolves cleanly

## 2. Directive mapping, alert config, and compiler scaffold

- [x] 2.1 Write a remark plugin (using `unist-util-visit`) that maps exactly six directive names to hast output: `figure` and `figcaption` (container directives → `data.hName`/`data.hProperties` for `<figure>`/`<figcaption>`), and `term-safe`/`term-mine`/`term-clue`/`term-premise` (text directives → `span.term-*`) — any other directive name throws rather than silently passing through — verify with a standalone unit test using small inline fixtures for each of the six
- [x] 2.2 Configure `remark-github-markdown-alerts` so the alert type used for `.callout` emits the existing `.callout` div/class markup (via `classNames`/`tags` config), with the title bar suppressed per 1.1's findings (or a fallback rehype transform if it can't be) — verify with a standalone unit test using a small inline fixture
- [x] 2.3 Rebuild `compileExplainer()` around a `unified()` pipeline (`remark-parse` → `remark-github-markdown-alerts` → `remark-directive` → the plugin from 2.1 → `remark-math` → `remark-rehype` with `allowDangerousHtml: true` → `rehype-raw` → `rehype-mathjax/browser` → `rehype-stringify`), keeping `computeFigureValues()`/`substituteFigures()` unchanged and applied as post-processing on the final string, and keeping the same external contract `(shellHtml, markdown) => string` — verify with a standalone unit test using a small inline fixture (not the real content yet) covering markdown prose, a figure directive, an alert, a term-span directive, embedded raw HTML, and a math span

## 3. Math spike

- [x] 3.1 Render 2-3 representative formulas from the article (at minimum one using `\binom`, one using `\operatorname`, one using nested `\tfrac`) through the new pipeline and confirm in a real browser that they typeset correctly under the `mathjax-full`-compatible CDN version identified in 1.1 — do not proceed to 4.1 until this passes

## 4. Content migration

- [x] 4.1 Rewrite `explainer.md`: convert the `.callout` div to `> [!NOTE] ...` GFM alert syntax; convert every figure/figcaption pair to `::: figure` / `::: figcaption` container directives, keeping the `<img>` tags (and, for the two-image figures, their wrapper divs) as raw HTML inside the directive body; convert every `.term-safe`/`.term-mine`/`.term-clue`/`.term-premise` span to its text-directive form; convert every `<span class="math">\(...\)</span>` to `$...$` and every `<div class="math-display">\[...\]</div>` to `$$...$$`; leave the demo widget block untouched — verify by running `compileExplainer()` against the new file and diffing the non-math content against the last known-good compiled output (ignoring only whitespace) until it matches, and manually re-checking the math against the spike from 3.1
- [x] 4.2 Update the stylesheet: retarget `.lede` to a structural selector (e.g. `#explainer h1 + p`, verified against the actual compiled DOM); retarget `.callout` if the alert plugin's output shape differs from today's hand-written div
- [x] 4.3 Regenerate `explainer.html`'s `<head>` MathJax wiring to match what the new pipeline actually requires (per 1.1) — verify the back-link, placeholder, and everything else in the shell is unchanged

## 5. Test migration

- [x] 5.1 Update `explainerPage.test.ts`'s MathJax-loading assertions (script tag, version/SRI, config ordering, delimiters, `math-pending` fallback) to match whatever the new wiring actually produces
- [x] 5.2 Decide `mathSyntax.test.ts`'s fate per design.md decision 5: either point it at an equivalent TeX-validation pipeline compatible with the new MathJax version, or retire it if the build pipeline itself surfaces bad TeX — do not simply delete the check without one or the other
- [x] 5.3 Confirm `figures.test.ts`, `illustrationFiles.test.ts`, and `compileExplainer.test.ts` still pass against the new compiler internals (their approach shouldn't need to change, only what they exercise)
- [x] 5.4 Run the full test suite (`npm test`) and `tsc --noEmit`, and verify everything passes

## 6. Final verification

- [x] 6.1 Run `npm run build` and `npm run dev`; confirm `index.html`'s output is unaffected (still a no-op for that entry)
- [x] 6.2 Manually load the built explainer page in a browser and confirm every figure and caption, the callout, the math rendering (per the version change), the certainty highlight, and the predicted-vs-realized demo all still work and look as before
- [x] 6.3 Confirm no now-unused inline HTML or leftover `marked`/`@mathjax/src` references remain (if `@mathjax/src` was retired per 5.2)
