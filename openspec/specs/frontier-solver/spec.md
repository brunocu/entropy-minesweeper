# frontier-solver Specification

## Purpose

Computes exact mine probabilities and expected information gain from the current board state, giving the visualization capability the numbers it renders. No approximation ships as a mode.

## Requirements

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

#### Scenario: No explanation when the certainty comes from the global mine budget
- **WHEN** a frontier cell's mine probability is exactly 0 or exactly 1 but its own frontier component's constraints do not force that value, the certainty coming instead from the board's remaining mine count
- **THEN** that cell's explanation set is empty: no revealed numbered cells and no premise cells

#### Scenario: No explanation for uncertain or non-frontier cells
- **WHEN** a cell's mine probability is strictly between 0 and 1, or the cell is non-frontier
- **THEN** the system does not report an explanation set for that cell

#### Scenario: Explanation is deterministic for a fixed board state
- **WHEN** the same certain frontier cell's explanation set is queried more than once without any intervening reveal
- **THEN** the reported explanation set is identical each time
