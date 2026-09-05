## MODIFIED Requirements

### Requirement: Trivial Deduction
The system SHALL resolve, with certainty (probability exactly 0 or 1), any unrevealed neighbor of a revealed numbered cell whose mine count is already fully satisfied by known mines, or whose remaining unrevealed neighbor count exactly equals its remaining unsatisfied mine count. Flag state SHALL NOT contribute to this or any other solver determination: a flagged cell is solved exactly like any other unrevealed cell.

#### Scenario: Fully satisfied number marks remaining neighbors safe
- **WHEN** a revealed numbered cell's mine count equals the number of already-known mines among its neighbors
- **THEN** every other unrevealed neighbor of that cell is assigned mine probability 0

#### Scenario: Remaining neighbors forced to be mines
- **WHEN** a revealed numbered cell's count of unrevealed neighbors equals its remaining unsatisfied mine count
- **THEN** every unrevealed neighbor of that cell is assigned mine probability 1

#### Scenario: Flagging a cell does not satisfy a neighbor's mine count
- **WHEN** the player flags an unrevealed cell adjacent to a revealed numbered cell
- **THEN** that numbered cell's mine count is treated as still unsatisfied by the flagged cell, and no neighbor is resolved to certainty on the basis of the flag alone

#### Scenario: Flagged and unflagged cells with identical board state solve identically
- **WHEN** two otherwise-identical board states differ only in whether a given unrevealed cell is flagged
- **THEN** every cell's reported mine probability, expected information gain, and the board's total joint uncertainty are identical between the two states
