import { describe, expect, it } from 'vitest'
import { Board } from '../../board/board.ts'
import { DIFFICULTIES, DIFFICULTY } from '../difficulty.ts'

describe('board size/difficulty presets', () => {
  it('defines Beginner, Intermediate, and Expert presets with the standard dimensions and mine counts', () => {
    expect(DIFFICULTY.Beginner).toEqual({ name: 'Beginner', width: 9, height: 9, mineCount: 10 })
    expect(DIFFICULTY.Intermediate).toEqual({ name: 'Intermediate', width: 16, height: 16, mineCount: 40 })
    expect(DIFFICULTY.Expert).toEqual({ name: 'Expert', width: 30, height: 16, mineCount: 99 })
  })

  it('lists every preset in menu order, each keyed under its own name', () => {
    expect(DIFFICULTIES).toEqual([DIFFICULTY.Beginner, DIFFICULTY.Intermediate, DIFFICULTY.Expert])
    for (const [name, difficulty] of Object.entries(DIFFICULTY)) expect(difficulty.name).toBe(name)
  })

  it('each preset builds a board with matching dimensions and mine count', () => {
    for (const difficulty of DIFFICULTIES) {
      const board = new Board(difficulty.width, difficulty.height, difficulty.mineCount)
      expect(board.width).toBe(difficulty.width)
      expect(board.height).toBe(difficulty.height)
      board.reveal(Math.floor(difficulty.height / 2), Math.floor(difficulty.width / 2))
      expect(board.cells.flat().filter((c) => c.isMine)).toHaveLength(difficulty.mineCount)
    }
  })
})
