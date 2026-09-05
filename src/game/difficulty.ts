export interface Difficulty {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly mineCount: number
}

export const DIFFICULTIES: readonly Difficulty[] = [
  { name: 'Beginner', width: 9, height: 9, mineCount: 10 },
  { name: 'Intermediate', width: 16, height: 16, mineCount: 40 },
  { name: 'Expert', width: 30, height: 16, mineCount: 99 },
]
