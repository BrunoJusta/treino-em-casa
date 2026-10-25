import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PixelIcon } from '../components/pixel/Pixel'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Camera, CaretDown, CheckCircle, Crosshair, DeviceMobile, ImageSquare, Pause, Play, Stop, X } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { api } from '../lib/config'
import { todayLisbon } from '../lib/dates'
import { names } from '../lib/format'
import { Avatar } from '../components/Avatar'
import { ConfirmSheet } from '../components/ui'
import { RouteSvg } from '../components/walk/RouteSvg'
import { PocketMode } from '../components/walk/PocketMode'
import { CameraCapture, type Shot } from '../components/CameraCapture'
import { Switch } from '../components/ui'
import { compressImage } from '../lib/image'
import { createScreenAwake, type AwakeStatus } from '../lib/screenAwake'
import {
  acceptPoint, clearLive, elapsedMs, fmtClock, fmtDuration, fmtKm, getKeepAwake, liveDistance, setKeepAwake, loadLive, saveLive, simplify,
  takePendingCompanions, MAX_ACCURACY_M, type LatLng, type LiveWalk, type LivePoint,
} from '../lib/walk'

type Gps = 'waiting' | 'ok' | 'weak' | 'denied' | 'unavailable'

const GREEN = '#1f9d6b'

