# information-visualization Specification

## Purpose

Translates the frontier-solver's probability and information-gain output into visible board overlays and click feedback, making per-cell mine probability and information gain directly observable during play.

## Requirements

### Requirement: Probability Heatmap Coverage
The system SHALL display a color overlay on every unrevealed, unflagged cell on the board, both frontier and non-frontier, derived from that cell's mine probability `p` via a diverging color scale with `p=0` and `p=1` as visually distinct opposite poles and `p=0.5` as a neutral midpoint.

#### Scenario: Certainly-safe cell shows the safe-pole color
- **WHEN** a cell's mine probability is exactly 0
- **THEN** its heatmap color corresponds to the safe pole of the diverging scale

#### Scenario: Certainly-mined cell shows the mine-pole color
- **WHEN** a cell's mine probability is exactly 1
- **THEN** its heatmap color corresponds to the mine pole of the diverging scale, visually distinct from the safe-pole color

#### Scenario: Maximally uncertain cell shows the neutral midpoint color
- **WHEN** a cell's mine probability is 0.5
- **THEN** its heatmap color corresponds to the neutral midpoint of the scale

#### Scenario: Exact certainty is visually distinct from strong-but-uncertain lean
- **WHEN** a cell's mine probability is exactly 0 or exactly 1
- **THEN** the cell displays an additional marker not shown on cells whose probability is merely close to 0 or 1, so certainty is distinguishable from a strong lean regardless of how subtle the pole-color difference is

#### Scenario: Non-frontier cells are included in the heatmap
- **WHEN** a cell is unrevealed and not adjacent to any revealed numbered cell
- **THEN** it still displays a heatmap color derived from its solver-reported probability, using the same color scale as frontier cells

#### Scenario: Heatmap updates after board state changes
- **WHEN** the board state changes as a result of a reveal, flood-fill, or flag toggle
- **THEN** the heatmap colors are recomputed and redrawn to reflect the updated per-cell probabilities

### Requirement: Frontier Expected-Information-Gain Readout
The system SHALL display the frontier-solver's expected information gain value for a frontier cell when the player inspects that cell (e.g., via hover or selection), and SHALL NOT display an expected-information-gain value for non-frontier cells. The system SHALL NOT display an expected-information-gain value, in any form, for a frontier cell whose mine probability is exactly 1.

#### Scenario: Inspecting a frontier cell shows EIG
- **WHEN** the player inspects an unrevealed frontier cell whose mine probability is not exactly 1
- **THEN** the display shows that cell's expected information gain, in bits, as reported by the frontier solver

#### Scenario: Inspecting a non-frontier cell shows no EIG
- **WHEN** the player inspects an unrevealed non-frontier cell
- **THEN** the display shows no expected-information-gain value for that cell

#### Scenario: Inspecting a certain-mine frontier cell shows no EIG
- **WHEN** the player inspects an unrevealed frontier cell whose mine probability is exactly 1
- **THEN** the display shows no expected-information-gain value for that cell

### Requirement: Predicted-vs-Realized Information Display
When the player reveals any cell, the system SHALL display the realized information content of the actual outcome (computed after the reveal, including any resulting cascade, fully resolves), regardless of whether the revealed cell was on the frontier. When the revealed cell was on the frontier and its pre-reveal mine probability was not exactly 1, the system SHALL additionally display the predicted expected information gain (computed before the reveal resolves) alongside the realized value, so the two can be compared. The system SHALL NOT display a predicted expected information gain for a non-frontier reveal or for a frontier reveal whose pre-reveal mine probability was exactly 1, but SHALL still display the realized information value in those cases.

#### Scenario: Predicted value shown before resolution
- **WHEN** the player initiates the reveal of a frontier cell whose pre-reveal mine probability is not exactly 1
- **THEN** the display shows that cell's pre-reveal expected information gain

#### Scenario: Realized value shown after resolution
- **WHEN** a frontier cell reveal resolves to a specific outcome, and the cell's pre-reveal mine probability was not exactly 1
- **THEN** the display shows the realized information content of that outcome alongside the previously shown predicted value, allowing the two to be compared

#### Scenario: Non-frontier reveals show no predicted-vs-realized comparison
- **WHEN** the player reveals a non-frontier cell
- **THEN** the display shows the realized information content of that reveal, with no predicted expected information gain shown alongside it

