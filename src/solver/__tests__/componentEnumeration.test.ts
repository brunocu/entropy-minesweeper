import { describe, expect, it } from 'vitest'
import { computeFrontierComponents } from '../decomposition.ts'
import { computeComponentSignature } from '../componentEnumeration.ts'
import { computeExplanations } from '../explanation.ts'
import {
  getEnumerationCallCountForTest,
  getGrowTrimCallCountForTest,
  resetEnumerationCallCountForTest,
  resetGrowTrimCallCountForTest,
} from '../instrumentation.ts'
import { solve } from '../probability.ts'
import { makeBoard } from '../../__tests__/support/makeBoard.ts'

describe('component cache signature (1.2)', () => {
  it('is identical regardless of constraint/flag insertion order, and changes when any input changes', () => {
    const board = makeBoard(['121', '???'], 2)
    const components = computeFrontierComponents(board)
    expect(components).toHaveLength(1)
    const component = components[0]
    const reversedComponent = [...component].reverse()

    const flags = new Set(['1,0'])
    const baseline = computeComponentSignature(board, component, flags)
    expect(computeComponentSignature(board, reversedComponent, flags)).toBe(baseline)

    // A different flagged subset changes the signature.
    expect(computeComponentSignature(board, component, new Set(['1,1']))).not.toBe(baseline)
    expect(computeComponentSignature(board, component, new Set())).not.toBe(baseline)

    // A different board (different constraint structure) changes the signature.
    const otherBoard = makeBoard(['131', '???'], 2)
    expect(computeComponentSignature(otherBoard, component, flags)).not.toBe(baseline)
  })
})

describe('solve component cache (2.4)', () => {
  it('reuses cached enumeration across an unchanged board, and only re-enumerates a changed component', () => {
    // Two disjoint single-cell components: (0,1) under clue (0,0), (0,2) under clue (0,3).
    const board = makeBoard(['1??1'], 2)
    const changedBoard = makeBoard(['2??1'], 2) // only the left clue's requiredMines changes

    resetEnumerationCallCountForTest()
    const first = solve(board, new Map())
    expect(getEnumerationCallCountForTest()).toBe(2) // one enumeration per component, first time

    resetEnumerationCallCountForTest()
    solve(board, first.cache)
    expect(getEnumerationCallCountForTest()).toBe(0) // unchanged board: both components hit cache

    resetEnumerationCallCountForTest()
    solve(changedBoard, first.cache)
    expect(getEnumerationCallCountForTest()).toBe(1) // only the changed component re-enumerates
  })
})

describe('computeExplanations component cache (3.2, 3.3)', () => {
  it('reuses a solve-produced cache: performs zero fresh top-level enumeration for components solve already populated', () => {
    const board = makeBoard(['121', '???'], 2)
    const { result, cache: solveCache } = solve(board, new Map())

    resetEnumerationCallCountForTest()
    computeExplanations(board, result, new Set(), solveCache)
    expect(getEnumerationCallCountForTest()).toBe(0)
  })

  it('reuses cached explanations across repeated calls: no new grow/trim search on the second call', () => {
    const board = makeBoard(['121', '???'], 2)
    const { result, cache: solveCache } = solve(board, new Map())

    resetGrowTrimCallCountForTest()
    const first = computeExplanations(board, result, new Set(), solveCache)
    expect(getGrowTrimCallCountForTest()).toBeGreaterThan(0) // first call actually runs grow/trim

    resetGrowTrimCallCountForTest()
    const second = computeExplanations(board, result, new Set(), first.cache)
    expect(getGrowTrimCallCountForTest()).toBe(0)
    expect(second.explanations).toEqual(first.explanations)
  })
})

describe('toggleFlag-shaped cache reuse (3.4, 3.5)', () => {
  // Two disjoint components: A={(0,1),(1,0),(1,1)} under clue (0,0), B={(0,3),(1,3),(1,4)} under
  // clue (0,4). (0,2)/(1,2) are non-frontier (not adjacent to any revealed numbered cell).
  const board = makeBoard(['1???1', '?????'], 2)

  it('is a full cache hit when the toggled cell is outside every frontier component', () => {
    const result = solve(board, new Map()).result
    const before = computeExplanations(board, result, new Set(), new Map())

    const after = computeExplanations(board, result, new Set(['0,2']), before.cache)

    expect(after.cache).toEqual(before.cache)
    expect(after.explanations).toEqual(before.explanations)
  })

  it('recomputes only the component containing a toggled frontier cell, carrying other components over unchanged', () => {
    const result = solve(board, new Map()).result
    const before = computeExplanations(board, result, new Set(), new Map())

    const after = computeExplanations(board, result, new Set(['0,1']), before.cache) // (0,1) is in component A

    expect(after.cache.size).toBe(before.cache.size)
    const beforeKeys = new Set(before.cache.keys())
    const afterKeys = new Set(after.cache.keys())
    const removed = [...beforeKeys].filter((k) => !afterKeys.has(k))
    const added = [...afterKeys].filter((k) => !beforeKeys.has(k))
    const unchanged = [...beforeKeys].filter((k) => afterKeys.has(k))

    expect(removed).toHaveLength(1) // component A's old signature is gone
    expect(added).toHaveLength(1) // component A got a fresh signature (new enumeration+explanations)
    expect(unchanged).toHaveLength(before.cache.size - 1) // component B carried over unchanged
    for (const k of unchanged) {
      expect(after.cache.get(k)).toEqual(before.cache.get(k))
    }
  })
})

describe('component cache pruning (3.6)', () => {
  it('drops a component signature from the cache once a board change removes that component', () => {
    const board = makeBoard(['1???1', '?????'], 2)
    // Component A's own frontier cells are all revealed away, eliminating it; component B (under
    // clue (0,4)) is untouched, so its signature carries over identically.
    const changedBoard = makeBoard(['1.??1', '..???'], 2)

    const firstResult = solve(board, new Map()).result
    const first = computeExplanations(board, firstResult, new Set(), new Map())
    expect(first.cache.size).toBe(2)

    const secondResult = solve(changedBoard, new Map()).result
    const second = computeExplanations(changedBoard, secondResult, new Set(), first.cache)

    expect(second.cache.size).toBe(1)
    const firstKeys = [...first.cache.keys()]
    const secondKeys = new Set(second.cache.keys())
    expect(firstKeys.filter((k) => secondKeys.has(k))).toHaveLength(1) // component B survives
    expect(firstKeys.filter((k) => !secondKeys.has(k))).toHaveLength(1) // component A is dropped
  })
})
