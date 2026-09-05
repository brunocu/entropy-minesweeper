# What does any of this mean?

I made this project to answer three questions I had about Minesweeper:
What is the probability that this cell is a mine?
Which cell will give me the most information once uncovered?
And, how can I formally prove a cell is a mine (or safe)?
The game this page is attached to paints all three onto a live board;
everything below is where those numbers come from, and how to read the game board.

## Three questions

I've been playing a lot of Minesweeper lately to avoid falling asleep during class.
It's a complex enough game to keep me awake, but simple enough that I can play it without losing focus on the lecture.
That is, until it isn't.

Whenever I plant a flag, the reasoning is nearly
always the same shape: find a clue with only one way to be satisfied, and read the answer straight off it.

::::figure{.board-figure}
<img
  src="/assets/explainer/intro-trivial-board.svg"
  alt="A small covered board: the 1 at A3 has exactly one unrevealed neighbour, A2, which is ringed, and the 1 at B1 sees A1 and A2."
/>

:::figcaption
The move that produces most flags in most games. The `1` at **A3** touches exactly
one covered cell, so **A2** is a mine, there is nothing else it could be. Plant a flag.
Take that as a premise and the `1` at **B1** has its mine already accounted for, which makes
**A1** safe.

_This is how everyone starts, right?_
:::
::::

Most positions are a variation of this. Sometimes with more flags, but always a simple deduction that you can then use to make the next simple deduction, and so on.
Which makes the interesting positions the ones where this stops working, and you actually get to use your brain.

::::figure{.board-figure}
<img
  src="/assets/explainer/intro-open-board.svg"
  alt="A covered board with five unknown cells labelled A1, A2, A3, B3 and C3, where no single clue has only one way to be satisfied."
/>

:::figcaption
<span data-figure="mine-count">3</span> mines and five covered cells, and not one clue here can be resolved
on its own. The `1` at **B1** lets us know there is one at A1 or A2, but cannot say which.
The `1` at **C2** gives us the same information about B3 and C3.
The `3` at **B2** *"sees"* all five at once. Everything in view constrains *how many* mines sit in a
region without ever pinning down *which* cells are mined.
:::
::::

Nothing there is forced, and yet the covered cells are plainly not equally dangerous: some are hemmed in by
more clues than others.
Which is **the first question** in its exact form:

> Given everything visible, precisely how likely is this particular cell to be a mine?

It *has* to have an exact answer, right? After all, the board is finite, and the clues are exact.

**The second question** also comes from the same observation.
Intuitively, we know some cells are more dangerous than others, but also, which cell will tell us more about the rest of the uncovered board once we click it?
Four of the five covered cells above sit at exactly $1/2$: equally dangerous, but do we learn more from risking one over the other?

**The third question** was a surprise (to me), and we'll get to it when we get to it. It is, in my opinion, the one that makes the game interesting.

<!-- cut for rewrite
and it is why the game has an explainer at all. I expected the cells
the solver called certain — exactly $0$ or exactly
$1$ — to be precisely the ones my by-eye rule already caught. They were not. The
board above has one: no clue on it settles anything alone, and yet one of those five covered cells holds a mine
in *every* arrangement the clues allow.

