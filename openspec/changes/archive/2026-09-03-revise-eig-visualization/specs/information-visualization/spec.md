## MODIFIED Requirements

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
When the player reveals a frontier cell whose pre-reveal mine probability was not exactly 1, the system SHALL display both the predicted expected information gain (computed before the reveal resolves) and the realized information content of the actual outcome (computed after it resolves), so the two can be compared. The system SHALL NOT display this predicted-vs-realized comparison for a frontier cell whose pre-reveal mine probability was exactly 1.

#### Scenario: Predicted value shown before resolution
- **WHEN** the player initiates the reveal of a frontier cell whose pre-reveal mine probability is not exactly 1
- **THEN** the display shows that cell's pre-reveal expected information gain

#### Scenario: Realized value shown after resolution
- **WHEN** a frontier cell reveal resolves to a specific outcome, and the cell's pre-reveal mine probability was not exactly 1
- **THEN** the display shows the realized information content of that outcome alongside the previously shown predicted value, allowing the two to be compared

#### Scenario: Non-frontier reveals show no predicted-vs-realized comparison
- **WHEN** the player reveals a non-frontier cell
- **THEN** the display shows no predicted-vs-realized information comparison for that reveal

#### Scenario: Certain-mine reveals show no predicted-vs-realized comparison
- **WHEN** the player reveals a frontier cell whose pre-reveal mine probability was exactly 1
- **THEN** the display shows no predicted-vs-realized information comparison for that reveal

## ADDED Requirements

### Requirement: Certain-Safe Frontier Cell EIG Gradient
For an unrevealed frontier cell whose mine probability is exactly 0, the system SHALL render its fill color from a sequential color scale keyed to that cell's expected information gain, distinct from the diverging probability-heatmap scale, instead of the diverging scale's safe-pole color. The scale's low and high endpoints SHALL be normalized against the minimum and maximum expected information gain among all probability-0 frontier cells currently on the board. A non-frontier cell whose probability is exactly 0 SHALL continue to render the diverging scale's safe-pole color, since it has no individual expected information gain. This requirement does not change the certainty marker described in the Probability Heatmap Coverage requirement's "Exact certainty is visually distinct" scenario, which continues to render on top of this fill.

#### Scenario: Certain-safe frontier cell fill reflects its EIG
- **WHEN** an unrevealed frontier cell's mine probability is exactly 0
- **THEN** its fill color is drawn from the sequential EIG color scale at a position corresponding to that cell's expected information gain, not the diverging scale's safe-pole color

#### Scenario: Higher-EIG certain-safe cells are visually distinct from lower-EIG ones
- **WHEN** two unrevealed frontier cells both have mine probability exactly 0 but different expected information gain values
- **THEN** their fill colors differ, positioned along the sequential EIG scale according to their respective expected information gain values

#### Scenario: Single certain-safe frontier cell renders at full saturation
- **WHEN** exactly one unrevealed frontier cell on the board has mine probability exactly 0
- **THEN** that cell's fill color renders at the sequential EIG scale's high end, since there is no spread to normalize against

#### Scenario: Certain-safe non-frontier cell keeps the flat pole color
- **WHEN** an unrevealed non-frontier cell's mine probability is exactly 0
- **THEN** its fill color is the diverging scale's safe-pole color, not a value from the sequential EIG scale

### Requirement: Uncertain Cell Probability Readout
The system SHALL display an unrevealed cell's mine probability, as a percentage, when the player inspects that cell (e.g., via hover or selection), if that cell's mine probability is strictly between 0 and 1. This applies to both frontier and non-frontier cells. The system SHALL NOT display a probability readout for a cell whose mine probability is exactly 0 or exactly 1.

#### Scenario: Inspecting an uncertain frontier cell shows its probability
- **WHEN** the player inspects an unrevealed frontier cell whose mine probability is strictly between 0 and 1
- **THEN** the display shows that cell's mine probability as a percentage, alongside its expected information gain

#### Scenario: Inspecting an uncertain non-frontier cell shows its probability
- **WHEN** the player inspects an unrevealed non-frontier cell whose mine probability is strictly between 0 and 1
- **THEN** the display shows that cell's mine probability as a percentage

#### Scenario: Inspecting a certain cell shows no probability readout
- **WHEN** the player inspects an unrevealed cell whose mine probability is exactly 0 or exactly 1
- **THEN** the display shows no probability-percentage readout for that cell, relying on the certainty marker instead
