// Contas e estado da caminhada ao vivo.
// O tempo conta-se a partir das horas de início e das pausas, por isso continua certo
// com o ecrã bloqueado ou a app fechada. O GPS só regista enquanto a app está aberta.

export type LatLng = [number, number]

export interface LivePoint {
  lat: number
  lng: number
  t: number // ms
  acc: number // metros
}

export interface LiveWalk {
  startedAt: number
  companions: string[]
  points: LivePoint[]
  pausedMs: number
  pausedAt: number | null
  gaps: number // vezes em que o GPS esteve parado (ecrã bloqueado ou app fechada)
}

const KEY = 'tec-walk-live'
const R = 6371000

export function haversine(a: LatLng, b: LatLng): number {
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function pathLength(pts: LatLng[]): number {
  let d = 0
  for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1], pts[i])
  return d
}

export const MAX_ACCURACY_M = 35 // pontos menos precisos do que isto são ignorados
const MIN_STEP_M = 4 // abaixo disto é ruído do GPS parado
const MAX_SPEED_MS = 7 // acima disto (25 km/h) é um salto do GPS, não uma caminhada

/** Decide se um ponto novo entra no percurso. */
export function acceptPoint(prev: LivePoint | undefined, p: LivePoint): boolean {
  if (p.acc > MAX_ACCURACY_M) return false
  if (!prev) return true
  const d = haversine([prev.lat, prev.lng], [p.lat, p.lng])
  if (d < MIN_STEP_M) return false
  const dt = (p.t - prev.t) / 1000
  // depois de uma falha longa (ecrã bloqueado), aceita-se a ligação em linha reta
  if (dt < 60 && d / Math.max(dt, 1) > MAX_SPEED_MS) return false
  return true
}

export function elapsedMs(w: LiveWalk, now = Date.now()): number {
  const paused = w.pausedMs + (w.pausedAt ? now - w.pausedAt : 0)
  return Math.max(0, now - w.startedAt - paused)
}

export function liveDistance(w: LiveWalk): number {
  return pathLength(w.points.map((p) => [p.lat, p.lng]))
}

/** Simplifica o percurso (Douglas-Peucker) para guardar menos pontos. */
export function simplify(pts: LatLng[], tolM = 6): LatLng[] {
  if (pts.length < 3) return pts
  const sq = (x: number) => x * x
  const lat0 = (pts[0][0] * Math.PI) / 180
  const xy = pts.map(([la, ln]) => [((ln * Math.PI) / 180) * R * Math.cos(lat0), ((la * Math.PI) / 180) * R])
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    let max = 0
    let idx = -1
    const [ax, ay] = xy[a]
    const [bx, by] = xy[b]
    const len = sq(bx - ax) + sq(by - ay)
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i]
      let t = len ? ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len : 0
      t = Math.max(0, Math.min(1, t))
      const d = Math.sqrt(sq(px - (ax + t * (bx - ax))) + sq(py - (ay + t * (by - ay))))
      if (d > max) { max = d; idx = i }
    }
    if (idx > 0 && max > tolM) {
      keep[idx] = 1
      stack.push([a, idx], [idx, b])
    }
  }
  return pts.filter((_, i) => keep[i]).map(([a, b]) => [Math.round(a * 1e5) / 1e5, Math.round(b * 1e5) / 1e5])
}

// ---------- formatos ----------
export function fmtKm(m: number | null | undefined): string {
  if (m == null) return ''
  return `${(m / 1000).toLocaleString('pt-PT', { minimumFractionDigits: m < 10000 ? 2 : 1, maximumFractionDigits: m < 10000 ? 2 : 1 })} km`
}

export function fmtClock(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${two(m)}:${two(ss)}` : `${two(m)}:${two(ss)}`
}

export function fmtDuration(sec: number): string {
  const m = Math.round(sec / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

// ---------- caminhada ao vivo, guardada no telemóvel ----------
export function loadLive(): LiveWalk | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const w = JSON.parse(raw) as LiveWalk
    if (typeof w.startedAt !== 'number' || !Array.isArray(w.points)) return null
    // uma caminhada esquecida há mais de 12 horas já não conta
    if (Date.now() - w.startedAt > 12 * 3600 * 1000) { clearLive(); return null }
    return w
  } catch { return null }
}

export function saveLive(w: LiveWalk) {
  try { localStorage.setItem(KEY, JSON.stringify(w)) } catch { /* sem armazenamento: fica só em memória */ }
  window.dispatchEvent(new Event('tec-walk-live'))
}

export function clearLive() {
  try { localStorage.removeItem(KEY) } catch { /* nada */ }
  window.dispatchEvent(new Event('tec-walk-live'))
}

// ---------- quem vai na caminhada, entre o ecrã de escolha e o ecrã ao vivo ----------
const PENDING = 'tec-walk-companions'
export function setPendingCompanions(ids: string[]) {
  try { sessionStorage.setItem(PENDING, JSON.stringify(ids)) } catch { /* nada */ }
}
export function takePendingCompanions(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(PENDING) ?? '[]')
    sessionStorage.removeItem(PENDING)
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch { return [] }
}

// ---------- manter o ecrã ligado (preferência guardada no telemóvel) ----------
const AWAKE = 'tec-walk-keep-awake'
export function getKeepAwake(): boolean {
  try { return localStorage.getItem(AWAKE) !== '0' } catch { return true }
}
export function setKeepAwake(v: boolean) {
  try { localStorage.setItem(AWAKE, v ? '1' : '0') } catch { /* nada */ }
}

// ---------- modo bolso: manter o dedo para sair ----------
export const POCKET_HOLD_MS = 2000
/** Temporizador do "mantém o dedo 2 segundos". Separado do componente para se poder testar. */
export function createHold(onDone: () => void, ms = POCKET_HOLD_MS) {
  let t: ReturnType<typeof setTimeout> | null = null
  return {
    start() { if (t) clearTimeout(t); t = setTimeout(() => { t = null; onDone() }, ms) },
    cancel() { if (t) { clearTimeout(t); t = null } },
    get active() { return t !== null },
  }
}
