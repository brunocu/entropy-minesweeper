import { describe, expect, it } from 'vitest'
import { Board } from '../../board/board.ts'
import { DIFFICULTIES } from '../difficulty.ts'

describe('board size/difficulty presets', () => {
  it('defines Beginner, Intermediate, and Expert presets with the standard dimensions and mine counts', () => {
    const byName = new Map(DIFFICULTIES.map((d) => [d.name, d]))
    expect(byName.get('Beginner')).toEqual({ name: 'Beginner', width: 9, height: 9, mineCount: 10 })
    expect(byName.get('Intermediate')).toEqual({ name: 'Intermediate', width: 16, height: 16, mineCount: 40 })
    expect(byName.get('Expert')).toEqual({ name: 'Expert', width: 30, height: 16, mineCount: 99 })
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
