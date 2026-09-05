## Purpose

Translates the frontier-solver's probability and information-gain output into visible board overlays and click feedback, making per-cell mine probability and information gain directly observable during play.

## ADDED Requirements

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
The system SHALL display the frontier-solver's expected information gain value for a frontier cell when the player inspects that cell (e.g., via hover or selection), and SHALL NOT display an expected-information-gain value for non-frontier cells.

#### Scenario: Inspecting a frontier cell shows EIG
- **WHEN** the player inspects an unrevealed frontier cell
- **THEN** the display shows that cell's expected information gain, in bits, as reported by the frontier solver

#### Scenario: Inspecting a non-frontier cell shows no EIG
- **WHEN** the player inspects an unrevealed non-frontier cell
- **THEN** the display shows no expected-information-gain value for that cell

### Requirement: Predicted-vs-Realized Information Display
When the player reveals a frontier cell, the system SHALL display both the predicted expected information gain (computed before the reveal resolves) and the realized information content of the actual outcome (computed after it resolves), so the two can be compared.

#### Scenario: Predicted value shown before resolution
- **WHEN** the player initiates the reveal of a frontier cell
- **THEN** the display shows that cell's pre-reveal expected information gain

#### Scenario: Realized value shown after resolution
- **WHEN** a frontier cell reveal resolves to a specific outcome
- **THEN** the display shows the realized information content of that outcome alongside the previously shown predicted value, allowing the two to be compared

#### Scenario: Non-frontier reveals show no predicted-vs-realized comparison
- **WHEN** the player reveals a non-frontier cell
- **THEN** the display shows no predicted-vs-realized information comparison for that reveal
