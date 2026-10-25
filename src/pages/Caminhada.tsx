import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CaretDown, CheckCircle, Crosshair, Footprints, Pause, Play, Stop } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { api } from '../lib/config'
import { todayLisbon } from '../lib/dates'
import { names } from '../lib/format'
import { Avatar } from '../components/Avatar'
import { ConfirmSheet } from '../components/ui'
import { RouteSvg } from '../components/walk/RouteSvg'
import {
  acceptPoint, clearLive, elapsedMs, fmtClock, fmtDuration, fmtKm, fmtPace, liveDistance, loadLive, saveLive, simplify,
  takePendingCompanions, MAX_ACCURACY_M, type LatLng, type LiveWalk, type LivePoint,
} from '../lib/walk'

type Gps = 'waiting' | 'ok' | 'weak' | 'denied' | 'unavailable'
type WakeLockLike = { release: () => Promise<void> }

const GREEN = '#2f9e55'

/** Caminhada ao vivo: tempo, km, ritmo e o percurso a desenhar-se no mapa. */
export default function Caminhada() {
  const { snap, run, toast } = useApp()
  const nav = useNavigate()
  const [walk, setWalk] = useState<LiveWalk | null>(() => loadLive())
  const [companions] = useState<string[]>(() => loadLive()?.companions ?? takePendingCompanions())
  const [summary, setSummary] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [notes, setNotes] = useState('')
  const [gps, setGps] = useState<Gps>('waiting')
  const [here, setHere] = useState<LivePoint | null>(null)
  const [, setTick] = useState(0)
  const [follow, setFollow] = useState(true)
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const line = useRef<L.Polyline | null>(null)
  const dot = useRef<L.CircleMarker | null>(null)
  const walkRef = useRef(walk)
  walkRef.current = walk
  const followRef = useRef(follow)
  followRef.current = follow

  const people = companions.map((id) => snap.profiles.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p)

  // relógio: recalcula a partir das horas, por isso não se perde com o ecrã bloqueado
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // mapa
  useEffect(() => {
    if (!mapEl.current || map.current) return
    const m = L.map(mapEl.current, { zoomControl: false, attributionControl: true }).setView([41.38, -8.76], 15)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    line.current = L.polyline([], { color: GREEN, weight: 6, opacity: 0.95, lineJoin: 'round', lineCap: 'round' }).addTo(m)
    m.on('dragstart', () => setFollow(false))
    map.current = m
    const pts = walkRef.current?.points ?? []
    if (pts.length) {
      line.current.setLatLngs(pts.map((p) => [p.lat, p.lng]))
      m.setView([pts[pts.length - 1].lat, pts[pts.length - 1].lng], 17)
    }
    return () => { m.remove(); map.current = null }
  }, [])

  // GPS: sempre ligado neste ecrã, para mostrar onde estás antes de começar
  useEffect(() => {
    if (!('geolocation' in navigator)) { setGps('unavailable'); return }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p: LivePoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: pos.timestamp || Date.now(), acc: pos.coords.accuracy }
        setGps(p.acc > MAX_ACCURACY_M ? 'weak' : 'ok')
        setHere(p)
        const m = map.current
        if (m) {
          if (!dot.current) dot.current = L.circleMarker([p.lat, p.lng], { radius: 8, color: '#ffffff', weight: 3, fillColor: GREEN, fillOpacity: 1 }).addTo(m)
          else dot.current.setLatLng([p.lat, p.lng])
          if (followRef.current) m.setView([p.lat, p.lng], Math.max(m.getZoom(), 16), { animate: true })
        }
        const w = walkRef.current
        if (!w || w.pausedAt) return
        const prev = w.points[w.points.length - 1]
        if (!acceptPoint(prev, p)) return
        const gap = prev && p.t - prev.t > 30000 ? 1 : 0
        const next = { ...w, points: [...w.points, p], gaps: w.gaps + gap }
        saveLive(next)
        setWalk(next)
        line.current?.addLatLng([p.lat, p.lng])
      },
      (err) => setGps(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // ecrã sempre ligado enquanto a caminhada está a decorrer (quando o telemóvel deixa)
  const running = !!walk && !walk.pausedAt && !summary
  useEffect(() => {
    if (!running) return
    let lock: WakeLockLike | null = null
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } }).wakeLock
    const ask = () => { if (wl && document.visibilityState === 'visible') wl.request('screen').then((l) => { lock = l }).catch(() => {}) }
    ask()
    document.addEventListener('visibilitychange', ask)
    return () => { document.removeEventListener('visibilitychange', ask); void lock?.release().catch(() => {}) }
  }, [running])

  const start = () => {
    const first = here && here.acc <= MAX_ACCURACY_M ? [here] : []
    const w: LiveWalk = { startedAt: Date.now(), companions, points: first, pausedMs: 0, pausedAt: null, gaps: 0 }
    saveLive(w)
    setWalk(w)
    line.current?.setLatLngs(first.map((p) => [p.lat, p.lng]))
    setFollow(true)
  }
  const pause = () => { if (!walk) return; const w = { ...walk, pausedAt: Date.now() }; saveLive(w); setWalk(w) }
  const resume = () => {
    if (!walk?.pausedAt) return
    const w = { ...walk, pausedMs: walk.pausedMs + (Date.now() - walk.pausedAt), pausedAt: null }
    saveLive(w)
    setWalk(w)
  }
  const finish = () => { if (walk && !walk.pausedAt) pause(); setSummary(true) }

  const elapsed = walk ? elapsedMs(walk) : 0
  const meters = walk ? liveDistance(walk) : 0
  const route: LatLng[] = walk ? simplify(walk.points.map((p) => [p.lat, p.lng])) : []

  const save = async () => {
    if (!walk) return
    const dur = Math.round(elapsedMs(walk) / 1000)
    if (dur < 60) { toast('A caminhada tem de ter pelo menos 1 minuto.', 'error'); return }
    const end = new Date()
    await run(() => api.createWalk({
      companions: walk.companions,
      date: todayLisbon(new Date(walk.startedAt)),
      started_at: new Date(walk.startedAt).toISOString(),
      ended_at: end.toISOString(),
      duration_s: dur,
      distance_m: walk.points.length > 1 ? Math.round(meters) : null,
      route: route.length > 1 ? route : null,
      source: 'live',
      notes: notes.trim().slice(0, 300),
    }), 'Caminhada guardada')
    clearLive()
    nav('/familia')
  }

  const gpsLabel = { waiting: 'À procura do GPS', ok: 'GPS ligado', weak: 'GPS fraco', denied: 'Sem acesso à localização', unavailable: 'GPS indisponível' }[gps]

  return (
    <main className="walk-live">
      <div className="walk-map">
        <div ref={mapEl} style={{ position: 'absolute', inset: 0 }} aria-label="Mapa da caminhada" />
        {(gps === 'denied' || gps === 'unavailable') && (
          <div className="walk-map-msg">
            <div className="card raised" style={{ maxWidth: 320 }}>
              <p className="strong">{gps === 'denied' ? 'A app não tem acesso à localização' : 'Não deu para usar o GPS'}</p>
              <p className="small muted">{gps === 'denied' ? 'Nas definições do telemóvel, deixa o Treino em Casa usar a localização. O tempo conta na mesma, sem mapa nem km.' : 'O tempo conta na mesma, sem mapa nem km.'}</p>
            </div>
          </div>
        )}
        <div className="walk-top">
          <button className="icon-btn" style={{ background: '#fff' }} aria-label="Minimizar (a caminhada continua)" onClick={() => nav('/')}><CaretDown size={22} weight="bold" /></button>
          <span className={`walk-gps ${gps === 'weak' || gps === 'waiting' ? 'weak' : gps === 'ok' ? '' : 'off'}`} role="status"><i />{gpsLabel}</span>
          {!follow ? <button className="icon-btn" style={{ background: '#fff' }} aria-label="Centrar no sítio onde estou" onClick={() => { setFollow(true); if (here) map.current?.setView([here.lat, here.lng], 17) }}><Crosshair size={22} weight="bold" /></button> : <span style={{ width: 44 }} />}
        </div>
      </div>

      <section className="walk-panel" aria-label="Caminhada">
        {people.length > 0 && (
          <div className="row-sm">
            <div className="avatar-stack">{people.map((p) => <Avatar key={p.id} avatar={p.avatar} color={p.color} name={p.display_name} size={28} />)}</div>
            <span className="small">Com {names(people.map((p) => p.display_name))}</span>
          </div>
        )}
        <div className="walk-stats" aria-live="off">
          <div className="main"><b>{fmtClock(elapsed)}</b><span>tempo</span></div>
          <div><b>{(meters / 1000).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b><span>km</span></div>
          <div><b style={{ fontSize: 22, lineHeight: '33px' }}>{fmtPace(elapsed / 1000, meters).replace(' /km', '')}</b><span>min/km</span></div>
        </div>

        {!walk && (
          <>
            <button className="btn walk huge block" onClick={start}><Play size={26} weight="fill" /> Começar</button>
            <p className="tiny muted center">O tempo continua a contar com o ecrã bloqueado. O percurso só se desenha com a app aberta, por isso o ecrã fica ligado durante a caminhada.</p>
          </>
        )}
        {walk && !summary && (
          <>
            {walk.gaps > 0 && <p className="tiny muted center">O GPS parou {walk.gaps === 1 ? 'uma vez' : `${walk.gaps} vezes`} (ecrã bloqueado ou app fechada). Esses troços ficam em linha reta.</p>}
            <div className="grid-2">
              {walk.pausedAt
                ? <button className="btn walk big block" onClick={resume}><Play size={22} weight="fill" /> Continuar</button>
                : <button className="btn secondary big block" onClick={pause}><Pause size={22} weight="fill" /> Pausa</button>}
              <button className="btn ink big block" onClick={finish}><Stop size={22} weight="fill" /> Terminar</button>
            </div>
          </>
        )}
        {walk && summary && (
          <div className="stack">
            <h2 className="row-sm"><CheckCircle size={26} weight="fill" color="var(--walk-text)" /> Boa caminhada!</h2>
            <p className="small" style={{ color: 'var(--ink-2)' }}>{elapsed < 60000 ? `${Math.round(elapsed / 1000)} s` : fmtDuration(Math.round(elapsed / 1000))}{meters > 0 ? `, ${fmtKm(meters)}` : ''}. Não dá XP, mas fica no feed e conta para as conquistas das caminhadas.</p>
            {route.length > 1 && <RouteSvg route={route} height={120} />}
            <label className="field"><span>Nota (opcional)</span><input className="input" maxLength={300} placeholder="Volta pela praia" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            <button className="btn walk big block" onClick={save}><Footprints size={22} weight="bold" /> Guardar caminhada</button>
            <div className="grid-2">
              <button className="btn secondary block" onClick={() => { setSummary(false); resume() }}>Continuar a andar</button>
              <button className="btn danger block" onClick={() => setDiscard(true)}>Descartar</button>
            </div>
          </div>
        )}
      </section>

      <ConfirmSheet open={discard} onClose={() => setDiscard(false)} title="Descartar a caminhada?" danger
        text="O tempo e o percurso desta caminhada perdem-se e nada fica registado."
        confirm="Sim, descartar" onConfirm={() => { clearLive(); setDiscard(false); nav('/') }} />
    </main>
  )
}
