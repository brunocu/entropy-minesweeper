## ADDED Requirements

### Requirement: Live Total-Uncertainty-vs-Move Chart
The system SHALL display a line chart plotting the frontier solver's total joint uncertainty, in bits, against move index for the current game session, where move index starts at 0 at the start of a game and increments by one for each reveal or flag toggle. The chart SHALL update after each such move to include the newly recorded value. The chart's recorded history SHALL be reset to empty whenever a new game starts. This history SHALL exist only for the current client-side session and SHALL NOT be included in any exported board state.

#### Scenario: Chart shows a point for the initial board state
- **WHEN** a new game starts
- **THEN** the chart displays a single point at move index 0 equal to the total joint uncertainty of the initial board state

#### Scenario: Chart appends a point after each move
- **WHEN** the player reveals a cell or toggles a flag
- **THEN** the chart displays a new point at the next move index, equal to the total joint uncertainty of the board immediately after that move

#### Scenario: Chart resets on new game
- **WHEN** the player starts a new game after having made moves in a previous game
- **THEN** the chart discards all previously recorded points and begins again from move index 0

#### Scenario: Uncertainty history is excluded from state export
- **WHEN** the player exports the current board state
- **THEN** the exported state does not include the move-index/uncertainty history
