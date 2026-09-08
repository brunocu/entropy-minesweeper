import { describe, expect, it } from 'vitest'
import {
  getEnumerationCallCountForTest,
  resetEnumerationCallCountForTest,
} from '../../solver/instrumentation.ts'
import { solveFixture } from '../solvedFixture.ts'
import { WORLDS_TREE_BOARD, WORLDS_TREE_FOCUS_CELL } from '../fixtures.ts'
import { buildWorldsTreeModel, renderWorldsTree } from '../worldsTree.ts'

const focusKey = `${WORLDS_TREE_FOCUS_CELL.row},${WORLDS_TREE_FOCUS_CELL.col}`
const worldsTreeFixture = solveFixture(WORLDS_TREE_BOARD)
const result = worldsTreeFixture.result
const focusResult = result.frontierByKey.get(focusKey)!
const worldCount = worldsTreeFixture.worlds.length

describe('worlds-tree numbers come from one enumeration', () => {
  it('gets the branches and the numbers beside them from a single enumeration', () => {
    // One `solveFixture` yields both views - the branches and the numbers quoted beside them -
    // from a single enumeration of the board.
    resetEnumerationCallCountForTest()
    const fixture = solveFixture(WORLDS_TREE_BOARD)
    const componentCount = fixture.decomposition.componentSlices.length

    expect(componentCount).toBeGreaterThan(0)
    expect(getEnumerationCallCountForTest()).toBe(componentCount)
    expect(fixture.worlds.length).toBeGreaterThan(0)
    expect(fixture.result.frontier.length).toBeGreaterThan(0)
  })

  it('draws both trees from that one solve, so they cannot disagree', () => {
    resetEnumerationCallCountForTest()
    buildWorldsTreeModel(worldsTreeFixture, WORLDS_TREE_FOCUS_CELL, 'probability')
    buildWorldsTreeModel(worldsTreeFixture, WORLDS_TREE_FOCUS_CELL, 'eig')

    expect(getEnumerationCallCountForTest()).toBe(0)
  })

  it('quotes the solver its own numbers, not numbers derived a second way', () => {
    const model = buildWorldsTreeModel(worldsTreeFixture, WORLDS_TREE_FOCUS_CELL, 'probability')
    expect(model.focusProbability).toBe(focusResult.probability)
    expect(model.focusEig).toBe(focusResult.eig)
    expect(model.totalEntropyBits).toBe(result.totalEntropyBits)
  })
})

describe('worlds-tree probability mode', () => {
  const model = buildWorldsTreeModel(worldsTreeFixture, WORLDS_TREE_FOCUS_CELL, 'probability')
  const svg = renderWorldsTree(worldsTreeFixture, WORLDS_TREE_FOCUS_CELL, 'probability')

  it('branches over every frontier cell, rooted at the focus cell', () => {
    expect(model.cellOrder.length).toBe(5)
    expect(model.unprunedLeafCount).toBe(2 ** 5)
    // Both modes root at the focus cell, so the two figures show the same top-level split and
    // the mine-branches gather into one run the drawing can bracket.
    expect(`${model.cellOrder[0].row},${model.cellOrder[0].col}`).toBe(focusKey)
  })

  it('brackets the mine-branches, labelled with the focus probability', () => {
    expect(model.brackets.length).toBe(1)
    const [bracket] = model.brackets
    expect(bracket.probability).toBeCloseTo(focusResult.probability, 10)
    expect(bracket.tipIndices).toEqual(
      model.tips.map((t, i) => ({ t, i })).filter(({ t }) => t.highlighted).map(({ i }) => i),
    )
    expect(svg).toContain('class="outcome-group"')
    expect(svg).toContain('class="outcome-group-label"')
    expect(svg).toContain(`${(focusResult.probability * 100).toFixed(1)}%`)
  })

  it('gathers the mine-branches into one contiguous run', () => {
    // Only true because the focus cell is the root; with any other ordering the bracket would
    // span branches that do not belong to it.
    const highlighted = model.tips.map((t, i) => ({ t, i })).filter(({ t }) => t.highlighted).map(({ i }) => i)
    const survivingBetween = model.tips.filter(
      (t, i) => t.surviving && i >= Math.min(...highlighted) && i <= Math.max(...highlighted),
    )
    expect(survivingBetween.length).toBe(highlighted.length)
  })

  it('keeps exactly the enumerated worlds as its surviving branches', () => {
    const surviving = model.tips.filter((t) => t.surviving)
    expect(surviving.length).toBe(worldCount)
    for (const tip of surviving) expect(tip.path.length).toBe(model.cellOrder.length)
    for (const tip of model.tips.filter((t) => !t.surviving)) expect(tip.weight).toBe(0)
  })

  it('cuts each dead branch at the depth the clues rule it out', () => {
    // A drawn tip is either a full assignment or the shallowest dead prefix: its parent must
    // still have had a consistent completion, or the cut belonged further up.
    const worlds = worldsTreeFixture.worlds
    const completions = (path: readonly (0 | 1)[]) =>
      worlds.filter((w) => path.every((v, i) => w.assignment.get(`${model.cellOrder[i].row},${model.cellOrder[i].col}`) === v)).length

    for (const tip of model.tips.filter((t) => !t.surviving)) {
      expect(completions(tip.path), `${tip.path} was drawn but still has completions`).toBe(0)
      expect(completions(tip.path.slice(0, -1)), `${tip.path} was cut too deep`).toBeGreaterThan(0)
    }
  })

  it('draws far fewer branches than the unpruned tree would', () => {
    expect(model.tips.length).toBeLessThan(model.unprunedLeafCount / 2)
  })

  it('highlights exactly the surviving branches where the focus cell is a mine', () => {
    const focusIndex = model.cellOrder.findIndex((c) => `${c.row},${c.col}` === focusKey)
    for (const tip of model.tips) {
      expect(tip.highlighted).toBe(tip.surviving && tip.path[focusIndex] === 1)
    }
  })

  it('has highlighted branch weights summing to the focus cell’s probability', () => {
    const highlightedWeight = model.tips.filter((t) => t.highlighted).reduce((sum, t) => sum + t.weight, 0)
    expect(highlightedWeight).toBeCloseTo(focusResult.probability, 10)
  })

  it('marks eliminated branches distinctly in the emitted markup', () => {
    expect(svg).toContain('class="branch-eliminated"')
    expect(svg).toContain('stroke-dasharray')
    expect(svg).toContain('class="tip-eliminated"')
    expect(svg).toContain('class="tip-highlight"')
    expect(svg).toContain(`${(focusResult.probability * 100).toFixed(1)}%`)
  })

  it('marks every cut branch, since each is a live prefix going dead', () => {
    const crosses = (svg.match(/class="branch-eliminated-mark"/g) ?? []).length
    expect(crosses).toBe(model.tips.filter((t) => !t.surviving).length)
  })
})

