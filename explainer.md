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
  alt="A small covered board: the 1 at B3 has exactly one unrevealed neighbour, A2, which is ringed, and the 1 at B1 sees A1 and A2."
/>

:::figcaption
The move that produces most flags in most games. The `1` at **B3** is adjacent to exactly
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

Nothing there is forced, and yet the covered cells are plainly not equally dangerous: some are more restricted by
the clues than others.
Which is **the first question** in its exact form:

> Given everything visible, precisely how likely is this particular cell to be a mine?

It *has* to have an exact answer, right? After all, the board is finite, and the clues are exact.

**The second question** also comes from the same observation.
Intuitively, we know some cells are more dangerous than others, but also, which cell will tell us more about the rest of the uncovered board once we click it?
Four of the five covered cells above sit at exactly $1/2$: equally dangerous, but do we learn more from risking one over the other?

**The third question** was a surprise (to me), and we'll get to it when we get to it. It is, in my opinion, the one that makes the game interesting.

## A board, formally

Fix a board with $M$ mines still unaccounted for and a set
$U$ of unrevealed cells. Every way those mines could actually be arranged is a
**possible world**: an assignment $w : U \to \{0, 1\}$, one binary value per
unrevealed cell, where $1$ means "mine". Most such assignments are nonsense.
A world is **consistent** when it satisfies every constraint the visible board imposes:
for each revealed cell $c$ showing the number $n_c$, with unrevealed
neighbourhood $N(c)$,

$$
\sum_{x \in N(c)} w(x) = n_c \quad \text{for every clue } c, \qquad \sum_{x \in U} w(x) = M \tag{1}
$$

