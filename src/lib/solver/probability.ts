// Exact probabilistic inference over a minesweeper board's frontier: worlds, per-cell mine
// probabilities, expected information gain, and outcome distributions.

import { neighbors, type Decomposition } from './decomposition.ts'
import {
  componentSignature,
  enumerateComponentFull,
  type ComponentCache,
  type ComponentCacheEntry,
} from './componentEnumeration.ts'
import { incrementEnumerationCallCount } from './instrumentation.ts'
import {
  key,
  type CellOutcome,
  type Coord,
  type FrontierCellResult,
  type SolveResult,
  type SolverBoard,
} from './types.ts'

function cartesianProduct<T>(arrays: readonly T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, arr) => acc.flatMap((prefix) => arr.map((item) => [...prefix, item])), [[]])
}

/** C(n, k), computed iteratively as a float to stay numerically stable for large n. */
function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  const kk = Math.min(k, n - k)
  let result = 1
  for (let i = 0; i < kk; i++) {
    result = (result * (n - i)) / (i + 1)
  }
  return result
}

function shannonEntropy(weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return 0
  let h = 0
  for (const w of weights) {
    if (w <= 0) continue
    const p = w / total
    h -= p * Math.log2(p)
  }
  return h
}

export function outcomeKey(outcome: CellOutcome): string {
  return outcome.type === 'mine' ? 'mine' : `safe:${outcome.adjacentMines}`
}

interface ComboData {
  readonly weight: number
  readonly remaining: number
  readonly fullAssignment: ReadonlyMap<string, 0 | 1>
}

interface NeighborInfo {
  readonly frontierNeighborKeys: string[]
  readonly shadowNeighborCount: number
}

function computeNeighborInfo(board: SolverBoard, x: Coord, frontierSet: ReadonlySet<string>): NeighborInfo {
  let shadowNeighborCount = 0
  const frontierNeighborKeys: string[] = []
  for (const n of neighbors(board, x.row, x.col)) {
    const cell = board.cells[n.row][n.col]
    if (cell.revealed) continue
    const k = key(n.row, n.col)
    if (frontierSet.has(k)) {
      frontierNeighborKeys.push(k)
    } else {
      shadowNeighborCount++
    }
  }
  return { frontierNeighborKeys, shadowNeighborCount }
}

/**
 * EIG and outcome distribution for one frontier cell.
 *
 * A frontier cell can have unrevealed neighbors that are themselves non-frontier. Their status
 * still affects what number this cell shows once revealed, so rather than tracking them
 * individually - which would merge otherwise-independent components - their contribution folds in
 * exactly via the hypergeometric distribution implied by "R remaining mines spread uniformly across
 * K non-frontier cells": the shadow neighbors are a known subset of those K.
 */
function computeFrontierCellResult(
  x: Coord,
  xKey: string,
  info: NeighborInfo,
  combosData: readonly ComboData[],
  K: number,
  probabilityOf: (k: string) => number,
): FrontierCellResult {
  const entries: { outcome: string; weight: number }[] = []

  for (const combo of combosData) {
    const xValue = combo.fullAssignment.get(xKey)
    if (xValue === 1) {
      entries.push({ outcome: 'mine', weight: combo.weight })
      continue
    }
    const knownCount = info.frontierNeighborKeys.reduce(
      (sum, nk) => sum + (combo.fullAssignment.get(nk) === 1 ? 1 : 0),
      0,
    )
    const sx = info.shadowNeighborCount
    const maxJ = Math.min(sx, combo.remaining)
    for (let j = 0; j <= maxJ; j++) {
      const w = binomial(sx, j) * binomial(K - sx, combo.remaining - j)
      if (w > 0) entries.push({ outcome: `safe:${knownCount + j}`, weight: w })
    }
  }

  const totalWeight = entries.reduce((s, e) => s + e.weight, 0)
  const groupWeights = new Map<string, number>()
  for (const e of entries) groupWeights.set(e.outcome, (groupWeights.get(e.outcome) ?? 0) + e.weight)

  const outcomeProbabilities = new Map<string, number>()
  for (const [outcome, w] of groupWeights) {
    outcomeProbabilities.set(outcome, totalWeight > 0 ? w / totalWeight : 0)
  }

  const hFull = shannonEntropy(entries.map((e) => e.weight))
  let expectedConditional = 0
  for (const [outcome, groupWeight] of groupWeights) {
    const groupEntryWeights = entries.filter((e) => e.outcome === outcome).map((e) => e.weight)
    const hGroup = shannonEntropy(groupEntryWeights)
    const pOutcome = totalWeight > 0 ? groupWeight / totalWeight : 0
    expectedConditional += pOutcome * hGroup
  }
  const eig = hFull - expectedConditional

  return {
    row: x.row,
    col: x.col,
    probability: probabilityOf(xKey),
    eig,
    outcomeProbabilities,
  }
}

const EMPTY_FLAGGED_CELLS: ReadonlySet<string> = new Set()

export interface SolveWithCache {
  readonly result: SolveResult
  /**
   * The individual weighted worlds `result` aggregates over, in enumeration order, keyed by the
   * solver's own `row,col` key and indexable against `result.frontier`.
   *
   * Reported alongside the aggregates because they come from the same enumeration: the worlds-tree
   * illustration draws these branches and quotes `result`'s numbers beside them. The live game
   * ignores this field.
   */
  readonly worlds: readonly WeightedWorld[]
  readonly cache: ComponentCache
}

