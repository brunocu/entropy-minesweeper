export interface Difficulty {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly mineCount: number
}

export const DIFFICULTY = {
  Beginner: { name: 'Beginner', width: 9, height: 9, mineCount: 10 },
  Intermediate: { name: 'Intermediate', width: 16, height: 16, mineCount: 40 },
  Expert: { name: 'Expert', width: 30, height: 16, mineCount: 99 },
} as const satisfies Record<string, Difficulty>

export type DifficultyName = keyof typeof DIFFICULTY

/** The presets in menu order. */
export const DIFFICULTIES = Object.values(DIFFICULTY)
