// The `tokens.ts` -> CSS derivation, served as `virtual:tokens.css` by the plugin at the repo root.
import { tokens } from './tokens.ts'

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

export function renderTokensCss(): string {
  const declarations = Object.entries(tokens).map(([name, value]) => `  --${kebab(name)}: ${value};`)
  return [
    '/* Generated from src/lib/tokens.ts — do not edit. */',
    ':root {',
    ...declarations,
    '}',
    '',
  ].join('\n')
}
