// Call counters shared by the solver's explanation and probability halves.
// They live here, rather than in either half, because the sites that increment them straddle
// both modules and a counter read by tests from either side cannot belong to one of them.

/**
 * Test-only call-count probes.
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
 * Sizing that gap is what tells us whether the per-query key build is worth optimizing.
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

/**
 * `decompositionCallCount` counts full board decompositions - frontier, constraints, components
 * and their constraint slices. `solve` and `computeExplanations` share one `Decomposition` per
 * board state rather than each deriving its own, and this counter is what pins that down.
 */
let decompositionCallCount = 0
export function incrementDecompositionCallCount(): void {
  decompositionCallCount++
}
export function resetDecompositionCallCountForTest(): void {
  decompositionCallCount = 0
}
export function getDecompositionCallCountForTest(): number {
  return decompositionCallCount
}
