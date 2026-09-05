## MODIFIED Requirements

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
