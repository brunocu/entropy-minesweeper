## MODIFIED Requirements

### Requirement: Expected Information Gain for Frontier Cells
For each frontier cell, the system SHALL compute the expected information gain of revealing it as the sum of two terms: (1) the mutual information between that cell's click outcome and the enumerated-worlds distribution, derived from the same weighted world list used for probability computation, without a separate enumeration pass; and (2) an estimate of the additional expected information from cells that a resulting cascade would newly reveal beyond the clicked cell itself, when that cell's outcome can be zero adjacent mines. The second term SHALL be an estimate, not an exact computation — it SHALL NOT require enumerating individual non-frontier cell mine placements or re-running world enumeration conditioned on a hypothetical cascade, since doing so would reintroduce the combinatorial cost the solver's aggregate non-frontier weighting is designed to avoid.

#### Scenario: EIG reflects reduction in world-distribution entropy
- **WHEN** a frontier cell's possible click outcomes (mine, or safe with a specific number) partition the enumerated, weighted worlds into outcome groups
- **THEN** the reported expected information gain includes the entropy of the full weighted world distribution minus the outcome-probability-weighted average entropy of the world distribution within each outcome group

#### Scenario: Cascade-eligible cell's EIG includes estimated cascade information
- **WHEN** a frontier cell's probability of resolving to zero adjacent mines is greater than zero
- **THEN** the reported expected information gain includes a non-negative estimate of additional information from cells the resulting cascade is expected to newly reveal, beyond the entropy accounted for by that cell's own outcome

#### Scenario: Zero cascade probability contributes no cascade term
- **WHEN** a frontier cell's probability of resolving to zero adjacent mines is exactly 0
- **THEN** the estimated cascade information contributes exactly 0 to that cell's reported expected information gain

#### Scenario: Greater estimated cascade reach yields greater EIG
- **WHEN** two frontier cells have identical single-outcome entropy contributions but one has a greater estimated cascade reach than the other
- **THEN** the cell with the greater estimated cascade reach has the higher reported expected information gain

#### Scenario: Propagated cascade reach probability never exceeds certainty
- **WHEN** a cell reachable by the cascade estimate accumulates reveal-probability contributions from two or more already-processed predecessor cells
- **THEN** the system caps that cell's accumulated reveal probability at 1, since a probability cannot exceed certainty, before using it to estimate that cell's information or propagating it further

#### Scenario: Non-frontier cells have no reported EIG
- **WHEN** a cell is non-frontier (unrevealed and not adjacent to any revealed numbered cell)
- **THEN** the system does not report an expected information gain value for that cell

## ADDED Requirements

### Requirement: Cascade Probability for Frontier Cells
For each frontier cell, the system SHALL report the exact probability that revealing it resolves to zero adjacent mines, derived from the same enumerated-worlds distribution used for mine probability and expected information gain, without a separate enumeration pass.

#### Scenario: Cascade probability matches the zero-outcome probability
- **WHEN** a frontier cell's enumerated-worlds outcome distribution assigns some probability to the zero-adjacent-mines outcome
- **THEN** the system reports that same probability as the cell's cascade probability

#### Scenario: Certain non-zero cell has zero cascade probability
- **WHEN** a frontier cell's mine probability is exactly 1, or its enumerated-worlds outcome distribution assigns no probability to the zero-adjacent-mines outcome
- **THEN** the system reports that cell's cascade probability as exactly 0
