// Call counters shared by the solver's explanation and probability halves. Here rather than in
// either, because the increment sites straddle both modules.

/**
 * Test-only call-count probes.
 * `enumerationCallCount` counts a component's full (exponential) enumeration being recomputed from
 * scratch - incremented at the per-component cache-miss call sites, not inside
 * `enumerateComponentFull`, so it excludes `resolvesTo`'s much smaller per-subset backtracking.
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
 * `subsetKeyCallCount` counts subset-key builds *including* those that go on to hit the cache,
 * which `growTrimCallCount` (misses only) cannot show. The gap sizes the per-query key build.
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
 * `decompositionCallCount` counts full board decompositions. `solve` and `computeExplanations`
 * share one `Decomposition` per board state rather than each deriving its own; this pins that down.
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
