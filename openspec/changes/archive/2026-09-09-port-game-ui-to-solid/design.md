## Context

See proposal.md — Why.

The shape of the existing code is what the design has to answer to. `main.ts` today is:

```
  let controller                     |
  let hoveredHighlight               |  module-level mutable state,
  let lastHoveredCell                |  read by draw(), written by handlers
  let plottedHistoryLength           |

  function draw() {                  |  reads all of the above and pushes to
    renderer.render(...)             |  the canvas, four text nodes, and the
    statusReadout.textContent = ...  |  chart — unconditionally, except for
    entropyReadout.textContent = ... |  one internal guard
    minesLeftReadout.textContent = ...
    if (history.length !== plottedHistoryLength) chart.update(...)
  }

  canvas.onmousemove -> mutate, then decide by hand whether to draw()
  canvas.onclick     -> mutate, then draw()
  canvas.oncontextmenu -> mutate, then draw()
  canvas.onmouseleave -> mutate, then decide by hand whether to draw()
```

The five hand-written guards are load-bearing performance work, each carrying a comment justifying it. On an Expert board a pointer crossing one 32px cell fires many `mousemove` events, and a full `draw()` repaints the canvas and rebuilds two typed arrays for uPlot. Any rewrite that redraws per event is a real regression, not a stylistic one.

## Goals / Non-Goals

**Goals:**

- Separate what the UI *shows* from when it *repaints*, so each can be read alone.
- Preserve every existing repaint optimization, expressed as a property of the state rather than as a branch in a handler.
- Validate Solid on this project's hardest case — a canvas with hand-tuned invalidation — while the decision is still cheap to reverse.

**Non-Goals:**

- Making canvas rendering declarative. `BoardRenderer` stays imperative; see Decision 2.
- Changing any visible behavior, layout, or interaction.
- Touching the solver, board, game-controller, or render modules.
- Adopting a router, a store library, or SSR.

## Decisions

### 1. Solid, over Preact/Lit/Svelte/React

The deciding criterion is not "is it declarative" but "does it preserve the repaint discipline structurally, or make me hand-write it again somewhere else?"

Solid's documented model is that a component function runs **once** and thereafter only fine-grained effects re-run; there is no virtual-DOM diff and no re-render of the component body. `createSignal` bails out on `===` by default and accepts a custom `equals`; `createEffect` tracks its dependencies automatically with no dependency array. That maps directly onto what `main.ts` does by hand.

*Alternatives considered:*

- **React** — strongest résumé signal, weakest technical fit. The VDOM model would relocate the five bailouts into `useEffect` dependency arrays and `useMemo` calls: the same braiding of logic and optimization, in new syntax.
- **Preact + `@preact/signals`** — very close to Solid on merit and reads as React to a reviewer. Rejected narrowly because Solid's fine-grained model is the native one rather than an addition, and because of Decision 6's forward path.
- **Lit** — the strongest literal "web standards" story (custom elements, no compiler). Rejected because it fixes the imperative *chrome* but leaves canvas repaint scheduling hand-managed, which is the more interesting half of the problem.
- **Svelte 5** — comparable reactivity story; rejected as a compiler plus a new file format for what amounts to one toolbar and four readouts.

### 2. The canvas stays imperative

`BoardRenderer` keeps its current interface. A `BoardCanvas` component renders a bare `<canvas>`, captures it via `ref`, constructs the renderer in `onMount`, and holds one `createEffect` that calls `renderer.render(...)`. Because that effect reads the board and highlight state, it re-runs exactly when they change and never otherwise.

Drawing a Minesweeper grid through reactive DOM nodes would be strictly worse than the current canvas on every axis. The value of the framework here is scheduling *when* to draw, not expressing *what* to draw.

### 3. The five manual guards become state properties

This is the substance of the change.

| today | becomes |
|---|---|
| `let lastHoveredCell` + `if (cell.row === last.row && cell.col === last.col) return` | a `hoveredCell` signal with `equals: (a, b) => a?.row === b?.row && a?.col === b?.col` — setting it to the same cell notifies nobody, so the guard disappears into the signal |
| `let plottedHistoryLength` + `if (history.length !== plottedHistoryLength)` | the chart effect depends on a memo of `history.length`, so it re-runs only when a reveal appends a point |
| `hadHighlight`/`hoveredHighlight` null-to-null early return | `hoveredHighlight` is a memo derived from `hoveredCell`; null-to-null is a no-op by `===` |
| `mouseleave` "nothing was highlighted, nothing to clear" | same memo, same bail-out |
| readout text set independently of canvas repaint | separate effects — text nodes and canvas no longer share one `draw()`, so updating a readout cannot repaint the board |

