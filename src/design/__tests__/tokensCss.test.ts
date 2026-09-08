import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderTokensCss } from '../renderTokensCss.ts'

// tokens.css is generated from tokens.ts and committed, so a fresh clone needs no build step. That
// only stays safe if the committed copy is current: this asserts it byte-for-byte, so editing a
// token without rerunning `node scripts/generate-tokens.mjs` fails the suite rather than shipping
// two disagreeing palettes.
describe('generated tokens.css', () => {
  it('matches what the generator would emit from tokens.ts right now', () => {
    const committed = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8')
    expect(committed).toBe(renderTokensCss())
  })
})