/** Caminhada ao vivo: tempo, km e o percurso a desenhar-se no mapa. */
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
  const [keepAwake, setKeepAwakeState] = useState(() => getKeepAwake())
  const [awake, setAwake] = useState<AwakeStatus>('off')
  const awakeRef = useRef(createScreenAwake())
  const [pocket, setPocket] = useState(false)
  const [camera, setCamera] = useState(false)
  const [shot, setShot] = useState<Shot | null>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
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

  // manter o ecrã ligado: o estado vem do screenAwake; solta tudo ao sair do ecrã
  useEffect(() => {
    const a = awakeRef.current
    const off = a.onChange(setAwake)
    return () => { off(); a.destroy() }
  }, [])
  const wake = () => { if (getKeepAwake()) void awakeRef.current.enable() }
  const sleep = () => awakeRef.current.disable()
  const toggleAwake = (v: boolean) => {
    setKeepAwake(v)
    setKeepAwakeState(v)
    if (v && walk && !walk.pausedAt && !summary) void awakeRef.current.enable()
    else if (!v) sleep()
  }

  const start = () => {
    const first = here && here.acc <= MAX_ACCURACY_M ? [here] : []
    const w: LiveWalk = { startedAt: Date.now(), companions, points: first, pausedMs: 0, pausedAt: null, gaps: 0 }
    saveLive(w)
    setWalk(w)
    line.current?.setLatLngs(first.map((p) => [p.lat, p.lng]))
    setFollow(true)
    wake()
  }
  const pause = () => { if (!walk) return; const w = { ...walk, pausedAt: Date.now() }; saveLive(w); setWalk(w); sleep() }
  const resume = () => {
    if (!walk?.pausedAt) return
    const w = { ...walk, pausedMs: walk.pausedMs + (Date.now() - walk.pausedAt), pausedAt: null }
    saveLive(w)
    setWalk(w)
    wake()
  }
  const enterPocket = () => {
    if (getKeepAwake() && awake !== 'native' && awake !== 'fallback') void awakeRef.current.enable()
    try { void document.documentElement.requestFullscreen?.().catch(() => {}) } catch { /* nada */ }
    setPocket(true)
  }
  const exitPocket = () => {
    setPocket(false)
    try { if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {}) } catch { /* nada */ }
  }
  const onGallery = async (f: File | undefined) => {
    if (!f) return
    const blob = await compressImage(f)
    setShot({ blob, url: URL.createObjectURL(blob), at: new Date().toISOString() })
  }
  const finish = () => { if (walk && !walk.pausedAt) pause(); sleep(); setSummary(true) }

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
      photo: shot ? { blob: shot.blob, at: shot.at } : null,
    }), 'Caminhada guardada')
    clearLive()
    nav('/familia')
  }

  const gpsLabel = { waiting: 'À procura do GPS', ok: 'GPS ligado', weak: 'GPS fraco', denied: 'Sem acesso à localização', unavailable: 'GPS indisponível' }[gps]

  return (
    <main className="walk-live">
      <div className="walk-map" {...(camera || pocket ? { inert: '', 'aria-hidden': true } : {})}>
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

      <section className="walk-panel" aria-label="Caminhada" {...(camera || pocket ? { inert: '', 'aria-hidden': true } : {})}>
        {people.length > 0 && (
          <div className="row-sm">
            <div className="avatar-stack">{people.map((p) => <Avatar key={p.id} avatar={p.avatar} color={p.color} name={p.display_name} size={28} />)}</div>
            <span className="small">Com {names(people.map((p) => p.display_name))}</span>
          </div>
        )}
        <div className="walk-stats" aria-live="off">
          <div className="main"><b>{fmtClock(elapsed)}</b><span>tempo</span></div>
          <div><b>{(meters / 1000).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b><span>km</span></div>
        </div>

        {!summary && <AwakeRow keep={keepAwake} status={awake} live={!!walk && !walk.pausedAt} onToggle={toggleAwake} onRetry={() => void awakeRef.current.enable()} />}

        {!walk && (
          <>
            <button className="btn walk huge block" onClick={start}><Play size={26} weight="fill" /> Começar</button>
            <p className="tiny muted center">O tempo conta sempre. O percurso só se desenha com o ecrã ligado.</p>
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
            {!walk.pausedAt && <button className="btn secondary block" onClick={enterPocket}><DeviceMobile size={20} weight="bold" /> Modo bolso</button>}
          </>
        )}
        {walk && summary && (
          <div className="stack">
            <h2 className="row-sm"><CheckCircle size={26} weight="fill" color="var(--walk-text)" /> Boa caminhada!</h2>
            <p className="small" style={{ color: 'var(--ink-2)' }}>{elapsed < 60000 ? `${Math.round(elapsed / 1000)} s` : fmtDuration(Math.round(elapsed / 1000))}{meters > 0 ? `, ${fmtKm(meters)}` : ''}. Não dá XP, mas fica no feed e conta para as conquistas das caminhadas.</p>
            {shot ? (
              <div className="stack-sm">
                <img src={shot.url} alt="A foto da caminhada" className="post-photo" />
                <div className="grid-2">
                  <button className="btn secondary block" onClick={() => setCamera(true)}><Camera size={20} weight="bold" /> Trocar</button>
                  <button className="btn secondary block" onClick={() => { URL.revokeObjectURL(shot.url); setShot(null) }}><X size={20} weight="bold" /> Tirar</button>
                </div>
              </div>
            ) : (
              <div className="stack-sm">
                <button className="btn walk-soft big block" onClick={() => setCamera(true)}><Camera size={22} weight="bold" /> Tirar foto</button>
                <button className="btn ghost sm" onClick={() => galleryRef.current?.click()}><ImageSquare size={18} weight="bold" /> Escolher da galeria</button>
                <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => { void onGallery(e.target.files?.[0]); e.target.value = '' }} />
              </div>
            )}
            {route.length > 1 && <RouteSvg route={route} height={shot ? 100 : 120} />}
            <label className="field"><span>Nota (opcional)</span><input className="input" maxLength={300} placeholder="Volta pela praia" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            <button className="btn walk big block" onClick={save}><PixelIcon name="walk" size={26} /> Guardar caminhada</button>
            <div className="grid-2">
              <button className="btn secondary block" onClick={() => { setSummary(false); resume() }}>Continuar a andar</button>
              <button className="btn danger block" onClick={() => setDiscard(true)}>Descartar</button>
            </div>
          </div>
        )}
      </section>

      <PocketMode open={pocket} elapsed={elapsed} meters={meters} onExit={exitPocket} />
      {camera && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2100 }}>
          <CameraCapture title="Foto da caminhada" hint="Mostra o caminho, ou quem foi contigo!" defaultFacing="environment"
            onShot={(x) => { if (shot) URL.revokeObjectURL(shot.url); setShot(x); setCamera(false) }} onCancel={() => setCamera(false)} />
        </div>
      )}

      <ConfirmSheet open={discard} onClose={() => setDiscard(false)} title="Descartar a caminhada?" danger
        text="O tempo e o percurso desta caminhada perdem-se e nada fica registado."
        confirm="Sim, descartar" onConfirm={() => { clearLive(); setDiscard(false); nav('/') }} />
    </main>
  )
}

function AwakeRow({ keep, status, live, onToggle, onRetry }: { keep: boolean; status: AwakeStatus; live: boolean; onToggle: (v: boolean) => void; onRetry: () => void }) {
  const ok = status === 'native' || status === 'fallback'
  const tone = !keep ? 'off' : status === 'failed' ? 'warn' : 'ok'
  const text = !keep
    ? 'O ecrã pode bloquear e o percurso para.'
    : status === 'failed'
      ? 'O telemóvel não deixou. Põe o bloqueio automático em Nunca: Definições > Ecrã e brilho > Bloqueio automático.'
      : ok ? 'Ecrã sempre ligado.' : live ? 'Toca em "Manter ligado" para o ecrã não bloquear.' : 'O ecrã fica ligado quando começares.'
  return (
    <div className={`walk-awake ${tone}`}>
      <span className="grow"><span className="strong" style={{ display: 'block', color: 'var(--ink)' }}>Manter o ecrã ligado</span><span className="txt">{text}</span></span>
      {keep && live && !ok && <button className="btn walk-soft sm" onClick={onRetry}>Manter ligado</button>}
      <Switch checked={keep} onChange={onToggle} label="Manter o ecrã ligado" />
    </div>
  )
}