The last row is the real prize. Today the readout text and the canvas are updated by the same function, which is *why* the handlers need to reason about repainting at all. Splitting them means the question stops being asked.

### 4. `GameController` stays a class, behind one `equals: false` signal

The controller is replaced wholesale on new-game, and its internals mutate in place on reveal and flag. Rather than making it reactive, it lives in a single signal declared with `equals: false`, so that both kinds of change notify through one path:

```ts
const [game, setGame] = createSignal(new GameController(board), { equals: false })

setGame(new GameController(nextBoard))   // new game: fresh instance
if (!game().reveal(row, col)) return     // nothing moved, nothing to notify
setGame((g) => g)                        // reveal/flag: same instance, still notifies
```

`equals: false` is what makes the second form work — in-place mutation leaves identity unchanged, so a default `===` signal would swallow it. There is therefore exactly one way to reach the controller, `game()`, and it is always a tracked read.

The coarseness is contained by `createMemo`, which bails out on `===` and does not notify its own subscribers when its result is unchanged, even though it re-ran. A flag toggle notifies every memo, but only the ones whose value actually moved propagate: mines-left returns a new number and repaints, entropy returns the same float and stops there.

*Alternative considered:* a plain module-level `controller` variable paired with a `version` signal that dependent memos read. Rejected — the variable is untracked, so `version()` would appear in each consumer purely as a subscription, with nothing syntactically tying it to the data being read. Omit that line and the memo still compiles, still returns the right value once, and then silently never updates again: the same defect as a forgotten `draw()` call, which is precisely what Decision 3 exists to make impossible.

*Alternative considered:* converting `GameController` to a Solid store. Rejected — it would put a UI-framework dependency into `src/game/`, which is currently framework-free and well tested. The seam belongs at the UI edge.

### 5. Solid 1.x, not 2.0

Solid 2.0 is a release candidate, not stable. Independently, `@astrojs/solid-js@7.x` targets Solid 1.x, and `migrate-explainer-to-astro-mdx` depends on that integration. Adopting 2.0 now would either block that change or force a community adapter onto its critical path.

### 6. This change lands before the Astro migration

Sequencing is deliberate. Astro's Solid integration requires exactly the same `tsconfig` settings (`jsx: "preserve"`, `jsxImportSource: "solid-js"`) as the standalone `vite-plugin-solid` setup, so components written here carry over to islands unchanged. Doing Solid first tests the risky hypothesis — that fine-grained reactivity really does preserve the repaint discipline — against the hardest case, with no Astro migration in flight to confuse a regression. If Solid turns out to be the wrong call, only this change reverts.

## Risks / Trade-offs

- **Repaint regression that tests cannot see** → The bailouts are performance behavior; the suite asserts correctness. A rewrite could redraw per `mousemove` and still pass everything. Mitigation: carry each existing justification comment across to the construct that replaces it, so the intent survives review; and check repaint counts on an Expert board by instrumenting `renderer.render` during implementation rather than trusting the reactive model to have done the right thing.
- **No headless browser in this environment** → Nothing here can confirm the canvas still renders correctly or that hover feels right. Human review on a real board is a required step, and completion should not be reported without it.
- **Vitest needs the Solid plugin too** → `vite-plugin-solid` must be registered in the test config, or any future component test compiles JSX with the wrong runtime. No current test imports `main.ts`, so this bites only when the first component test is written — which makes it easy to get wrong quietly. Configure it as part of this change even though nothing exercises it yet.
- **JSX in a codebase that has none** → New file conventions (`.tsx`), a new compile path, and reviewers who now need to read two idioms. Accepted: this is the point of the change.
- **Bundle cost** → Solid adds roughly 7KB gzipped to a page that currently ships no framework. Negligible against the solver and uPlot.

## Migration Plan

1. Add dependencies, `tsconfig` JSX settings, and the plugin in both the Vite and Vitest configs. Nothing consumes them yet; the build must stay green.
2. Port the toolbar and readouts — the pure-chrome half, no canvas involved. Verify the game still plays.
3. Port `BoardCanvas` with its single render effect, including the `hoveredCell` equality function. This is the risky step; instrument repaint counts here.
4. Port the uncertainty-chart wrapper with its `history.length` memo.
5. Delete the old `main.ts` body; apply the CSS classes from `unify-design-tokens` and drop the inline styles.

Rollback: `main.ts` is replaced rather than incrementally edited, so reverting the change restores the working imperative version wholesale. Steps 2–4 are individually revertible.

## Open Questions

- Whether the readout panel is one component or four. Depends on how much state each ends up reading, which is clearest once step 2 is underway. Does not affect the approach or the task breakdown.
