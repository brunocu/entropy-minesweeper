// Build-time SVG generator for the explainer's worlds-tree illustrations (design.md
// decisions 4 and 5). One generator, two modes, one fixed toy scenario: probability mode
// highlights the surviving branches where the focus cell is a mine, EIG mode groups the same
// surviving branches by what revealing that cell would show.
//
// Both modes read the same `enumerateWeightedWorlds` output the real solver derives its
// probabilities and EIG from, so the picture cannot disagree with the numbers.
//
// The tree is pruned, not complete: a branch stops at the depth where the clues rule it out,
// rather than fanning out to 2^n leaves most of which are dead. That is also how the solver
// works - `enumerateComponentFull` backtracks as soon as a partial assignment stops being
// consistent - so the drawing shows the search that actually runs.
import { toLabel } from '../board/chessLabel.ts'
import { EIG_HIGH_COLOR, MINE_POLE_COLOR, SAFE_POLE_COLOR } from '../render/probabilityColor.ts'
import {
  enumerateWeightedWorlds,
  outcomeKey,
  solve,
  type Coord,
  type SolverBoard,
  type WeightedWorld,
} from '../solver/frontierSolver.ts'

export type WorldsTreeMode = 'probability' | 'eig'

/**
 * A point where the drawing stops: either a complete consistent assignment (a surviving world),
 * or the shallowest partial assignment the clues have already ruled out.
 */
export interface TreeTip {
  /** Mine (1) / safe (0) per branched cell, in `cellOrder`. Shorter than `cellOrder` when cut early. */
  readonly path: readonly (0 | 1)[]
  /** True for a complete, consistent assignment; false for a branch cut as eliminated. */
  readonly surviving: boolean
  /** The world's normalized weight, or 0 for an eliminated branch. */
  readonly weight: number
  /** Probability mode: a surviving world in which the focus cell is a mine. */
  readonly highlighted: boolean
  /** EIG mode: what revealing the focus cell would show in this world; null when eliminated. */
  readonly outcome: string | null
}

/**
 * A run of tips bracketed to the right of the tree, with the share of probability it carries.
 * Probability mode brackets the worlds where the focus cell is a mine; EIG mode brackets one
 * run per outcome. Both are the same visual claim: "these branches together are worth X".
 */
export interface TreeBracket {
  readonly label: string
  readonly probability: number
  /** Indices into `WorldsTreeModel.tips`, always a contiguous run of surviving tips. */
  readonly tipIndices: readonly number[]
}

/** EIG mode: one of the focus cell's possible outcomes, and the worlds it would leave standing. */
export interface OutcomeGroup {
  readonly outcome: string
  readonly probability: number
  /** Indices into `WorldsTreeModel.tips`, always a contiguous run (see `groupTips`). */
  readonly tipIndices: readonly number[]
}

export interface WorldsTreeModel {
  readonly mode: WorldsTreeMode
  /** Branching order, one level per cell, outermost first. */
  readonly cellOrder: readonly Coord[]
  readonly focusCell: Coord
  /** Every drawn endpoint, top to bottom. */
  readonly tips: readonly TreeTip[]
  /** How many leaves an unpruned tree would have had, for comparison in the prose. */
  readonly unprunedLeafCount: number
  /** The focus cell's mine probability, per the solver. */
  readonly focusProbability: number
  /** The focus cell's expected information gain in bits, per the solver. */
  readonly focusEig: number
  /** Total uncertainty across the surviving worlds, in bits. */
  readonly totalEntropyBits: number
  /** EIG mode only; empty in probability mode. */
  readonly outcomeGroups: readonly OutcomeGroup[]
  /** What the drawing brackets, in either mode. */
  readonly brackets: readonly TreeBracket[]
}

function key(cell: Coord): string {
  return `${cell.row},${cell.col}`
}

function matches(world: WeightedWorld, cellOrder: readonly Coord[], path: readonly (0 | 1)[]): boolean {
  return path.every((value, i) => world.assignment.get(key(cellOrder[i])) === value)
}

/**
 * What the focus cell would show in one world. Only defined when every unrevealed neighbor of
 * the focus cell is itself a frontier cell - otherwise a single world spreads across several
 * outcomes via the non-frontier hypergeometric term (`computeFrontierCellResult`), and a tip
 * could not carry one outcome label. Every fixture this generator draws satisfies that, and
 * the throw keeps a future fixture from silently getting a wrong picture.
 */
