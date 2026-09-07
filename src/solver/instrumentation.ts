// Call counters shared by the solver's explanation and probability halves.
// See openspec/changes/split-solver-modules/design.md Decision D4: the counters keep their
// existing names and module-level mutable state; only the increment sites move, to the
// `increment*` functions below, because those sites straddle two modules and a counter read
// by tests from both halves cannot live in either.

/**
 * Test-only call-count probes (cache-frontier-explanations-by-component tasks 2.4/3.2/3.3).
 * `enumerationCallCount` counts a component's full (exponential-in-component-size) enumeration
 * being (re)computed from scratch - incremented at `solve`'s and `computeExplanations`'s
 * top-level per-component cache-miss call sites, not inside `enumerateComponentFull` itself, so
 * it doesn't also count `resolvesTo`'s much smaller per-subset backtracking runs during grow/trim.
 * `growTrimCallCount` counts those grow/trim searches instead, via `resolvesTo`.
 */
let enumerationCallCount = 0
export function incrementEnumerationCallCount(): void {
  enumerationCallCount++
}
export function resetEnumerationCallCountForTest(): void {
  enumerationCallCount = 0
}
export function getEnumerationCallCountForTest(): number {
  return enumerationCallCount
}

let growTrimCallCount = 0
export function incrementGrowTrimCallCount(): void {
  growTrimCallCount++
}
export function resetGrowTrimCallCountForTest(): void {
  growTrimCallCount = 0
}
export function getGrowTrimCallCountForTest(): number {
  return growTrimCallCount
}

/**
 * `subsetKeyCallCount` counts subset-key builds, *including* the ones that go on to hit the
 * subset-verdict cache - which is exactly what `growTrimCallCount` (misses only) cannot show.
 * Sizing that gap is what tells us whether the per-query key build is worth optimizing
 * (reduce-explanation-setup-overhead design D6).
 */
let subsetKeyCallCount = 0
export function incrementSubsetKeyCallCount(): void {
  subsetKeyCallCount++
}
export function resetSubsetKeyCallCountForTest(): void {
  subsetKeyCallCount = 0
}
export function getSubsetKeyCallCountForTest(): number {
  return subsetKeyCallCount
}
