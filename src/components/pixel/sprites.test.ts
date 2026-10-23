import { describe, expect, it } from 'vitest'
import { SPRITES, PALETTE } from './sprites'

describe('sprites', () => {
  for (const [name, grid] of Object.entries(SPRITES)) {
    it(`${name} é 12x12 e só usa cores da paleta`, () => {
      expect(grid).toHaveLength(12)
      for (const row of grid) {
        expect(row).toHaveLength(12)
        for (const ch of row) if (ch !== '.') expect(PALETTE[ch], `${name}: '${ch}'`).toBeDefined()
      }
    })
  }
})
