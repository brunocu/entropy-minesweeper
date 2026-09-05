## MODIFIED Requirements

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
