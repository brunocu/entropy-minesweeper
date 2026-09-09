import { describe, expect, it } from 'vitest'
import { quickXplain } from '../explanation.ts'

/**
 * Validation of `quickXplain` against the source it implements: Rodler, "Understanding the
 * QuickXPlain Algorithm: Simple Explanation and Formal Proof" (arXiv:2001.01835v3), whose Alg. 1
 * is Junker's QX/QX' and whose Ex. 6 is a fully worked run with every oracle call spelled out.
 *
 * These drive the shipped generic `quickXplain` directly with the paper's own abstract predicate,
 * so what is checked is the algorithm itself rather than its minesweeper wiring. The board-level
 * consequences - sufficiency, irreducibility, component confinement - are `explanationProperties`.
 */

/** Ex. 6: universe A = {1..8}, background B = {}, with exactly two minimal p-sets. */
const A = [1, 2, 3, 4, 5, 6, 7, 8]
const X = [3, 4, 7]
const Y = [4, 5, 8]

/**
 * The paper's predicate: p(S) = 1 iff S contains one of the two minimal p-sets. Monotone per
 * Def. 1 - a superset of a set containing X (or Y) still contains it - and p({}) = 0 since both
 * minimal p-sets are non-empty, which is the precondition Def. 1 also demands.
 */
function contains(subset: readonly number[], required: readonly number[]): boolean {
  return required.every((element) => subset.includes(element))
}

/** Wraps the predicate to record the exact sequence of sets it is asked about. */
function tracingOracle(): {
  p: (subset: readonly number[]) => boolean
  queries: string[]
} {
  const queries: string[] = []
  return {
    p: (subset) => {
      queries.push([...subset].sort((a, b) => a - b).join(','))
      return contains(subset, X) || contains(subset, Y)
    },
    queries,
  }
}

/**
 * The nine predicate evaluations of Ex. 6, in the paper's order. Each entry is the tested set,
 * which in the paper's "flat" notation is the single-underlined subset together with the
 * double-underlined (already fixed) elements.
 */
const PAPER_TABLE = [
  '1,2,3,4', // (1) 0 -> some element of the p-set is among 5,6,7,8
  '1,2,3,4,5,6', // (2) 0 -> some element of the p-set is among 7,8
  '1,2,3,4,5,6,7', // (3) 1 -> 7 found, 8 irrelevant
  '1,2,3,4,7', // (4) 1 -> 5,6 irrelevant
  '7', // (5) 0 -> some element of the p-set is among 1,2,3,4
  '1,2,7', // (6) 0 -> some element of the p-set is among 3,4
  '1,2,3,7', // (7) 0 -> 4 found
  '1,2,4,7', // (8) 0 -> 3 found
  '3,4,7', // (9) 1 -> 1,2 irrelevant
]

describe('QuickXplain matches the paper (arXiv:2001.01835 Alg. 1, Ex. 6)', () => {
  it('returns the minimal p-set the worked example arrives at', () => {
    // Note this is X and not Y: with `split(n) = ceil(n/2)`, which the example assumes and which
    // `quickXplain` uses, the divide-and-conquer order settles on {3,4,7}.
    const { p } = tracingOracle()
    expect(quickXplain(p, [], A)).toEqual(X)
  })

  it('evaluates the predicate on exactly the sets the worked example evaluates it on', () => {
    const { p, queries } = tracingOracle()
    quickXplain(p, [], A)

    // QX' skips its `p(B)` test whenever C = {} (Alg. 1 line 9), C being what was added to the
    // background since the parent's test, so the answer is already known. `quickXplain` has no C
    // parameter and re-asks. Each re-ask repeats an earlier query verbatim - never new work, and a
    // subset-verdict cache hit in the solver. Dropping them recovers the paper's table.
    const paperQueries = queries.filter((q, i) => q !== '' && queries.indexOf(q) === i)
    expect(paperQueries).toEqual(PAPER_TABLE)

    // Pinned so the redundancy stays visible: 9 real evaluations, 2 skippable re-asks.
    expect(queries).toHaveLength(11)
  })

  it('needs far fewer evaluations than the universe has elements', () => {
    // The complexity claim motivating QX over a linear deletion scan: with k = |result| = 3 and
    // n = |A| = 8, QX's bound is 2k*log2(n/k) + 2k ~ 14, against a deletion scan's n = 8 plus the
    // grow phase. The point of the assertion is that the count is bounded and stable, not lucky.
    const { p, queries } = tracingOracle()
    quickXplain(p, [], A)
    expect(queries.length).toBeLessThanOrEqual(2 * X.length * Math.log2(A.length / X.length) + 2 * X.length)
  })
})

describe('QuickXplain returns some minimal p-set for any candidate order (Def. 5)', () => {
  /** Deterministic shuffle, so a failure is reproducible from the seed alone. */
  function shuffled(seed: number): number[] {
    let state = seed
    const out = [...A]
    for (let i = out.length - 1; i > 0; i--) {
      state = (state * 1664525 + 1013904223) >>> 0
      const j = state % (i + 1)
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }

  it('lands on X or Y whichever order the candidates arrive in, and never on a reducible set', () => {
    const p = (subset: readonly number[]): boolean => contains(subset, X) || contains(subset, Y)
    const found = new Set<string>()

    for (let seed = 1; seed <= 200; seed++) {
      const order = shuffled(seed)
      const result = quickXplain(p, [], order)
      const sorted = [...result].sort((a, b) => a - b)

      expect({ seed, order, result: sorted, sufficient: p(result) }).toMatchObject({ sufficient: true })
      for (const dropped of result) {
        const rest = result.filter((e) => e !== dropped)
        expect({ seed, dropped, stillSufficient: p(rest) }).toMatchObject({ stillSufficient: false })
      }
      found.add(sorted.join(','))
    }

    // Both minimal p-sets are reachable: the output depends on the input order, as the paper's
    // Def. 5 allows (it guarantees *a* minimal p-set, not a particular one), while staying
    // deterministic for any fixed order.
    expect([...found].sort()).toEqual(['3,4,7', '4,5,8'])
  })
})

describe('QuickXplain on the trivial cases of Prop. 2', () => {
  const p = (subset: readonly number[]): boolean => contains(subset, X) || contains(subset, Y)

  it('returns the empty set when the background alone already satisfies p (Prop. 2.2)', () => {
    // "{} is a - and the only - minimal p-set wrt. <A,B> iff p(B) = 1."
    expect(quickXplain(p, X, A)).toEqual([])
  })

  it('returns every candidate when no p-set exists (Prop. 2.1), which is why callers must pre-check', () => {
    // Alg. 1 puts the `p(A u B) = 0 -> "no p-set"` test in QX, above QX'; QX' alone cannot signal
    // it and bottoms out returning each singleton. In the solver that check is `growSufficientSet`
    // returning null, and the cell then reports the empty explanation.
    const noPSet = (subset: readonly number[]): boolean => contains(subset, [9])
    expect(quickXplain(noPSet, [], A)).toEqual(A)
  })

  it('returns the empty set for an empty candidate set', () => {
    expect(quickXplain(p, [], [])).toEqual([])
  })
})
