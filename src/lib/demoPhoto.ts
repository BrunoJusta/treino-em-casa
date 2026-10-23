import { gridToRects } from '../components/pixel/Pixel'
import { SPRITES, PALETTE } from '../components/pixel/sprites'
import { PERSON_COLORS } from '../data/seed'

// "Fotos" de exemplo para o modo demo: uma cena em pixel art no ginásio, na cor de cada pessoa.
const ITEMS = ['dumbbell', 'bike', 'station', 'barbell']

export function demoPhoto(path: string): string {
  const [, pi, vi] = path.split(':')
  const color = PERSON_COLORS[Number(pi) % PERSON_COLORS.length]
  const item = SPRITES[ITEMS[Number(vi) % ITEMS.length]]
  const body = SPRITES.body
  const rect = (grid: string[], ox: number, oy: number, s: number) =>
    gridToRects(grid, { ...PALETTE, b: color })
      .map((r) => `<rect x="${ox + r.x * s}" y="${oy + r.y * s}" width="${r.w * s}" height="${s}" fill="${r.c}"/>`)
      .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100" shape-rendering="crispEdges">
<rect width="80" height="100" fill="${color}" fill-opacity="0.16"/>
<rect y="72" width="80" height="28" fill="#DCE0E8"/>
<rect y="72" width="80" height="2" fill="#C5C9D3"/>
${rect(body, 8, 28, 4)}
${rect(item, 44, 40, 3)}
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
