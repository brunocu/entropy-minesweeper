## ADDED Requirements

### Requirement: Total Joint Uncertainty
The system SHALL report a single total joint Shannon entropy value, in bits, for the current board state, equal to the base-2 logarithm of the total number of full-board mine configurations consistent with all revealed number constraints (the same configuration count already produced by the exact joint world enumeration and global mine-count weighting used for per-cell probability and expected information gain). This value SHALL reflect the true joint uncertainty of the whole unrevealed board, not a sum of independently-computed per-cell or per-component entropies.

#### Scenario: Total uncertainty reflects the full consistent-configuration count
- **WHEN** the solver has enumerated all full-board mine configurations consistent with the current revealed numbers, weighted by the global mine-count distribution across non-frontier cells
- **THEN** the reported total joint uncertainty equals the base-2 logarithm of the total weighted count of those configurations

#### Scenario: Total uncertainty decreases as constraints accumulate
- **WHEN** a reveal adds a new revealed numbered cell whose constraint eliminates at least one previously consistent configuration
- **THEN** the reported total joint uncertainty is no greater than its value before that reveal

#### Scenario: Fully determined board has zero uncertainty
- **WHEN** exactly one full-board mine configuration remains consistent with all revealed numbers
- **THEN** the reported total joint uncertainty is exactly 0 bits

#### Scenario: Coupled frontier components are not treated as independent
- **WHEN** two or more frontier components exist and their per-component mine counts are jointly constrained by the board's total remaining mine count
- **THEN** the reported total joint uncertainty is computed from the coupled combination of component assignments and non-frontier weighting, not from summing each component's entropy computed in isolation
