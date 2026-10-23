import { memo } from 'react'
import { PALETTE, SPRITES } from './sprites'

/** Converte uma grelha de caracteres em retângulos SVG. Linhas iguais seguidas juntam-se num só retângulo. */
export function gridToRects(grid: string[], palette: Record<string, string> = PALETTE) {
  const rects: { x: number; y: number; w: number; c: string }[] = []
  grid.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      if (ch === '.' || ch === ' ') { x++; continue }
      let w = 1
      while (row[x + w] === ch) w++
      rects.push({ x, y, w, c: palette[ch] ?? ch })
      x += w
    }
  })
  return rects
}

interface PixelProps {
  name: string
  size?: number
  className?: string
  title?: string
  palette?: Record<string, string>
}

export const PixelIcon = memo(function PixelIcon({ name, size = 24, className, title, palette }: PixelProps) {
  const grid = SPRITES[name] ?? SPRITES.star
  const w = grid[0].length
  const h = grid.length
  return (
    <svg
      width={size}
      height={(size * h) / w}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {gridToRects(grid, palette ? { ...PALETTE, ...palette } : PALETTE).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />
      ))}
    </svg>
  )
})

export function PixelGrid({ grid, size, palette, className }: { grid: string[]; size: number; palette?: Record<string, string>; className?: string }) {
  const w = grid[0].length
  const h = grid.length
  return (
    <svg width={size} height={(size * h) / w} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" className={className} aria-hidden>
      {gridToRects(grid, { ...PALETTE, ...palette }).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />
      ))}
    </svg>
  )
}