function outcomeInWorld(board: SolverBoard, focusCell: Coord, world: WeightedWorld): string {
  if (world.assignment.get(key(focusCell)) === 1) return outcomeKey({ type: 'mine' })
  let adjacentMines = 0
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const row = focusCell.row + dr
      const col = focusCell.col + dc
      if (row < 0 || row >= board.height || col < 0 || col >= board.width) continue
      if (board.cells[row][col].revealed) continue
      const value = world.assignment.get(key({ row, col }))
      if (value === undefined) {
        throw new Error(
          `worlds-tree fixture has a non-frontier unrevealed neighbor at ${toLabel(row, col)}; ` +
            'its outcome is not determined by the enumerated worlds alone',
        )
      }
      adjacentMines += value
    }
  }
  return outcomeKey({ type: 'safe', adjacentMines })
}

function groupTips(tips: readonly TreeTip[]): OutcomeGroup[] {
  const byOutcome = new Map<string, number[]>()
  tips.forEach((tip, index) => {
    if (!tip.surviving || tip.outcome === null) return
    const existing = byOutcome.get(tip.outcome)
    if (existing) existing.push(index)
    else byOutcome.set(tip.outcome, [index])
  })

  return [...byOutcome].map(([outcome, tipIndices]) => {
    // The illustration draws each group as one bracket spanning its tips, which is only
    // truthful for a contiguous run. Branching the focus cell first makes the mine group
    // contiguous by construction; a fixture whose safe outcomes interleave would need a
    // different drawing, so refuse rather than mislabel.
    const surviving = tips.map((tip, i) => ({ tip, i })).filter(({ tip }) => tip.surviving)
    const first = surviving.findIndex(({ i }) => i === tipIndices[0])
    const run = surviving.slice(first, first + tipIndices.length).map(({ i }) => i)
    if (run.join(',') !== tipIndices.join(',')) {
      throw new Error(`outcome "${outcome}" does not occupy a contiguous run of surviving branches`)
    }
    return {
      outcome,
      probability: tipIndices.reduce((sum, i) => sum + tips[i].weight, 0),
      tipIndices,
    }
  })
}

/** A drawn node: an internal branch point, or a tip where the drawing stops. */
interface LayoutNode {
  readonly path: readonly (0 | 1)[]
  readonly children: LayoutNode[]
  /** Index into the model's `tips`, or null for an internal node. */
  readonly tipIndex: number | null
  /** Row centre, in tip units. */
  y: number
}

interface BuiltTree {
  readonly model: WorldsTreeModel
  readonly root: LayoutNode
}

/**
 * The data behind either illustration: the pruned branching structure, where the clues cut each
 * dead branch off, and what survives, plus the laid-out node tree the drawing walks.
 */
function buildTree(board: SolverBoard, focusCell: Coord, mode: WorldsTreeMode): BuiltTree {
  const { frontierCells, worlds } = enumerateWeightedWorlds(board)
  const { result } = solve(board, new Map())
  const focus = result.frontier.find((f) => f.row === focusCell.row && f.col === focusCell.col)
  if (!focus) throw new Error(`focus cell ${toLabel(focusCell.row, focusCell.col)} is not a frontier cell`)

  // The focus cell is always the root. In EIG mode that makes the outcome being grouped the
  // tree's own top-level split; in probability mode it gathers the branches where the focus is
  // a mine into one contiguous run, which is what lets the drawing bracket them.
  const cellOrder = [focusCell, ...frontierCells.filter((c) => key(c) !== key(focusCell))]

  const tips: TreeTip[] = []

  // Depth-first with mine (1) before safe (0), so the focus cell's mine branch is the top of
  // the drawing in EIG mode and highlighted branches cluster in probability mode.
  const build = (path: (0 | 1)[]): LayoutNode => {
    const consistent = worlds.filter((w) => matches(w, cellOrder, path))

    if (consistent.length === 0) {
      // Cut here: no consistent world extends this prefix, and drawing its subtree would only
      // add branches that are dead for a reason already visible at this node.
      tips.push({ path: [...path], surviving: false, weight: 0, highlighted: false, outcome: null })
      return { path: [...path], children: [], tipIndex: tips.length - 1, y: 0 }
    }

    if (path.length === cellOrder.length) {
      const world = consistent[0]
      tips.push({
        path: [...path],
        surviving: true,
        weight: world.weight,
        highlighted: mode === 'probability' && world.assignment.get(key(focusCell)) === 1,
        outcome: mode === 'eig' ? outcomeInWorld(board, focusCell, world) : null,
      })
      return { path: [...path], children: [], tipIndex: tips.length - 1, y: 0 }
    }

    const children = ([1, 0] as const).map((value) => build([...path, value]))
    return { path: [...path], children, tipIndex: null, y: 0 }
  }

  const root = build([])

  // Tips were pushed in draw order, so their row is their index; an internal node sits at the
  // midpoint of the children it joins.
  const place = (node: LayoutNode): number => {
    if (node.tipIndex !== null) {
      node.y = node.tipIndex
      return node.y
    }
    const ys = node.children.map(place)
    node.y = (Math.min(...ys) + Math.max(...ys)) / 2
    return node.y
  }
  place(root)

  const outcomeGroups = mode === 'eig' ? groupTips(tips) : []
  const highlighted = tips.map((tip, i) => ({ tip, i })).filter(({ tip }) => tip.highlighted)
  const brackets: TreeBracket[] =
    mode === 'eig'
      ? outcomeGroups.map((group) => ({
          label: describeOutcome(group.outcome),
          probability: group.probability,
          tipIndices: group.tipIndices,
        }))
      : highlighted.length > 0
        ? [
            {
              label: `${toLabel(focusCell.row, focusCell.col)} is a mine`,
              probability: highlighted.reduce((sum, { tip }) => sum + tip.weight, 0),
              tipIndices: highlighted.map(({ i }) => i),
            },
          ]
        : []

  return {
    root,
    model: {
      mode,
      cellOrder,
      focusCell,
      tips,
      unprunedLeafCount: 2 ** cellOrder.length,
      focusProbability: focus.probability,
      focusEig: focus.eig,
      totalEntropyBits: result.totalEntropyBits,
      outcomeGroups,
      brackets,
    },
  }
}

