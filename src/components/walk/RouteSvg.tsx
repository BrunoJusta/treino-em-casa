import type { LatLng } from '../../lib/walk'

/**
 * Desenho simples do percurso (sem mapa por baixo), para o feed e o resumo.
 * overlay: versão pequena, branca e sem fundo, para ficar por cima da foto, num canto.
 */
export function RouteSvg({ route, height = 140, label, overlay = false }: { route: LatLng[]; height?: number; label?: string; overlay?: boolean }) {
  if (route.length < 2) return null
  const W = overlay ? 120 : 320
  const H = overlay ? 120 : height
  const pad = overlay ? 12 : 14
  const lat0 = (route[0][0] * Math.PI) / 180
  const pts = route.map(([la, ln]) => [ln * Math.cos(lat0), la])
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const span = Math.max(maxX - minX, maxY - minY, 1e-6)
  const scale = Math.min((W - pad * 2) / Math.max(maxX - minX, span * 0.2), (H - pad * 2) / Math.max(maxY - minY, span * 0.2))
  const offX = (W - (maxX - minX) * scale) / 2
  const offY = (H - (maxY - minY) * scale) / 2
  const xy = pts.map(([x, y]) => [offX + (x - minX) * scale, H - (offY + (y - minY) * scale)])
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [sx, sy] = xy[0]
  const [ex, ey] = xy[xy.length - 1]
  if (overlay) {
    return (
      <svg className="walk-route-overlay" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label ?? 'Percurso da caminhada'}>
        <path d={d} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d={d} fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={sx} cy={sy} r="7" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="7" />
        <circle cx={sx} cy={sy} r="7" fill="none" stroke="#ffffff" strokeWidth="4" />
        <circle cx={ex} cy={ey} r="8" fill="#ffffff" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
      </svg>
    )
  }
  return (
    <svg className="walk-route" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label ?? 'Percurso da caminhada'}>
      <path d={d} fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#1f9d6b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx} cy={sy} r="6" fill="#ffffff" stroke="#1f9d6b" strokeWidth="3" />
      <circle cx={ex} cy={ey} r="6" fill="#1f9d6b" stroke="#ffffff" strokeWidth="2.5" />
    </svg>
  )
}