interface WorldEnumeration {
  readonly frontierCoords: readonly Coord[]
  readonly frontierKeys: readonly string[]
  readonly frontierSet: ReadonlySet<string>
  readonly nonFrontierCells: readonly Coord[]
  /** One entry per surviving combination of component assignments, with its mine-count weight. */
  readonly combosData: readonly ComboData[]
  /** Total (unnormalized) weight across `combosData`. */
  readonly Z: number
  readonly sumMineWeight: ReadonlyMap<string, number>
  readonly sumNonFrontierWeighted: number
  readonly cache: ComponentCache
}

/**
 * The enumeration half of the pipeline: frontier -> components -> worlds, each weighted by how many
 * ways its leftover mines can fall across the non-frontier cells. `solve` turns this into
 * probabilities/EIG and passes the worlds through verbatim, so the two views cannot drift.
 */
function enumerateWorlds(decomposition: Decomposition, previousCache: ComponentCache): WorldEnumeration {
  const { board, frontierCoords, frontierKeys, frontierSet, componentSlices, nonFrontierCells } = decomposition

  const newCache = new Map<string, ComponentCacheEntry>()
  const componentResultsList = componentSlices.map(({ cells, relevantConstraints }) => {
    const signature = componentSignature(cells, relevantConstraints, EMPTY_FLAGGED_CELLS)
    const cached = previousCache.get(signature)
    let enumeration = cached?.enumeration
    if (!enumeration) {
      incrementEnumerationCallCount()
      enumeration = enumerateComponentFull(cells, relevantConstraints)
    }
    newCache.set(signature, { enumeration, explanations: cached?.explanations })
    return enumeration.assignments
  })

  const K = nonFrontierCells.length
  const remainingMines = board.mineCount

  const combos = cartesianProduct(componentResultsList)

  const sumMineWeight = new Map<string, number>()
  for (const k of frontierKeys) sumMineWeight.set(k, 0)

  let Z = 0
  let sumNonFrontierWeighted = 0
  const combosData: ComboData[] = []

  for (const combo of combos) {
    let M = 0
    const fullAssignment = new Map<string, 0 | 1>()
    for (const compAssignment of combo) {
      M += compAssignment.mineCount
      for (const [k, v] of compAssignment.assignment) fullAssignment.set(k, v)
    }
    const remaining = remainingMines - M
    if (remaining < 0 || remaining > K) continue
    const weight = binomial(K, remaining)
    if (weight <= 0) continue
    Z += weight
    sumNonFrontierWeighted += weight * remaining
    for (const [k, v] of fullAssignment) {
      if (v === 1) sumMineWeight.set(k, (sumMineWeight.get(k) ?? 0) + weight)
    }
    combosData.push({ weight, remaining, fullAssignment })
  }

  return {
    frontierCoords,
    frontierKeys,
    frontierSet,
    nonFrontierCells,
    combosData,
    Z,
    sumMineWeight,
    sumNonFrontierWeighted,
    cache: newCache,
  }
}

/** One enumerated possible world: what every frontier cell is, and how much it weighs. */
export interface WeightedWorld {
  /** 1 (mine) or 0 (safe) for every frontier cell, keyed by the solver's own `row,col` key. */
  readonly assignment: ReadonlyMap<string, 0 | 1>
  /** This world's share of the total probability mass; weights across all worlds sum to 1. */
  readonly weight: number
  /** How many of the board's mines this world leaves for the non-frontier cells. */
  readonly nonFrontierMines: number
}

function toWeightedWorlds(enumeration: WorldEnumeration): WeightedWorld[] {
  const { combosData, Z } = enumeration
  return combosData.map((combo) => ({
    assignment: combo.fullAssignment,
    weight: Z > 0 ? combo.weight / Z : 0,
    nonFrontierMines: combo.remaining,
  }))
}

/**
 * Runs the enumerating half of the pipeline over a decomposition: worlds -> probabilities/EIG,
 * reporting both the aggregates and the worlds they came from.
 *
 * The one way in. Neither half reconstructs the other - a `SolveResult` has lost the worlds, and
 * total uncertainty is `log2(Z)`, which normalized weights no longer carry - so separate entry
 * points would mean enumerating a board twice. The world list costs a fraction of the EIG pass this
 * already runs.
 *
 * Takes the decomposition rather than the board because `GameController` runs this and
 * `computeExplanations` against the same board every move, sharing that phase.
 *
 * Has no access to flagged cells, so its per-component signature uses an empty flagged set.
 * `enumerateComponentFull` never depends on flags, so this is safe; it only occasionally misses a
 * hit `computeExplanations` could have supplied.
 */
export function solve(decomposition: Decomposition, previousCache: ComponentCache): SolveWithCache {
  const { board } = decomposition
  const enumeration = enumerateWorlds(decomposition, previousCache)
  const {
    frontierCoords,
    frontierSet,
    nonFrontierCells,
    combosData,
    Z,
    sumMineWeight,
    sumNonFrontierWeighted,
    cache: newCache,
  } = enumeration
  const K = nonFrontierCells.length

  const probabilityOf = (k: string): number => (Z > 0 ? (sumMineWeight.get(k) ?? 0) / Z : NaN)
  const nonFrontierProbability = K > 0 && Z > 0 ? sumNonFrontierWeighted / (Z * K) : null

  const frontierByKey = new Map<string, FrontierCellResult>()
  const frontierResults = frontierCoords.map((x) => {
    const xKey = key(x.row, x.col)
    const info = computeNeighborInfo(board, x, frontierSet)
    const cellResult = computeFrontierCellResult(x, xKey, info, combosData, K, probabilityOf)
    frontierByKey.set(xKey, cellResult)
    return cellResult
  })

  const totalEntropyBits = Z > 0 ? Math.log2(Z) : 0

  return {
    result: { frontier: frontierResults, frontierByKey, nonFrontierProbability, nonFrontierCells, totalEntropyBits },
    worlds: toWeightedWorlds(enumeration),
    cache: newCache,
  }
}
