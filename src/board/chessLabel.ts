// Pure (row, col) <-> chess-style label conversion. Row 0 is row number 1 (row 1 at top,
// matching boardRenderer's top-down draw order), columns are A, B, ... Z, AA, AB, ...
// (bijective base-26, like spreadsheet columns). Display concern only - never used as the
// solver's internal cell identity (see frontierSolver.ts's own `key(row, col)`).

const LABEL_PATTERN = /^([A-Za-z]+)(\d+)$/

export function toLabel(row: number, col: number): string {
  let n = col + 1
  let letters = ''
  while (n > 0) {
    n -= 1
    letters = String.fromCharCode(65 + (n % 26)) + letters
    n = Math.floor(n / 26)
  }
  return `${letters}${row + 1}`
}

export function fromLabel(label: string): { row: number; col: number } {
  const match = LABEL_PATTERN.exec(label)
  if (!match) throw new Error(`Invalid chess label: ${label}`)
  const [, letters, digits] = match
  let col = 0
  for (const ch of letters.toUpperCase()) {
    col = col * 26 + (ch.charCodeAt(0) - 65 + 1)
  }
  col -= 1
  const row = Number(digits) - 1
  return { row, col }
}
