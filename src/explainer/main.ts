// Runtime code for the explainer page. Only the predicted-vs-realized widget needs the browser
// (design.md decision 2a) - every other illustration arrives as static markup injected at build
// time by the Vite plugin in vite.config.ts.
import { WORLDS_TREE_BOARD, WORLDS_TREE_FOCUS_CELL } from './fixtures.ts'
import { createRevealDemo } from './revealDemo.ts'

const canvas = document.querySelector<HTMLCanvasElement>('#demo-canvas')
const predicted = document.querySelector<HTMLElement>('#demo-predicted')
const realized = document.querySelector<HTMLElement>('#demo-realized')
const narration = document.querySelector<HTMLElement>('#demo-narration')
const reset = document.querySelector<HTMLButtonElement>('#demo-reset')

if (canvas && predicted && realized && narration && reset) {
  createRevealDemo({ canvas, predicted, realized, narration, reset }, WORLDS_TREE_BOARD, WORLDS_TREE_FOCUS_CELL)
}