#### Scenario: Certain-mine reveals show no predicted-vs-realized comparison
- **WHEN** the player reveals a frontier cell whose pre-reveal mine probability was exactly 1
- **THEN** the display shows the realized information content of that reveal, with no predicted expected information gain shown alongside it

#### Scenario: Cascading reveal shows realized information for the whole cascade
- **WHEN** a reveal cascades open additional cells via flood-fill
- **THEN** the displayed realized information content reflects the whole cascade's outcome, not only the originally clicked cell

### Requirement: Certain-Safe Frontier Cell EIG Gradient
For an unrevealed frontier cell whose mine probability is exactly 0, the system SHALL render its fill color from a sequential color scale keyed to that cell's expected information gain, distinct from the diverging probability-heatmap scale, instead of the diverging scale's safe-pole color. The scale's low endpoint SHALL always correspond to exactly 0 bits of expected information gain, not the minimum expected information gain observed among the board's probability-0 frontier cells. The scale's high endpoint SHALL be normalized against the maximum expected information gain among all probability-0 frontier cells currently on the board. When every probability-0 frontier cell's expected information gain is exactly 0 bits (so there is no spread above the fixed low endpoint), the system SHALL render all such cells at the scale's low end. A non-frontier cell whose probability is exactly 0 SHALL continue to render the diverging scale's safe-pole color, since it has no individual expected information gain. This requirement does not change the certainty marker described in the Probability Heatmap Coverage requirement's "Exact certainty is visually distinct" scenario, which continues to render on top of this fill.

#### Scenario: Certain-safe frontier cell fill reflects its EIG
- **WHEN** an unrevealed frontier cell's mine probability is exactly 0
- **THEN** its fill color is drawn from the sequential EIG color scale at a position corresponding to that cell's expected information gain, not the diverging scale's safe-pole color

#### Scenario: Higher-EIG certain-safe cells are visually distinct from lower-EIG ones
- **WHEN** two unrevealed frontier cells both have mine probability exactly 0 but different expected information gain values
- **THEN** their fill colors differ, positioned along the sequential EIG scale according to their respective expected information gain values

#### Scenario: Fill position reflects absolute distance from zero information gain, not relative position in the observed range
- **WHEN** the unrevealed frontier cells with mine probability exactly 0 have expected information gain values that do not include 0 (for example, all values fall between 0.4 and 0.9 bits)
- **THEN** each such cell's fill color is positioned according to its expected information gain measured from a fixed 0-bit origin, so a cell near the low end of that observed range does not render as if it were near 0 bits when it is not

#### Scenario: Single certain-safe frontier cell with nonzero EIG renders at full saturation
- **WHEN** exactly one unrevealed frontier cell on the board has mine probability exactly 0, and its expected information gain is greater than 0 bits
- **THEN** that cell's fill color renders at the sequential EIG scale's high end, since there is no spread above it to normalize against

#### Scenario: All certain-safe frontier cells with zero EIG render at the scale's low end
- **WHEN** every unrevealed frontier cell with mine probability exactly 0 has expected information gain exactly 0 bits
- **THEN** each such cell's fill color renders at the sequential EIG scale's low end, not its high end

#### Scenario: Certain-safe non-frontier cell keeps the flat pole color
- **WHEN** an unrevealed non-frontier cell's mine probability is exactly 0
- **THEN** its fill color is the diverging scale's safe-pole color, not a value from the sequential EIG scale

### Requirement: Cell Probability Readout
The system SHALL display an unrevealed cell's mine probability, as a percentage, when the player inspects that cell (e.g., via hover or selection), regardless of that cell's mine probability value, including exactly 0 or exactly 1. This applies to both frontier and non-frontier cells.

#### Scenario: Inspecting an uncertain frontier cell shows its probability
- **WHEN** the player inspects an unrevealed frontier cell whose mine probability is strictly between 0 and 1
- **THEN** the display shows that cell's mine probability as a percentage, alongside its expected information gain

#### Scenario: Inspecting an uncertain non-frontier cell shows its probability
- **WHEN** the player inspects an unrevealed non-frontier cell whose mine probability is strictly between 0 and 1
- **THEN** the display shows that cell's mine probability as a percentage

