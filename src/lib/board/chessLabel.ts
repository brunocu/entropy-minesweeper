// (row, col) -> chess-style label. Row 0 is row 1 at the top, matching boardRenderer's draw order;
// columns are A, B, ... Z, AA, AB (bijective base-26, like spreadsheet columns). Display only -
// the solver's internal identity is its own `key(row, col)` in types.ts.

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
