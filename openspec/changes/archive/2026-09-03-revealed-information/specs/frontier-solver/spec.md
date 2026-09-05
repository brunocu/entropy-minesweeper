## REMOVED Requirements

### Requirement: Realized Surprisal on Resolution
**Reason**: Replaced by "Revealed Information on Resolution", which redefines the computation as a before/after total-joint-uncertainty difference and extends it to every reveal (frontier or non-frontier) and to every cell a cascade opens, not only the originally clicked frontier cell.
**Migration**: Callers reading realized surprisal for a single frontier cell should instead read the new revealed-information value computed for the whole reveal.

## ADDED Requirements

### Requirement: Revealed Information on Resolution
When a reveal (single cell or a cascade of cells opened by a flood-fill) fully resolves, the system SHALL compute the realized information content of that reveal as the board's total joint uncertainty immediately before the reveal minus the board's total joint uncertainty immediately after the reveal settles, both computed by the same total-joint-uncertainty measure used elsewhere in this capability. This computation SHALL apply to every reveal, whether or not the revealed cell was on the frontier, and SHALL account for every cell a cascade opens, not only the originally clicked cell.

#### Scenario: Revealed information computed from before/after total uncertainty
- **WHEN** a reveal resolves, whether to a single cell or a cascade of cells
- **THEN** the system reports revealed information equal to the total joint uncertainty computed from the world distribution immediately before the reveal, minus the total joint uncertainty computed from the world distribution immediately after the reveal (and any resulting cascade) fully settles

#### Scenario: Cascade information includes every opened cell
- **WHEN** a revealed cell has zero adjacent mines and its resolution cascades open additional cells via flood-fill
- **THEN** the reported revealed information reflects the total uncertainty reduction from all cells the cascade opened, not only the originally clicked cell

#### Scenario: Non-frontier reveal still reports revealed information
- **WHEN** a revealed cell was not on the frontier at the time it was clicked
- **THEN** the system still reports a revealed information value for that reveal
