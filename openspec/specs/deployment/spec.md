# deployment Specification

## Purpose

Defines how the site is published and served as a static site hosted on GitHub Pages at a non-root subpath, and how deployment is automated and gated on the test suite.

## Requirements

### Requirement: Site functions correctly when served from a subpath
All in-app navigation and asset references SHALL resolve correctly when the site is deployed at a non-root base path (e.g. `/entropy-minesweeper/`), not just when served from domain root.

#### Scenario: Explainer link resolves under the deployed subpath
- **WHEN** a visitor on the deployed game page (served at `/entropy-minesweeper/`) clicks "What does any of this mean?"
- **THEN** the browser navigates to the explainer page under the same subpath, not to domain root

#### Scenario: Back-to-game link resolves under the deployed subpath
- **WHEN** a visitor on the deployed explainer page clicks "Back to the game"
- **THEN** the browser navigates to the game page under the same subpath, not to domain root

#### Scenario: Generated illustration images load under the deployed subpath
- **WHEN** the explainer page renders its solver-illustration diagrams
- **THEN** each diagram's image resolves under the deployed subpath instead of 404ing against domain root

### Requirement: No broken icon references
The site's HTML SHALL NOT reference a favicon file that does not exist in the published output.

#### Scenario: Page load has no favicon 404
- **WHEN** a visitor loads either the game page or the explainer page
- **THEN** the browser does not request a nonexistent `/favicon.svg` and fall back silently to its default icon

### Requirement: Automated deployment gated on tests
Pushing to the repository's default branch SHALL trigger a CI pipeline that runs the automated test suite and only deploys the built site to GitHub Pages if the tests pass.

#### Scenario: Passing tests deploy the site
- **WHEN** a push to the default branch runs the full test suite and it passes
- **THEN** the CI pipeline builds the production bundle and publishes it to GitHub Pages

#### Scenario: Failing tests block deployment
- **WHEN** a push to the default branch runs the full test suite and any test fails
- **THEN** the CI pipeline stops before building or publishing, and the previously deployed site remains unchanged
