## ADDED Requirements

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
