## Purpose

Explains, in long-form prose with grounded illustrations, the project's motivation and the solving mechanisms behind its probability, information-gain, and uncertainty displays, so a reader who already knows Minesweeper can understand what those displays mean and why.

## ADDED Requirements

### Requirement: Explainer Page
The system SHALL present the explainer as a page distinct from the live game, containing prose sections covering the project's motivation, the frontier/non-frontier split, how to read the probability heatmap, what expected information gain means, the predicted-vs-realized comparison, the certainty-explanation highlight, and how to read the uncertainty chart.

#### Scenario: Explainer content is reachable as its own page
- **WHEN** the reader navigates to the explainer
- **THEN** they see a page distinct from the live game board, containing prose sections on each of the topics listed above

### Requirement: Frontier/Non-Frontier Pooling Explanation
The system SHALL state, as part of the explainer's content, that a non-frontier cell's displayed pooled probability is mathematically identical to the value that would result from solving that cell individually given the same information, not an approximation of it.

#### Scenario: Pooling equivalence is stated, not hedged
- **WHEN** the reader reads the explainer's frontier/non-frontier section
- **THEN** the content states that the pooled non-frontier probability equals what individual per-cell solving would produce, and does not describe it as an approximation or shortcut

### Requirement: Worlds-Tree Probability Illustration
The system SHALL display, for a single fixed toy scenario, a rendered illustration of that scenario's enumerated, weighted possible worlds as a branching structure (one branch per unknown cell), with any branch inconsistent with the scenario's revealed clue visually marked as eliminated. The illustration SHALL highlight the surviving branches in which one designated cell is a mine, such that the combined weight of those highlighted branches equals that cell's displayed mine probability. This illustration SHALL NOT change in response to reader interaction; it always shows the same fixed scenario and designated cell.

#### Scenario: Eliminated branches are visually distinct from surviving ones
- **WHEN** the reader views the worlds-tree probability illustration
- **THEN** branches inconsistent with the scenario's clue are visually marked as eliminated, distinct from surviving branches

#### Scenario: Highlighted mine-branch weight matches the displayed probability
- **WHEN** the reader views the worlds-tree probability illustration
- **THEN** the branches highlighted as "designated cell is a mine" are exactly the surviving branches where that cell is a mine, and their combined weight equals the probability value shown alongside the illustration

#### Scenario: Illustration does not respond to interaction
- **WHEN** the reader interacts with the worlds-tree probability illustration (e.g., clicking or hovering a cell within it)
- **THEN** the illustration's highlighted branches and designated cell remain unchanged

### Requirement: Worlds-Tree Information-Gain Illustration
The system SHALL display, using the same fixed toy scenario and its enumerated worlds as the worlds-tree probability illustration, a second rendered illustration that groups the surviving branches by the outcome of revealing one designated cell (mine, or safe with a specific adjacent-mine count), showing each outcome's group of surviving branches alongside the full ungrouped set. This illustration SHALL NOT change in response to reader interaction.

#### Scenario: Outcome groups are shown alongside the full set
- **WHEN** the reader views the worlds-tree information-gain illustration
- **THEN** the surviving branches are shown grouped by the designated cell's possible outcomes, and the full (ungrouped) set of surviving branches is also shown for comparison

#### Scenario: Narrower groups correspond to the reported information gain
- **WHEN** the reader compares an outcome group's spread of surviving branches to the full set's spread
- **THEN** the visible narrowing corresponds to the expected-information-gain value displayed alongside the illustration

### Requirement: Certainty-Explanation Illustration
The system SHALL display a fixed toy board illustrating one cell whose mine probability is certain (exactly 0 or exactly 1), with that cell's explanation set highlighted using one visual treatment for the revealed clue cell(s) in the set and a second, visually distinct treatment for the unrevealed premise cell(s) in the set. This illustration SHALL NOT change in response to reader interaction.

#### Scenario: Clue and premise cells are visually distinguishable
- **WHEN** the reader views the certainty-explanation illustration
- **THEN** the revealed clue cell(s) and unrevealed premise cell(s) making up the certain cell's explanation are highlighted with visually distinguishable treatments

### Requirement: Predicted-vs-Realized Interactive Demo
The system SHALL allow the reader to trigger a simulated reveal against a fixed toy scenario. Each trigger SHALL select an outcome at random, weighted by that outcome's real solver-computed probability, and SHALL display the predicted expected information gain for the designated cell alongside the realized information content of the selected outcome.

#### Scenario: Triggering the demo shows predicted and realized values together
- **WHEN** the reader triggers the demo
- **THEN** the display shows both the predicted expected information gain (computed before the simulated outcome is selected) and the realized information content of the outcome that was selected

#### Scenario: Repeated triggers can select different outcomes
- **WHEN** the reader triggers the demo multiple times
- **THEN** different outcomes may be selected across triggers, each with the realized information content matching the outcome selected that time

### Requirement: Uncertainty-Chart Illustration
The system SHALL display a fixed example trace of total board uncertainty (in bits) versus move index, annotated to identify at least one move-to-move decrease that is large relative to the rest of the trace and at least one multi-move stretch with little or no decrease.

#### Scenario: Annotations identify a large decrease and a flat stretch
- **WHEN** the reader views the uncertainty-chart illustration
- **THEN** the annotations point out at least one large single-move decrease in the trace and at least one stretch of multiple moves with little or no decrease
