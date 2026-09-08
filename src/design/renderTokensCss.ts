// The `tokens.ts` -> `tokens.css` derivation, kept in TypeScript so both consumers can import it:
// `scripts/generate-tokens.mjs` writes its output to disk, and the freshness test compares it
// against the committed file. Node strips the types when the script imports this at build time.
import { tokens } from './tokens.ts'

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/** Renders the full contents of `src/design/tokens.css`. */
export function renderTokensCss(): string {
  const declarations = Object.entries(tokens).map(([name, value]) => `  --${kebab(name)}: ${value};`)
  return [
    '/* Generated from src/design/tokens.ts by scripts/generate-tokens.mjs — do not edit. */',
    ':root {',
    ...declarations,
    '}',
    '',
  ].join('\n')
}
