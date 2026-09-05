## Purpose

Computes exact mine probabilities and expected information gain from the current board state, giving the visualization capability the numbers it renders, with no approximation shipped as a mode.

## ADDED Requirements

### Requirement: Trivial Deduction
The system SHALL resolve, with certainty (probability exactly 0 or 1), any unrevealed neighbor of a revealed numbered cell whose mine count is already fully satisfied by known/flagged mines, or whose remaining unrevealed neighbor count exactly equals its remaining unsatisfied mine count.

#### Scenario: Fully satisfied number marks remaining neighbors safe
- **WHEN** a revealed numbered cell's mine count equals the number of already-known mines among its neighbors
- **THEN** every other unrevealed neighbor of that cell is assigned mine probability 0

#### Scenario: Remaining neighbors forced to be mines
- **WHEN** a revealed numbered cell's count of unrevealed neighbors equals its remaining unsatisfied mine count
- **THEN** every unrevealed neighbor of that cell is assigned mine probability 1

### Requirement: Frontier Component Decomposition
The system SHALL identify the frontier (unrevealed cells adjacent to at least one revealed numbered cell) and partition it into connected components, where two frontier cells belong to the same component only if they share a revealed numbered neighbor (directly or transitively).

#### Scenario: Disjoint frontier regions form separate components
- **WHEN** two frontier cells share no revealed numbered neighbor, directly or transitively through other frontier cells
- **THEN** they are assigned to different frontier components

### Requirement: Exact Joint World Enumeration
For each frontier component, the system SHALL enumerate every mine/safe assignment to that component's cells that is consistent with all revealed number constraints touching it, producing the complete, exact set of valid assignments — not an approximation derived from treating constraints independently.

#### Scenario: Shared-constraint cell resolves to certainty
- **WHEN** a frontier cell is adjacent to multiple revealed numbers whose constraints, taken jointly, admit no assignment where that cell is safe (or none where it is a mine)
- **THEN** the system reports that cell's mine probability as exactly 1 (or exactly 0), even though considering either number's constraint alone would not have forced that certainty

### Requirement: Global Mine-Count Weighting
The system SHALL weight each combination of per-component assignments by the number of ways the board's remaining mine count can be distributed among the non-frontier cells, and SHALL use this weighting to compute a single, non-uniform-over-time mine probability for every non-frontier cell that is uniform across non-frontier cells at any given instant.

#### Scenario: Non-frontier probability reflects remaining mine count
- **WHEN** the frontier's valid assignments are combined with the board's total remaining mine count
- **THEN** every non-frontier unrevealed cell is assigned the same mine probability, equal to the expected fraction of the remaining, frontier-unassigned mines spread across the non-frontier cells

#### Scenario: Frontier deduction shifts non-frontier probability
- **WHEN** a new deduction changes the range of mine counts consistent with the frontier
- **THEN** the shared non-frontier cell probability is recomputed and changes accordingly, without any direct constraint touching those non-frontier cells

### Requirement: Expected Information Gain for Frontier Cells
For each frontier cell, the system SHALL compute the expected information gain of revealing it as the mutual information between that cell's click outcome and the enumerated-worlds distribution, derived from the same weighted world list used for probability computation, without a separate enumeration pass.

#### Scenario: EIG reflects reduction in world-distribution entropy
- **WHEN** a frontier cell's possible click outcomes (mine, or safe with a specific number) partition the enumerated, weighted worlds into outcome groups
- **THEN** the reported expected information gain equals the entropy of the full weighted world distribution minus the outcome-probability-weighted average entropy of the world distribution within each outcome group

#### Scenario: Non-frontier cells have no reported EIG
- **WHEN** a cell is non-frontier (unrevealed and not adjacent to any revealed numbered cell)
- **THEN** the system does not report an expected information gain value for that cell

### Requirement: Realized Surprisal on Resolution
When a frontier cell is revealed and its actual outcome is known, the system SHALL compute the realized information content of that specific outcome as the negative base-2 logarithm of that outcome's probability under the pre-reveal weighted world distribution.

#### Scenario: Realized surprisal computed from pre-reveal distribution
- **WHEN** a frontier cell is revealed and produces a specific outcome
- **THEN** the system reports realized information content equal to -log2 of that outcome's probability as computed from the world distribution that existed immediately before the reveal
