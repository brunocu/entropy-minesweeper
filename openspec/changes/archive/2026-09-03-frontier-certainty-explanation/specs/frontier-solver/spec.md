## ADDED Requirements

### Requirement: Minimal Certainty Explanation
For each frontier cell whose reported mine probability is exactly 0 or exactly 1, the system SHALL compute a minimal explanation set: a subset of that cell's frontier-component revealed numbered cells such that no member can be removed without losing the same certainty for that cell, together with any unrevealed cell within that subset whose own forced mine or forced safe status is relied upon by a retained numbered cell's constraint. The system SHALL NOT compute an explanation set for a cell whose mine probability is strictly between 0 and 1, or for a non-frontier cell.

#### Scenario: Single-clue certainty needs only that clue
- **WHEN** a frontier cell's certainty is forced by exactly one revealed numbered cell's constraint, on its own
- **THEN** that cell's explanation set contains exactly that one revealed numbered cell, and no premise cells

#### Scenario: Joint certainty needs every clue it depends on
- **WHEN** a frontier cell's certainty requires two or more revealed numbered cells considered jointly, such that no single one of them alone would force it
- **THEN** that cell's explanation set contains all of, and only, the revealed numbered cells necessary to force the certainty, such that removing any one of them from the set would no longer force it

#### Scenario: Explanation excludes clues that don't affect the outcome
- **WHEN** a revealed numbered cell shares a frontier component with a certain cell but does not affect that cell's certainty
- **THEN** that revealed numbered cell is not included in the cell's explanation set

#### Scenario: Explanation includes a relied-upon premise cell
- **WHEN** a retained revealed numbered cell's constraint is only satisfied for the purpose of the explanation because a specific unrevealed neighbor is already forced to be a mine or forced to be safe
- **THEN** that unrevealed neighbor is included in the explanation set alongside the revealed numbered cell, regardless of whether it is forced mine or forced safe

#### Scenario: No explanation for uncertain or non-frontier cells
- **WHEN** a cell's mine probability is strictly between 0 and 1, or the cell is non-frontier
- **THEN** the system does not report an explanation set for that cell

#### Scenario: Explanation is deterministic for a fixed board state
- **WHEN** the same certain frontier cell's explanation set is queried more than once without any intervening reveal
- **THEN** the reported explanation set is identical each time