A probability of exactly $1$ is not a strong opinion. It is
[entailment](https://en.wikipedia.org/wiki/Logical_consequence): the clues, read as a logical
statement, leave no alternative. So a derivation exists — and an enumeration that checks every arrangement is
not that derivation. The third question is therefore what a proof of certainty looks like, and how small it can
be made. What that search returns has a formal name, a
[minimal unsatisfiable subset](https://en.wikipedia.org/wiki/Unsatisfiable_core), and it is what the
game highlights when you hover a certain cell.
-->

## A board, formally

Fix a board with $M$ mines still unaccounted for and a set
$U$ of unrevealed cells. A **possible world** is an assignment
$w : U \to \{0, 1\}$ — one bit per unrevealed cell,
$1$ means "mine". Most such assignments are nonsense. A world is
**consistent** when it satisfies every constraint the visible board imposes: for each revealed
cell $c$ showing the number $n_c$, with unrevealed
neighbourhood $N(c)$,

$$
\sum_{x \in N(c)} w(x) = n_c \quad \text{for every clue } c, \qquad \sum_{x \in U} w(x) = M \tag{1}
$$

That is a
[constraint satisfaction problem](https://en.wikipedia.org/wiki/Constraint_satisfaction_problem)
with binary variables and linear equality constraints. Write
$W$ for its solution set — every arrangement of mines the board has not yet ruled
out. Everything on screen is a function of $W$.

The by-eye rule from the introduction is one special case of (1): a single equation whose right-hand side
equals the number of unknowns in it, or is zero, has exactly one solution, so you can read that equation alone
and move on. The first question is what happens when no equation is that obliging and the system has to be
taken as a whole.

One modelling assumption gets us from a *set* of worlds to a *distribution* over them. The mines
were placed uniformly at random at the start of the game (mostly), so before any clue every arrangement was equally
likely; conditioning that uniform prior on the observed clues leaves a posterior that is uniform over exactly the
surviving arrangements.

## Where a probability comes from

With $W$ in hand, a cell's mine probability is a
[marginal](https://en.wikipedia.org/wiki/Marginal_distribution), and computing it is counting:

$$
P(x \text{ is a mine}) = \frac{\bigl|\{\, w \in W : w(x) = 1 \,\}\bigr|}{|W|} \tag{2}
$$

Here is that formula on the board from the introduction — the one where no clue could be resolved alone.
Five cells are unknown, and the tree branches on each in turn: mine or safe.
A complete tree would end in $2^5 = 32$ leaves, but most branches die long before that: once a partial
assignment contradicts one of the equations in (1), every completion of it is impossible, so the drawing cuts
the branch there and marks it.

::::figure{.figure-wide}
<div class="root-board-panel">
  <img
    src="/assets/explainer/worlds-tree-board.svg"
    alt="The toy board the worlds tree enumerates: three mines, five unknown cells labelled A1, A2, A3, B3 and C3, with A2 ringed as the cell under discussion."
  />
</div>
<div class="figure-scroll">
  <img
    src="/assets/explainer/worlds-tree-probability.svg"
    alt="The pruned search over the five unknown cells: each branch stops where the clues rule it out, leaving twelve tips of which four are consistent worlds, each labelled with its weight, and the two where A2 is a mine are highlighted and bracketed."
  />
</div>

:::figcaption
<span data-figure="mine-count">3</span> mines, <span data-figure="unknown-count">5</span> cells still
unknown (<span data-figure="unknown-labels">A1, A2, A3, B3, C3</span>), and the branching search over them,
each dead branch cut at the depth the clues kill it.
<br />
The highlighted branches are the surviving worlds where A2 is a mine. Their weights sum to
<span data-figure="focus-probability">50.0%</span>,
because A2's mine probability is just the count of surviving branches where A2 is a mine over the
count of valid branches: $2/4$.
<br />
A3 is the cell the introduction promised: it is a mine in all four surviving worlds, so it comes back at
$P = 1$ and we can be certain it is a mine, even though no one clue on this board settles
anything on its own.
:::
::::

## Frontier and non-frontier

Fact: most unknown cells are not adjacent to any clue.
Split $U$ in two. A **frontier** cell is adjacent (including diagonal adjacencies) to at least one revealed number
and therefore appears in at least one equation of (1). A **non-frontier** cell appears in none —
it is out in untouched board, and the clues say nothing about it individually.

The non-frontier region enters only through counting. Let
$K$ be its size, and let a frontier assignment
$a$ place $m(a)$ mines. Then
$R(a) = M - m(a)$ mines are left to scatter over
$K$ cells, which can be done in $\binom{K}{R(a)}$
ways. So each frontier assignment stands for that many full worlds, and (2) becomes a weighted count:

$$
Z = \sum_a \binom{K}{R(a)}, \qquad P(x \text{ is a mine}) = \frac{\sum_{a \,:\, a(x) = 1}
  \binom{K}{R(a)}}{Z} \tag{3}
$$

The weights
$\mu(a) = \binom{K}{R(a)} \big/ Z$ are why a frontier arrangement that uses up
more mines is *less* likely when few mines remain: it leaves fewer ways to fill the rest of the board.
This is a
[hypergeometric](https://en.wikipedia.org/wiki/Hypergeometric_distribution)
weighting.

### Why pooling the non-frontier is exact

Every non-frontier cell is shown one number, computed once for the whole region. That pooled value is not an
approximation of the per-cell answer, it *is* the per-cell answer.
Fix a frontier assignment $a$. Given
$a$, the $R(a)$ remaining mines are uniform over the
$K$ non-frontier cells, so for any single non-frontier cell
$y$, $P(y \mid a) = R(a)/K$ — a value that does not
mention $y$. By the
[law of total expectation](https://en.wikipedia.org/wiki/Law_of_total_expectation),

$$
P(y \text{ is a mine}) = \sum_a \mu(a) \, \frac{R(a)}{K} = \frac{\mathbb{E}[R]}{K} \quad \text{for every
  non-frontier } y. \tag{4}
$$

> [!NOTE]
>
> The right-hand side is the same for every non-frontier cell, so solving one of them individually returns
> precisely the pooled number. The underlying reason is
> [exchangeability](https://en.wikipedia.org/wiki/Exchangeable_random_variables): no clue
> distinguishes one non-frontier cell from another, so any world that mines cell
> $y_1$
> has a mirror world, equally consistent and equally weighted, that mines
> $y_2$ instead.

## Reading the heatmap

Each unrevealed cell is filled by its probability on a diverging scale:
:term-safe[deep blue] at $P = 0$, a pale neutral at
$P = 0.5$, :term-mine[red] at
$P = 1$.

To avoid confusion with probabilities *very close* to $0$ or $1$, exact certainty also draws a white ring inside the cell.
Certain-*safe* cells get one further treatment: instead of flat blue they are filled from a violet ramp keyed to how much information we expect to gain from revealing them.
They are all equally safe to click.

## Uncertainty, in bits

How much is left to know? The standard answer is the
[Shannon entropy](https://en.wikipedia.org/wiki/Entropy_(information_theory))
of the posterior over worlds, measured in bits:

$$
H(W) = -\sum_{w \in W} \mu(w) \log_2 \mu(w) \;=\; \log_2 Z \quad \text{when every world weighs the same.}
  \tag{5}
$$

That second form is the one to hold on to. When the weights are uniform, total uncertainty is just the log of
the number of possible arrangements.
Eight consistent boards is $3$ bits. One consistent board is $0$ bits, and the
game is solved whether or not you have finished clicking (there is nothing left to discover).
The chart beside the board plots this number after every move.

## Expected information gain

The second question. Probability tells you which cell is least likely to end your game; it says nothing about
which cell is worth clicking. Let
$O_x$ be the random variable
for what revealing cell $x$ would show — either a mine, or a number
$0$ through $8$. Before revealing, we can compute the
distribution of $O_x$, and how much each of its answers would cut
$W$ down. **Expected information gain** is that cut, averaged:

$$
\operatorname{EIG}(x) = H(W) - \sum_o P(O_x = o) \, H(W \mid O_x = o) = I(W ; O_x) \tag{6}
$$

The middle term is
[conditional entropy](https://en.wikipedia.org/wiki/Conditional_entropy), and the whole expression
is the
[mutual information](https://en.wikipedia.org/wiki/Mutual_information)
between the board's hidden state and the answer this cell would give.

There's a simplification worth knowing. If every unrevealed neighbour of
$x$ is itself on the frontier, then the answer is already determined by the rest of the board:
$H(O_x \mid W) = 0$, and by the symmetry of mutual information,

$$
\operatorname{EIG}(x) = H(O_x) - H(O_x \mid W) = H(O_x). \tag{7}
$$

So in the clean case, a cell's EIG is simply the entropy of its own answer distribution — how unpredictable
the cell's reading is. A cell whose answer you can already guess teaches you nothing; a cell with several
readings, none of them a foregone conclusion, teaches you a lot.

::::figure{.figure-wide}
<div class="root-board-panel">
  <img
    src="/assets/explainer/worlds-tree-board.svg"
    alt="The toy board the worlds tree enumerates: three mines, five unknown cells labelled A1, A2, A3, B3 and C3, with A2 ringed as the cell under discussion."
  />
</div>
<div class="figure-scroll">
  <img
    src="/assets/explainer/worlds-tree-eig.svg"
    alt="The same pruned search re-branched so A2 splits first, with the surviving worlds bracketed into the outcome groups revealing A2 would produce."
  />
</div>

:::figcaption
The same position and the same
<span data-figure="world-count">4</span> surviving worlds,
bracketed by what revealing A2 would show. Each bracket is
$W \mid O_x = o$ — the worlds still standing after that answer.
:::
::::

On this board **A1**, **A2**, **B3** and
**C3** all carry exactly the same $1/2$ risk, but they are not
equally worth clicking. **A1** borders only one unknown cell, A2, so its reading can only ever
answer a single yes-or-no — mine, or a <code>1</code>, each equally likely. By (7) that is
$H(1/2, 1/2) = 1$ bit: it halves four worlds to two.

**A2** borders three unknowns: A1, A3 and B3, so its reading has somewhere to vary. It comes
back a mine half the time, and otherwise as a <code>2</code> or a <code>3</code> depending on B3, each a
quarter of the time. Three answers, unevenly weighted, so

$$
\operatorname{EIG}(\text{A2}) = H\!\left(\tfrac{1}{2}, \tfrac{1}{4}, \tfrac{1}{4}\right) =
  -\tfrac{1}{2}\log_2\tfrac{1}{2} - 2 \cdot \tfrac{1}{4}\log_2\tfrac{1}{4} = 1.5 \text{ bits.} \tag{8}
$$

Identical probability, half a bit more information. And unlike A1, two of A2's three answers let us solve the rest of the board
outright.
*Which cell is least likely to kill me* has four tied answers here, and
*which cell teaches me most* breaks the tie.

## Predicted versus realized

EIG is an expectation, a claim about the average over answers you have not received yet. When you actually
click, you get one answer, and that answer carries its own amount of information. Under a uniform posterior,
that amount has a name: the
[self-information](https://en.wikipedia.org/wiki/Information_content), or surprisal, of the outcome
you drew.

$$
i(o) = H(W) - H(W \mid o) = \log_2 \frac{Z_{\text{before}}}{Z_{\text{after}}} = -\log_2 P(o) \tag{9}
$$

Rarer answers carry more information.

The widget below is a little demo of that. It's the same position as the trees above, and
**A2** is live. Click it! An outcome is drawn at random, weighted by its real solver-computed
probability, and when it's revealed you will see how much information it actually carried.

<div class="demo" id="predicted-vs-realized">
  <div class="demo-board"><canvas id="demo-canvas"></canvas></div>
  <dl class="demo-readouts">
    <div class="demo-readout">
      <dt>Predicted EIG</dt>
      <dd id="demo-predicted">—</dd>
    </div>
    <div class="demo-readout">
      <dt>Realized information</dt>
      <dd id="demo-realized">—</dd>
    </div>
    <button type="button" id="demo-reset" disabled>Re-roll</button>
  </dl>
  <p id="demo-narration"></p>
</div>

Re-roll it a few dozen times. Half the draws come back as a mine, which rules out the two worlds where A2 was safe
and pays out $\log_2(4/2) = 1$ bit. The other half come back as a `2` or a
<code>3</code>, each of which pins the board to a single world and pays
$\log_2 4 = 2$ bits. Neither number is $1.5$. But the prediction is the
average of the outcomes, and nothing more was ever claimed for it.

## Why a cell is certain

The third question, and the part I did not see coming. A cell at exactly
$0$ or exactly $1$ is not the solver being bold; it
is the solver reporting that the clues admit no alternative — and a fair number of those cells were ones I
would never have flagged by eye. If a cell is certain then a derivation exists, and the enumeration that
proved it is not that derivation. "None of the 4,096 surviving worlds mines this cell" is true, complete, and
explains nothing.

The argument is easier to find if you turn the claim around. Take the constraints in (1) and add the
*negation* of what the solver reports: assert that this certainly-safe cell is a mine. The resulting
system has no solution. Any subset of it that still has no solution is by itself a sufficient reason for the
original conclusion, and a subset that is
[minimally](https://en.wikipedia.org/wiki/Unsatisfiable_core)
so, that is, no clue can be dropped without it becoming satisfiable again, is exactly the kind of self-contained argument
we're looking for. That object is a **minimal unsatisfiable subset** — the standard name,
borrowed from formal logic, for a set of facts that forces a conclusion and has nothing in it to spare.

The solver extracts one the following way: grow a candidate set of clues outward from the cell, breadth-first,
until the deduction goes through, then try dropping each clue in turn and keep the drop whenever the deduction
survives without it. What is left is minimal (though not necessarily the smallest possible, or the only one).

On the introduction's board that search comes back with three clues and no premises:
<span data-figure="open-board-certain-clues">B1, B2, C2</span> together force
<span data-figure="open-board-certain-cell">A3</span> to be a mine, and dropping any one of the three leaves an
arrangement where it isn't.

Hovering a certain cell in the game highlights what survives that trimming: the revealed
:term-clue[clues] the argument rests on, in aqua, and any unrevealed
:term-premise[premise] cells whose own forced status it leans on, in green.

::::figure
<img
  src="/assets/explainer/certainty-board.svg"
  alt="A toy board where C1 is certainly safe, with its two clue cells highlighted in aqua and its premise cell in green."
/>

:::figcaption
A different board state, with one certainly-safe cell. Read it in two steps.
<br />
The aqua `1` on the right has exactly one unrevealed neighbour, so that neighbour must be
the mine, the green premise.
<br />
The other aqua `1` sees only that premise and the ringed cell, and
its single mine is already spoken for, so the next cell is safe.
<br />
In full: <span data-figure="certainty-focus">C1</span> is certainly safe because of the clues at
<span class="term-clue" data-figure="certainty-clues">D2 and E2</span>, given that
<span class="term-premise" data-figure="certainty-premises">D1</span>
must be a mine.
:::
::::

## Reading the uncertainty chart

Beside the board, the game plots $H(W)$ from (5) against total moves. It starts
high, ends at zero, and the shape between is a record of how the game went. Because each move's drop is the
realized information of that move, and the drops form a telescoping series, the reveals of a finished
game sum to exactly the uncertainty the board started with.

::::figure
<div class="figure-scroll">
  <img
    src="/assets/explainer/uncertainty-chart.svg"
    alt="Total uncertainty in bits against total moves, falling from 42 to zero, annotated with one steep single-move cliff and one flat multi-move stretch."
  />
</div>

:::figcaption
An example trace. The annotated cliff is a single reveal that cascaded and eliminated most of what was still
unknown. The flat stretch is three reveals that each confirmed something the solver had already pinned down.
:::
::::

Cliffs are high-surprisal moves: by (9), a reveal that cuts the world count by a factor of a thousand pays
about ten bits, and the line falls off. Flat stretches are the opposite: reveals that were safe,
correct, and nearly pointless, because $P(o)$ was already close to $1$ and
$-\log_2 P(o)$ close to $0$. A long flat run usually
means you were clearing cells the solver had already marked certain.