/** The illustration's underlying numbers, so they can be checked against the solver directly. */
export function buildWorldsTreeModel(board: SolverBoard, focusCell: Coord, mode: WorldsTreeMode): WorldsTreeModel {
  return buildTree(board, focusCell, mode).model
}

// --- Drawing ---

const ROW_HEIGHT = 26
const COLUMN_WIDTH = 118
const MARGIN_LEFT = 14
const MARGIN_TOP = 46
const ELIMINATED_COLOR = '#9a968f'
const SURVIVING_COLOR = '#3d3a35'
const TIP_FONT_SIZE = 11.5
const GROUP_FONT_SIZE = 11

/**
 * Rough advance width for the sans-serif faces this renders in. There is no text measurement
 * at build time, so columns are laid out from an estimate with room to spare - the alternative
 * was a fixed label column, which clipped long tips and collided with the outcome brackets.
 */
function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.62
}

function escapeXml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!)
}

function describeOutcome(outcome: string): string {
  return outcome === 'mine' ? 'mine' : `${outcome.slice('safe:'.length)} adjacent`
}

/** Renders one mode's illustration as standalone inline SVG markup. */
export function renderWorldsTree(board: SolverBoard, focusCell: Coord, mode: WorldsTreeMode): string {
  const { model, root } = buildTree(board, focusCell, mode)

  const nodeX = (node: LayoutNode): number => MARGIN_LEFT + node.path.length * COLUMN_WIDTH
  const nodeY = (node: LayoutNode): number => MARGIN_TOP + (node.y + 0.5) * ROW_HEIGHT

  const tipLabel = (tip: (typeof model.tips)[number]): string => {
    const assignment = tip.path
      .map((v, i) => `${toLabel(model.cellOrder[i].row, model.cellOrder[i].col)}${v === 1 ? '✱' : '·'}`)
      .join(' ')
    return tip.surviving ? `${assignment}  ${(tip.weight * 100).toFixed(1)}%` : `${assignment} — ruled out`
  }
  const tipX = (tip: (typeof model.tips)[number]): number => MARGIN_LEFT + tip.path.length * COLUMN_WIDTH + 10

  // Tips sit at different depths now that branches are cut early, so the label column has to be
  // measured rather than assumed: the widest right-hand edge decides where anything else starts.
  const labelRight = Math.max(...model.tips.map((tip) => tipX(tip) + estimateTextWidth(tipLabel(tip), TIP_FONT_SIZE)))
  const bracketX = labelRight + 20
  const bracketLabel = (bracket: (typeof model.brackets)[number]): string =>
    `${bracket.label} · ${(bracket.probability * 100).toFixed(1)}%`
  const bracketLabelWidth =
    model.brackets.length > 0
      ? Math.max(...model.brackets.map((b) => estimateTextWidth(bracketLabel(b), GROUP_FONT_SIZE)))
      : 0

  const width =
    model.brackets.length > 0 ? bracketX + 13 + bracketLabelWidth + MARGIN_LEFT : labelRight + MARGIN_LEFT
  const height = MARGIN_TOP + model.tips.length * ROW_HEIGHT + 8

  const parts: string[] = []

  // Column headers: which cell each level branches on.
  model.cellOrder.forEach((cell, level) => {
    const label = toLabel(cell.row, cell.col)
    const isFocus = key(cell) === key(model.focusCell)
    parts.push(
      `<text x="${MARGIN_LEFT + level * COLUMN_WIDTH + COLUMN_WIDTH / 2}" y="26" text-anchor="middle" ` +
        `font-size="13" font-weight="${isFocus ? '700' : '500'}" fill="${isFocus ? EIG_HIGH_COLOR : SURVIVING_COLOR}">` +
        `${escapeXml(label)}${isFocus ? ' (focus)' : ''}</text>`,
    )
  })

  const drawEdges = (node: LayoutNode): void => {
    for (const child of node.children) {
      const alive = child.tipIndex === null || model.tips[child.tipIndex].surviving
      const value = child.path[child.path.length - 1]
      const color = alive ? SURVIVING_COLOR : ELIMINATED_COLOR
      parts.push(
        `<path class="${alive ? 'branch-alive' : 'branch-eliminated'}" d="M ${nodeX(node)} ${nodeY(node)} ` +
          `H ${nodeX(node) + COLUMN_WIDTH / 2} V ${nodeY(child)} H ${nodeX(child)}" fill="none" stroke="${color}" ` +
          `stroke-width="${alive ? 1.8 : 1}"${alive ? '' : ' stroke-dasharray="4 3"'} />`,
      )
      parts.push(
        `<text x="${nodeX(node) + COLUMN_WIDTH / 2 + 4}" y="${nodeY(child) - 4}" font-size="11" ` +
          `fill="${alive ? (value === 1 ? MINE_POLE_COLOR : SAFE_POLE_COLOR) : ELIMINATED_COLOR}">` +
          `${value === 1 ? 'mine' : 'safe'}</text>`,
      )
      // Every cut branch is exactly a point where a live prefix goes dead, so each one is
      // worth marking - there are no long dead subtrees left to bury the crosses in.
      if (!alive) {
        parts.push(
          `<text class="branch-eliminated-mark" x="${nodeX(child) - 12}" y="${nodeY(child) + 4}" font-size="13" ` +
            `fill="${MINE_POLE_COLOR}">&#10005;</text>`,
        )
      }
      drawEdges(child)
    }
  }
  drawEdges(root)

  // Tip labels, each written at the depth its branch reached.
  model.tips.forEach((tip, index) => {
    const y = MARGIN_TOP + (index + 0.5) * ROW_HEIGHT
    const x = tipX(tip)
    const assignmentText = tip.path
      .map((v, i) => `${toLabel(model.cellOrder[i].row, model.cellOrder[i].col)}${v === 1 ? '✱' : '·'}`)
      .join(' ')

    if (!tip.surviving) {
      parts.push(
        `<text class="tip-eliminated" x="${x}" y="${y + 4}" font-size="${TIP_FONT_SIZE}" fill="${ELIMINATED_COLOR}">` +
          `${escapeXml(assignmentText)} &#8212; ruled out</text>`,
      )
      return
    }
    if (tip.highlighted) {
      parts.push(
        `<rect class="tip-highlight" x="${x - 6}" y="${y - 11}" ` +
          `width="${estimateTextWidth(tipLabel(tip), TIP_FONT_SIZE) + 12}" height="22" ` +
          `rx="4" fill="${MINE_POLE_COLOR}" fill-opacity="0.14" stroke="${MINE_POLE_COLOR}" stroke-width="1.5" />`,
      )
    }
    parts.push(
      `<text class="tip-surviving" x="${x}" y="${y + 4}" font-size="${TIP_FONT_SIZE}" font-weight="600" ` +
        `fill="${SURVIVING_COLOR}">${escapeXml(assignmentText)}` +
        `<tspan dx="8" font-weight="400" fill="${ELIMINATED_COLOR}">${(tip.weight * 100).toFixed(1)}%</tspan></text>`,
    )
  })

  // Brackets sit in their own column, clear of the tip labels: the worlds where the focus cell
  // is a mine in probability mode, one run per outcome in EIG mode.
  const bracketColor = model.mode === 'eig' ? EIG_HIGH_COLOR : MINE_POLE_COLOR
  for (const bracket of model.brackets) {
    const indices = bracket.tipIndices
    const top = MARGIN_TOP + Math.min(...indices) * ROW_HEIGHT + 3
    const bottom = MARGIN_TOP + (Math.max(...indices) + 1) * ROW_HEIGHT - 3
    parts.push(
      `<path class="outcome-group" d="M ${bracketX + 8} ${top} H ${bracketX} V ${bottom} H ${bracketX + 8}" ` +
        `fill="none" stroke="${bracketColor}" stroke-width="2" />`,
    )
    parts.push(
      `<text class="outcome-group-label" x="${bracketX + 13}" y="${(top + bottom) / 2 + 4}" ` +
        `font-size="${GROUP_FONT_SIZE}" fill="${bracketColor}">${escapeXml(bracketLabel(bracket))}</text>`,
    )
  }

  return (
    `<svg class="worlds-tree worlds-tree--${model.mode}" xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" ` +
    `role="img" aria-label="Pruned possible-worlds tree for the toy scenario, ${model.mode} mode" ` +
    `font-family="system-ui, sans-serif">${parts.join('')}</svg>`
  )
}