describe('worlds-tree EIG mode', () => {
  const model = buildWorldsTreeModel(worldsTreeFixture, WORLDS_TREE_FOCUS_CELL, 'eig')
  const svg = renderWorldsTree(worldsTreeFixture, WORLDS_TREE_FOCUS_CELL, 'eig')

  it('branches the focus cell first so its outcomes are the top-level split', () => {
    expect(`${model.cellOrder[0].row},${model.cellOrder[0].col}`).toBe(focusKey)
  })

  it('brackets one run per outcome', () => {
    expect(model.brackets.length).toBe(model.outcomeGroups.length)
    expect(model.brackets.map((b) => b.probability)).toEqual(model.outcomeGroups.map((g) => g.probability))
  })

  it('groups the same surviving branches — none gained or lost', () => {
    const grouped = model.outcomeGroups.flatMap((g) => g.tipIndices)
    expect(new Set(grouped).size).toBe(grouped.length)
    expect(grouped.length).toBe(model.tips.filter((t) => t.surviving).length)
  })

  it('partitions the branches exactly as the solver’s outcomeProbabilities do', () => {
    const solverOutcomes = focusResult.outcomeProbabilities
    expect(model.outcomeGroups.map((g) => g.outcome).sort()).toEqual([...solverOutcomes.keys()].sort())
    for (const group of model.outcomeGroups) {
      expect(group.probability).toBeCloseTo(solverOutcomes.get(group.outcome)!, 10)
      const groupWeight = group.tipIndices.reduce((sum, i) => sum + model.tips[i].weight, 0)
      expect(groupWeight).toBeCloseTo(solverOutcomes.get(group.outcome)!, 10)
    }
  })

  it('draws a bracket per outcome group alongside the full set of branches', () => {
    const brackets = svg.match(/class="outcome-group"/g) ?? []
    expect(brackets.length).toBe(model.outcomeGroups.length)
    expect((svg.match(/class="outcome-group-label"/g) ?? []).length).toBe(model.outcomeGroups.length)
  })

  it('keeps the outcome brackets clear of the deepest tip labels', () => {
    // The brackets used to sit at a fixed offset and ran straight through the full-depth tips.
    const bracketX = Math.min(...[...svg.matchAll(/class="outcome-group" d="M ([\d.]+) /g)].map((m) => Number(m[1])))
    const tipStarts = [...svg.matchAll(/class="tip-(?:surviving|eliminated)" x="([\d.]+)"/g)].map((m) => Number(m[1]))
    expect(tipStarts.length).toBe(model.tips.length)
    expect(Math.max(...tipStarts)).toBeLessThan(bracketX)
  })

})

describe.each([
  ['probability' as const],
  ['eig' as const],
])('worlds-tree %s mode fits its canvas', (mode) => {
  const svg = renderWorldsTree(worldsTreeFixture, WORLDS_TREE_FOCUS_CELL, mode)
  const [width, height] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)!.slice(1).map(Number)

  it('starts every text run inside the canvas', () => {
    // Text that begins past the right edge is text the reader never sees; the removed footer
    // overran this way, which is why the captions now live in the HTML instead.
    const xs = [...svg.matchAll(/ x="(-?[\d.]+)"/g)].map((m) => Number(m[1]))
    expect(xs.length).toBeGreaterThan(0)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...xs)).toBeLessThan(width)
  })

  it('keeps every row inside the canvas height', () => {
    const ys = [...svg.matchAll(/ y="(-?[\d.]+)"/g)].map((m) => Number(m[1]))
    expect(Math.max(...ys)).toBeLessThanOrEqual(height)
  })
})