#### Scenario: Inspecting a certain-safe cell still shows its probability
- **WHEN** the player inspects an unrevealed cell whose mine probability is exactly 0
- **THEN** the display shows that cell's mine probability as 0%, alongside the certainty marker, rather than omitting the percentage

#### Scenario: Inspecting a certain-mine cell still shows its probability
- **WHEN** the player inspects an unrevealed frontier cell whose mine probability is exactly 1
- **THEN** the display shows that cell's mine probability as 100%, alongside the certainty marker, even though no expected-information-gain value is shown for it

### Requirement: Live Total-Uncertainty-vs-Move Chart
The system SHALL display a line chart plotting the frontier solver's total joint uncertainty, in bits, against move index for the current game session, where move index starts at 0 at the start of a game and increments by one for each reveal that actually changes board state. Flag toggles, and reveal attempts that do not change board state (an already-revealed cell, a flagged cell, or any action after the game has ended), SHALL NOT increment move index or add a chart point. The chart SHALL update after each state-changing reveal to include the newly recorded value. The chart's recorded history SHALL be reset to empty whenever a new game starts. This history SHALL exist only for the current client-side session and SHALL NOT be included in any exported board state.

#### Scenario: Chart shows a point for the initial board state
- **WHEN** a new game starts
- **THEN** the chart displays a single point at move index 0 equal to the total joint uncertainty of the initial board state

#### Scenario: Chart appends a point after each move
- **WHEN** the player reveals a cell that was not already revealed, not flagged, and the game was not already over
- **THEN** the chart displays a new point at the next move index, equal to the total joint uncertainty of the board immediately after that reveal

#### Scenario: Chart resets on new game
- **WHEN** the player starts a new game after having made moves in a previous game
- **THEN** the chart discards all previously recorded points and begins again from move index 0

#### Scenario: Uncertainty history is excluded from state export
- **WHEN** the player exports the current board state
- **THEN** the exported state does not include the move-index/uncertainty history

#### Scenario: Flag toggle does not advance the chart
- **WHEN** the player flags or unflags an unrevealed cell
- **THEN** move index does not advance and no new point is added to the chart

#### Scenario: Clicking an already-revealed cell does not advance the chart
- **WHEN** the player clicks a cell that is already revealed
- **THEN** move index does not advance and no new point is added to the chart

#### Scenario: Clicking a flagged cell does not advance the chart
- **WHEN** the player clicks a cell that is currently flagged, so the reveal is blocked
- **THEN** move index does not advance and no new point is added to the chart

### Requirement: Frontier Certainty Explanation Highlight
The system SHALL, when the player inspects an unrevealed frontier cell whose mine probability is exactly 0 or exactly 1 (e.g., via hover or selection), highlight the frontier-solver's explanation set for that cell on the board: revealed numbered cells in the set with one visual treatment, and any unrevealed premise cells in the set with a second, visually distinct treatment. This highlight SHALL be layered additively on top of each highlighted cell's existing display (fill color, number, certainty marker, flag) without removing or replacing anything already shown for that cell.

#### Scenario: Inspecting a certain frontier cell shows its explanation
- **WHEN** the player inspects an unrevealed frontier cell whose mine probability is exactly 0 or exactly 1
- **THEN** the display highlights the revealed numbered cells and any premise cells that make up that cell's explanation set

#### Scenario: Clue and premise cells are visually distinguishable
- **WHEN** an inspected cell's explanation set includes both a revealed numbered clue cell and an unrevealed premise cell
- **THEN** the two are highlighted with visually distinguishable treatments

#### Scenario: Highlight does not obscure existing cell state
- **WHEN** an unrevealed premise cell is highlighted
- **THEN** its existing fill color and certainty marker remain visible alongside the highlight

#### Scenario: No highlight for uncertain or non-frontier cells
- **WHEN** the player inspects an unrevealed cell whose mine probability is strictly between 0 and 1, or a non-frontier cell
- **THEN** the display shows no explanation highlight

#### Scenario: Highlight follows the inspected cell
- **WHEN** the player stops inspecting a cell, or moves to inspect a different cell
- **THEN** the previously inspected cell's explanation highlight is no longer shown, and only the newly inspected cell's explanation highlight (if it qualifies) is shown
