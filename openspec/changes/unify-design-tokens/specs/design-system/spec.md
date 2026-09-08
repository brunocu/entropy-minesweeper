## Purpose

Gives the site one visual language across every page: a single named set of color tokens that both CSS-rendered chrome and canvas-rendered visualization draw from, so a color carrying a meaning on one page carries the same meaning and the same value on the other.

## ADDED Requirements

### Requirement: Single Source of Truth for Color Tokens
The system SHALL define every color used by site chrome and by canvas rendering in exactly one authoritative location, and SHALL derive any other representation of those colors from it rather than restating them. No color used by more than one consumer may be declared independently in two places.

#### Scenario: A token's value is changed in one place
- **WHEN** a maintainer changes the value of a color token in the authoritative definition and runs the project's build or dev command
- **THEN** both the CSS-rendered pages and the canvas-rendered board and chart display the new value, with no other file edited by hand

#### Scenario: Derived representation is out of date
- **WHEN** the authoritative token definition is changed without regenerating the derived stylesheet
- **THEN** the test suite fails, identifying the derived file as stale

#### Scenario: A fresh checkout without a build step
- **WHEN** the repository is checked out and the derived stylesheet is loaded without any build or generation step having run
- **THEN** the stylesheet is present and its values match the authoritative definition

### Requirement: Semantic Token Naming
Color tokens SHALL be named for the meaning they carry (for example: safe, mine, expected information gain, clue, premise, ink, surface, page, rule), and SHALL NOT be named for their appearance (for example: blue, red, gray). Two elements that mean the same thing SHALL reference the same token.

#### Scenario: The same concept on two pages resolves to one token
- **WHEN** the explainer's prose marks a term as referring to safety and the board fills a certainly-safe cell
- **THEN** both resolve to the same named safe token and therefore render the same color

#### Scenario: A concept is renamed rather than recolored
- **WHEN** a reader inspects a token name
- **THEN** the name describes the concept the color stands for and can be read without knowing the hex value

### Requirement: Every Rendered Color Belongs to the Token Set
Every color drawn by the board renderer, the uncertainty chart, and the site's stylesheets SHALL come from the shared token set. No color literal may be introduced at a rendering call site.

#### Scenario: Board renders a revealed mine
- **WHEN** the board renderer fills a revealed mine cell
- **THEN** the fill is the shared mine token — the same value used for the mine pole of the probability heatmap

#### Scenario: Chart renders its data series
- **WHEN** the uncertainty chart strokes its series line
- **THEN** the stroke is the shared safe token

#### Scenario: Board renders text and grid labels
- **WHEN** the board renderer draws a cell number or an axis label
- **THEN** the color is the shared ink token

#### Scenario: Flagged and unknown-probability cells stay legible
- **WHEN** the board renders a flagged cell or a cell with no known probability
- **THEN** each uses its own neutral-ramp token, visually distinct from the diverging scale's neutral midpoint, so neither reads as a maximally uncertain cell

### Requirement: Both Pages Share the Token Stylesheet
Every HTML page the site serves SHALL obtain its color values from the shared generated stylesheet rather than from a page-local declaration of custom properties.

#### Scenario: The explainer page loads
- **WHEN** the explainer page is rendered
- **THEN** its color custom properties come from the shared stylesheet, and the page declares no color values of its own

#### Scenario: The game page loads
- **WHEN** the game page is rendered
- **THEN** it links the shared stylesheet and its chrome is styled by CSS classes defined against the shared tokens

### Requirement: Documented Color Provenance Is Preserved
The recorded rationale for the palette's choices — which dataviz palette slot each pole, midpoint, ramp endpoint, and highlight came from, and why — SHALL survive relocation into the token definition. The change SHALL relocate values, not re-pick them.

#### Scenario: A maintainer asks why a color was chosen
- **WHEN** a maintainer reads the authoritative token definition
- **THEN** each token that was chosen from the dataviz palette carries its recorded slot and reason

#### Scenario: Existing color behavior is unchanged by extraction
- **WHEN** the color-scale tests run after the poles, midpoint, ramp, and highlights are sourced from tokens
- **THEN** they pass without modification, because the values and their relationships are unchanged
