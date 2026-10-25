import { describe, expect, it } from 'vitest'
import { SPRITES, PALETTE } from './sprites'

describe('sprites', () => {
  for (const [name, grid] of Object.entries(SPRITES)) {
    it(`${name} é quadrado (12x12 ou 16x16) e só usa cores da paleta`, () => {
      expect([12, 16]).toContain(grid.length)
      for (const row of grid) {
        expect(row).toHaveLength(grid.length)
        for (const ch of row) if (ch !== '.') expect(PALETTE[ch], `${name}: '${ch}'`).toBeDefined()
      }
    })
  }
})
