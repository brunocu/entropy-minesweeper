## Purpose

Provides the core minesweeper game engine — board generation, reveal, flagging, and win/loss detection — that the solver and visualization capabilities observe and act on.

## ADDED Requirements

### Requirement: Board Generation
The system SHALL generate a rectangular grid of cells with a configurable width, height, and mine count, placing mines uniformly at random among cells not excluded by the first-click-safe guarantee.

#### Scenario: New board has correct mine count
- **WHEN** a new board is created with width W, height H, and mine count M
- **THEN** the board contains exactly M mined cells among its W*H cells

### Requirement: First-Click Safety
The system SHALL guarantee that the first cell revealed in a game is never a mine and always opens at least one adjacent zero-adjacency region, by deferring mine placement until after the first click and excluding the clicked cell and its neighbors from mine placement.

#### Scenario: First click is never a mine
- **WHEN** the player reveals any cell as their first action in a new game
- **THEN** that cell is not a mine, regardless of which cell was chosen

#### Scenario: First click opens an area
- **WHEN** the player reveals any cell as their first action in a new game
- **THEN** the revealed cell has zero adjacent mines, triggering the flood-fill reveal of its connected zero-adjacency region

### Requirement: Cell Reveal
The system SHALL reveal a chosen unflagged, unrevealed cell, exposing either a mine (ending the game as a loss) or a number indicating the count of mines among its up-to-8 neighbors.

#### Scenario: Revealing a numbered cell
- **WHEN** the player reveals an unrevealed, unflagged cell that is not a mine and has at least one adjacent mine
- **THEN** the cell becomes revealed and displays the exact count of adjacent mines

#### Scenario: Revealing a mine
- **WHEN** the player reveals an unrevealed, unflagged cell that is a mine
- **THEN** the game ends in a loss and the mine is revealed

#### Scenario: Revealing a flagged cell is blocked
- **WHEN** the player attempts to reveal a cell that is currently flagged
- **THEN** the cell remains flagged and unrevealed, and no reveal occurs

### Requirement: Flood-Fill Reveal
The system SHALL automatically reveal all connected cells reachable from a zero-adjacency cell (a cell with no adjacent mines), stopping the expansion at any cell with one or more adjacent mines.

#### Scenario: Revealing a zero-adjacency cell cascades
- **WHEN** the player reveals a cell with zero adjacent mines
- **THEN** all connected cells reachable through other zero-adjacency cells are also revealed, including the numbered cells bordering that region, and the cascade stops at those numbered cells

### Requirement: Flagging
The system SHALL allow the player to toggle a flag on any unrevealed cell, and SHALL prevent revealing a flagged cell until it is unflagged.

#### Scenario: Flagging an unrevealed cell
- **WHEN** the player flags an unrevealed cell
- **THEN** the cell displays as flagged and is excluded from reveal actions until unflagged

#### Scenario: Unflagging a flagged cell
- **WHEN** the player unflags a previously flagged cell
- **THEN** the cell returns to its normal unrevealed state and can be revealed again

### Requirement: Win Detection
The system SHALL declare the game won the moment every non-mine cell has been revealed, regardless of flag state on remaining mine cells.

#### Scenario: All non-mine cells revealed
- **WHEN** the last non-mine cell on the board is revealed
- **THEN** the game immediately ends in a win

### Requirement: Loss Detection
The system SHALL declare the game lost the moment a mine cell is revealed, and SHALL reveal every mine on the board at that point, not only the one the player clicked.

#### Scenario: Mine revealed ends the game
- **WHEN** a mine cell is revealed
- **THEN** the game immediately ends in a loss and further reveal/flag actions are disabled

#### Scenario: Losing reveals every mine on the board
- **WHEN** a mine cell is revealed and the game ends in a loss
- **THEN** every other mine cell on the board is also revealed, regardless of whether the player had found or flagged it
