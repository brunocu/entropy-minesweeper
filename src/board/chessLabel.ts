// Pure (row, col) -> chess-style label conversion. Row 0 is row number 1 (row 1 at top,
// matching boardRenderer's top-down draw order), columns are A, B, ... Z, AA, AB, ...
// (bijective base-26, like spreadsheet columns). Display concern only - never used as the
// solver's internal cell identity (see the solver's own `key(row, col)` in types.ts).

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