In plain terms: every clue's own count of neighbouring mines has to match what it shows, and every mine on the
board has to add up to $M$ in total. That is a
[constraint satisfaction problem](https://en.wikipedia.org/wiki/Constraint_satisfaction_problem)
with binary variables and linear equality constraints.
We will write $W$ for its solution set, every arrangement of mines the board has not yet ruled
out. Everything on screen is a function of $W$.

The by-eye rule from the introduction is one special case of (1): a single equation whose right-hand side
equals the number of unknowns in it, or is zero, has exactly one solution, so you can read that equation alone
and move on. The first question then is what happens when no equation is that obliging and the system
has to be solved as a whole.

One modelling assumption gets us from a *set* of worlds to a *distribution* over them, from "these are the
arrangements that are possible" to "and here is how likely each one is." The mines
were placed uniformly at random at the start of the game, so before any clue was revealed, every
arrangement was equally likely; that starting distribution is
called a **prior**. Updating it in light of the clues (a step usually called *conditioning*) leaves a
**posterior**, the updated distribution you get out once the evidence is accounted for. Here the posterior is
still uniform, just narrowed down to the consistent arrangements.

## Where a probability comes from

Once you have $W$, "how likely is this cell to be a mine" has a very literal answer: count how many
consistent worlds mine it, and divide by how many worlds there are. In
notation, a cell's mine probability is a
[marginal](https://en.wikipedia.org/wiki/Marginal_distribution), and computing it is counting:

$$
P(x \text{ is a mine}) = \frac{\bigl|\{\, w \in W : w(x) = 1 \,\}\bigr|}{|W|} \tag{2}
$$

Here is that formula on the board from the introduction, the one where no clue could be resolved alone.
Five cells are unknown, and the tree branches on each in turn: mine or safe.
A complete tree would end in $2^5 = 32$ leaves, but most branches are ruled out inconsistent long before that.
Once a partial assignment contradicts one of the equations in (1), every completion of it is impossible too,
so we cut the branch there and mark it invalid.

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
each inconsistent branch cut at the depth the clues rule it out.
<br />
The highlighted branches are the consistent worlds where A2 is a mine. Their weights sum to
<span data-figure="focus-probability">50.0%</span>,
because A2's mine probability is just the count of consistent branches where A2 is a mine over the
total count of consistent branches: $2/4$.
<br />
A3 is a mine in all four consistent worlds, so it comes back at
$P = 1$ and we can be certain it is a mine, even though no one clue on this board settles
anything on its own.
:::
::::

## Frontier and non-frontier

Fact: most unknown cells on a real board aren't adjacent to any clue at all, they're
just plain covered squares out in the open. Split $U$ into two. A
**frontier** cell is adjacent (including diagonally) to at least one revealed number, so it shows up in at
least one equation of (1). A **non-frontier** cell appears in none of them, it is out on open board, away
from every clue, and the clues have nothing to say about it individually.

That second group only matters through how many mines it holds in total, never which specific cells hold them,
so we consider it as one lump sum instead of cell by cell. Let
$K$ be its size, and let a frontier assignment
$a$ place $m(a)$ mines. Then
$R(a) = M - m(a)$ mines are left to scatter over
$K$ cells, and there are $\binom{K}{R(a)}$ ways to do
that. So each frontier assignment also stands for that many full worlds at once, and (2) becomes a weighted
count:

$$
Z = \sum_a \binom{K}{R(a)}, \qquad P(x \text{ is a mine}) = \frac{\sum_{a \,:\, a(x) = 1}
  \binom{K}{R(a)}}{Z} \tag{3}
$$

The weight $\mu(a) = \binom{K}{R(a)} \big/ Z$ attached to each assignment $a$ makes sense if we
think about what it's counting: a frontier arrangement that has a lot of mines is *less* likely
when few mines remain overall, because it leaves fewer ways to fill in the rest of the board. This is called a
[hypergeometric](https://en.wikipedia.org/wiki/Hypergeometric_distribution)
weighting.

### Why pooling the non-frontier is exact

Every non-frontier cell on the board shows the same one number, computed once for the whole region instead
of separately for each cell. That is not an approximation, it *is* the exact per-cell answer. Here's why.
Fix a frontier assignment $a$. Given $a$, the $R(a)$ remaining mines are scattered uniformly over the
$K$ non-frontier cells, so for any single non-frontier cell
$y$,

$$
P(y \mid a) = R(a)/K
  \tag{4}
$$

> [!NOTE]
>
> The right-hand side does not mention $y$ at all, so it comes out the same for every non-frontier
> cell. The underlying reason is
> [exchangeability](https://en.wikipedia.org/wiki/Exchangeable_random_variables): no clue
> distinguishes one non-frontier cell from another, so any world that mines cell
> $y_1$
> has a mirror world, equally consistent and equally likely, that mines
> $y_2$ instead.

## Reading the heatmap

Each unrevealed cell is filled by its probability on a diverging scale:
:term-safe[deep blue] at $P = 0$, a pale neutral at
$P = 0.5$, :term-mine[red] at
$P = 1$.

To avoid confusion with probabilities close to $0$ or $1$, exact certainty also draws a white ring inside the cell.
Certain-*safe* cells get one further treatment: instead of flat blue they are filled from a violet ramp keyed to how much information we expect to gain from revealing them.
They are all equally safe to click.

## Uncertainty, in bits

How much is left to know? Here's a way to picture it: each time you learn
enough to cut the number of possible board arrangements in half, your uncertainty about it decreases by one step.
The name for this measure is the
[Shannon entropy](https://en.wikipedia.org/wiki/Entropy_(information_theory))
of the posterior over worlds, and it's computed as:

$$
H(W) = -\sum_{w \in W} \mu(w) \log_2 \mu(w) \;=\; \log_2 Z \quad \text{when every world weighs the same.}
  \tag{5}
$$

That second form says exactly what the paragraph above did: when the weights
are uniform, total uncertainty is the log base two of how many arrangements are still valid. The
unit this scale is measured in is called a **bit**: one such step of doubling or halving. Eight consistent
boards is $3$ bits. One consistent board is $0$ bits: nothing left to discover, and the game is
effectively solved whether or not you have finished clicking.
The chart beside the board plots this number after every move.

## Expected information gain

The second question. Probability tells you which cell is least likely to end your game, but it says nothing
about which cell will tell you the most about the rest of the board.
Let $O_x$ be the random variable for what revealing cell $x$ would show: either a mine, or a number
$0$ through $8$. Before revealing anything, we can work out the
distribution of $O_x$, and how much each possible answer would narrow
$W$ down. **Expected information gain** is that narrowing, averaged over every
answer weighted by how likely it is:

$$
\operatorname{EIG}(x) = H(W) - \sum_o P(O_x = o) \, H(W \mid O_x = o) = I(W ; O_x) \tag{6}
$$

The middle term is
[conditional entropy](https://en.wikipedia.org/wiki/Conditional_entropy): how much uncertainty is left, on
average, once you know what the reveal said. The whole expression, uncertainty before minus uncertainty after,
is the
[mutual information](https://en.wikipedia.org/wiki/Mutual_information)
between the board's hidden state and the answer this one cell would give.

There is a special case to be aware of. If every unrevealed neighbour of
$x$ is itself on the frontier, the answer $x$ would give is already pinned down by
the rest of the board, there's no extra randomness in the reveal beyond what the board's state already fixes:
$H(O_x \mid W) = 0$, and by the symmetry of mutual information,

$$
\operatorname{EIG}(x) = H(O_x) - H(O_x \mid W) = H(O_x). \tag{7}
$$

So in that case, a cell's EIG is simply the entropy of its own answer distribution: how unpredictable
that cell's reading is on its own. A cell whose answer you can already guess teaches you nothing when you
click it. A cell with several plausible readings, none of them a foregone conclusion, teaches you a lot.

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
    alt="The same pruned search re-branched so A2 splits first, with the consistent worlds bracketed into the outcome groups revealing A2 would produce."
  />
</div>

:::figcaption
The same position and the same
<span data-figure="world-count">4</span> consistent worlds,
bracketed by what revealing A2 would show. Each bracket is
$W \mid O_x = o$, the worlds still standing after that particular answer.
:::
::::

On this board **A1**, **A2**, **B3** and
**C3** all carry exactly the same $1/2$ risk, but they are not
equally worth clicking.
**A1** borders only one unknown cell, A2, so its reading can only ever answer a single yes-or-no question: mine, or
a `1`, each equally likely. By (7) that is
$H(1/2, 1/2) = 1$ bit: it halves four worlds down to two.

**A2** borders three unknowns instead: A1, A3 and B3, so its reading has more room to vary. It comes
back a mine half the time, and otherwise as a `2` or a `3` depending on B3, each a
quarter of the time. Three possible answers, unevenly weighted, so

$$
\operatorname{EIG}(\text{A2}) = H\!\left(\tfrac{1}{2}, \tfrac{1}{4}, \tfrac{1}{4}\right) =
  -\tfrac{1}{2}\log_2\tfrac{1}{2} - 2 \cdot \tfrac{1}{4}\log_2\tfrac{1}{4} = 1.5 \text{ bits.} \tag{8}
$$

Identical risk, half a bit more information. And unlike A1, two of A2's three possible answers let you solve
the rest of the board outright.
*Which cell is least likely to kill me* has four tied answers on this board, and
*which cell teaches me most* breaks the tie.

> [!NOTE]
>
> One outcome is treated a little loosely here. A `0` doesn't just narrow $W$ down on its own
> account, in the real game it also triggers a cascade, auto-revealing every neighbouring cell and
> recursing wherever those are `0` too. Each of those extra reveals carries its own information on top
> of whatever $H(W \mid O_x = 0)$ already accounts for, so a cell whose `0` outcome would set off a
> large cascade is worth more than the EIG computed here suggests. Scoring that properly means
> enumerating, for every world, how far the cascade would actually spread, which is exactly the
> kind of computation the frontier model exists to avoid, so this project leaves it out and reports
> the single-cell figure instead.

## Predicted versus realized

EIG is an expectation, a claim about the average over answers you have not received yet. When you actually
click, you get one answer, and that answer carries its own amount of information. Under a uniform posterior,
that amount is called the
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
      <dd id="demo-predicted">?</dd>
    </div>
    <div class="demo-readout">
      <dt>Realized information</dt>
      <dd id="demo-realized">?</dd>
    </div>
    <button type="button" id="demo-reset" disabled>Re-roll</button>
  </dl>
  <p id="demo-narration"></p>
</div>

Re-roll it a few dozen times. Half the draws come back as a mine, which rules out the two worlds where A2 was safe
and pays out $\log_2(4/2) = 1$ bit. The other half come back as a `2` or a
`3`, each of which pins the board to a single world and pays
$\log_2 4 = 2$ bits. Neither number is $1.5$. But the prediction is the
average of the outcomes, and nothing more was ever claimed for it.

## Why a cell is certain

The third question, and it's why this page exists at all. I expected the cells the solver calls certain,
exactly $P = 0$ or exactly $P = 1$, to be precisely the ones my by-eye rule already caught. They
weren't. The board back in the introduction has one: no clue on it settles anything alone, and yet one of
those five covered cells holds a mine in *every* arrangement the clues allow.

A cell at exactly $P = 0$ or exactly $P = 1$ is the solver reporting
that the clues admit no alternative, and a fair number of those cells were ones I would never have flagged by
eye. A probability of exactly $1$ can be read as a logical statement, the clues leave
no alternative. So somewhere there's a derivation, a chain of reasoning a person could actually follow by hand.
"None of the 4,096 consistent worlds mines this cell" is true, complete, and explains nothing.

The argument is easier to find if you turn the claim around. Take the constraints in (1) and add the
*negation* of what the solver reports: assert that this certainly-safe cell is a mine. The resulting
system has no solution. Any subset of it that still has no solution is by itself a sufficient reason for the
original conclusion, and a subset that is minimal,
that is, no clue can be dropped from it without it becoming satisfiable again, is exactly the kind of
self-contained argument we're looking for. That object, in formal logic, is a **minimal unsatisfiable subset**.
A set of facts that forces a conclusion and has nothing in it to spare.

The solver extracts one the following way: grow a candidate set of clues outward from the cell, breadth-first,
until the result is certain, then try dropping each clue in turn and keep the drop whenever the deduction
survives without it. What is left is [minimal](https://en.wikipedia.org/wiki/Unsatisfiable_core)
(though not necessarily the smallest possible, or the only one).

On the introduction's board:
<span data-figure="open-board-certain-clues">B1, B2, C2</span> together force
<span data-figure="open-board-certain-cell">A3</span> to be a mine, and dropping any one of the three leaves an
arrangement where it isn't.

Hovering a certain cell in the game highlights what survives that trimming: the revealed
:term-clue[clues] the argument rests on, and any unrevealed
:term-premise[premise] cells whose own forced status it leans on.

::::figure{.board-figure}
<img
  src="/assets/explainer/certainty-board.svg"
  alt="A toy board where C1 is certainly safe, with its two clue cells highlighted in aqua and its premise cell in green."
/>

:::figcaption
A different board state, with one certainly-safe cell. Read it in two steps.
<br />
The `1` at E1 has exactly one unrevealed neighbour, so that neighbour must be
the mine, the premise.
<br />
The other `1` at D2 sees only that premise and the ringed cell, and
its single mine is already spoken for, so the next cell is safe.
<br />
In full: <span data-figure="certainty-focus">C1</span> is certainly safe because of the clues at
<span class="term-clue" data-figure="certainty-clues">E1 and D2</span>, given that
<span class="term-premise" data-figure="certainty-premises">D1</span>
must be a mine.
:::
::::

## Reading the uncertainty chart

Beside the board, the game plots $H(W)$ from (5) against total moves. It starts
high, ends at zero, and records how the game went. Because each move's drop is the
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
and didn't teach us anything new, because $P(o)$ was already close to $1$ and
$-\log_2 P(o)$ close to $0$. A long flat run usually
means you were clearing cells the solver had already marked certain.
