import { describe, expect, it } from 'vitest'
import { createUncertaintyChart } from './uncertaintyChart.ts'

// No DOM/canvas available in this sandbox (see boardRenderer.test.ts's note), so actual uPlot
// construction against a real container can't be exercised here; this confirms the module
// compiles and exports the expected function, per tasks.md 3.2's stated fallback.
describe('uncertaintyChart module', () => {
  it('exports createUncertaintyChart as a function', () => {
    expect(typeof createUncertaintyChart).toBe('function')
  })
})
