import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowClockwise, CameraRotate, X } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { api } from '../lib/config'
import { compressImage } from '../lib/image'
import { dayOfMonth } from '../lib/dates'
import { sfx, vibrate } from '../lib/fx'
import { XP } from '../lib/rules/game'
import { JarMascot } from '../components/pixel/JarMascot'
import type { SessionSet } from '../data/types'

export interface GuidedResult {
  plan_id: string
  started_at: string
  minutes: number
  completed_all: boolean
  sets: SessionSet[]
}

/** Registar um treino: a foto é obrigatória, tirada na hora com a câmara. */
export function Registar() {
  const { me, snap, today, run, celebrate, toast } = useApp()
  const nav = useNavigate()
  const loc = useLocation()
  const [params] = useSearchParams()
  const guided = (loc.state as { guided?: GuidedResult } | null)?.guided ?? null
  const recoverId = params.get('recuperar')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [camErr, setCamErr] = useState<string | null>(null)
  const [shot, setShot] = useState<{ blob: Blob; url: string; at: string } | null>(null)
  const [minutes, setMinutes] = useState(guided?.minutes ?? 45)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const already = snap.sessions.some((s) => s.profile_id === me.id && s.date === today)

  useEffect(() => {
    if (shot) return
    let cancelled = false
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('sem câmara')
        const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1440 }, height: { ideal: 1800 } }, audio: false })
        if (cancelled) { st.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = st
        if (videoRef.current) {
          videoRef.current.srcObject = st
          await videoRef.current.play().catch(() => {})
        }
        setCamErr(null)
      } catch {
        setCamErr('Não consegui abrir a câmara aqui. Usa o botão para tirar a foto com a câmara do telemóvel.')
      }
    })()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [facing, shot])

  const take = async () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    sfx.beep()
    vibrate(30)
    // corte 4:5 ao centro, como no feed
    const targetRatio = 4 / 5
    let sw = v.videoWidth
    let sh = v.videoHeight
    let sx = 0
    let sy = 0
    if (sw / sh > targetRatio) { const w = sh * targetRatio; sx = (sw - w) / 2; sw = w } else { const h = sw / targetRatio; sy = (sh - h) / 2; sh = h }
    const c = document.createElement('canvas')
    c.width = Math.min(1080, Math.round(sw))
    c.height = Math.round(c.width / targetRatio)
    const g = c.getContext('2d')!
    if (facing === 'user') { g.translate(c.width, 0); g.scale(-1, 1) }
    g.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height)
    const blob = await compressImage(c)
    setShot({ blob, url: URL.createObjectURL(blob), at: new Date().toISOString() })
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    // Só aceitamos fotos acabadas de tirar (menos de 10 minutos).
    if (Date.now() - f.lastModified > 10 * 60_000) {
      toast('A foto tem de ser tirada agora, com a câmara.', 'error')
      return
    }
    const blob = await compressImage(f)
    setShot({ blob, url: URL.createObjectURL(blob), at: new Date().toISOString() })
  }

  const publish = async () => {
    if (!shot) return
    setBusy(true)
    const now = new Date().toISOString()
    let planned = snap.plannedDays.find((d) => d.profile_id === me.id && d.date === today) ?? null
    let recovered: number | null = null
    const result = await run(async () => {
      if (!planned && recoverId) {
        const rd = snap.plannedDays.find((d) => d.id === recoverId)
        if (rd) {
          await api.updatePlannedDay(rd.id, { date: today, moved_from: rd.date })
          recovered = dayOfMonth(rd.date)
          planned = { ...rd, date: today }
        }
      }
      return api.createSession({
        profile_id: me.id,
        date: today,
        started_at: guided?.started_at ?? new Date(Date.now() - minutes * 60_000).toISOString(),
        ended_at: now,
        plan_id: guided?.plan_id ?? planned?.plan_id ?? null,
        kind: guided ? 'guided' : 'quick',
        completed_all: guided?.completed_all ?? false,
        minutes,
        planned_day_id: planned?.id ?? null,
        sets: guided?.sets ?? [],
        notes: '',
        photo: shot.blob,
        photo_taken_at: shot.at,
      })
    })
    setBusy(false)
    if (!result) return
    const others = snap.sessions.some((s) => s.date === today && s.profile_id !== me.id)
    const xp = (planned ? XP.plannedDay : XP.extra) + (guided?.completed_all ? XP.guidedComplete : 0) + (others ? XP.together : 0)
    celebrate({
      kind: 'workout',
      title: recovered ? `Dia ${recovered} recuperado!` : planned ? 'Treino feito!' : 'Treino extra!',
      subtitle: others ? 'Treino a dois: mais alguém da família treinou hoje.' : 'A tua foto já está no feed da família.',
      xp,
    })
    nav('/', { replace: true })
  }

  if (already && !shot) {
    return (
      <main className="page no-nav" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
        <div className="empty">
          <JarMascot mood="party" size={96} />
          <h2>Hoje já está registado</h2>
          <p className="muted">Só conta um treino por dia. Volta amanhã!</p>
          <button className="btn primary big" onClick={() => nav('/')}>Voltar ao início</button>
        </div>
      </main>
    )
  }

  if (shot) {
    return (
      <main className="page no-nav">
        <header className="topbar">
          <button className="icon-btn" aria-label="Tirar outra" onClick={() => { URL.revokeObjectURL(shot.url); setShot(null) }}><ArrowClockwise size={22} weight="bold" /></button>
          <h1 style={{ fontSize: 22 }}>Está a ficar bem</h1>
        </header>
        <img src={shot.url} alt="A tua foto do treino" className="post-photo" />
        {!guided && (
          <div className="field">
            <span id="dur-label">Quanto tempo treinaste?</span>
            <div className="seg" role="group" aria-labelledby="dur-label">
              {[15, 30, 45, 60, 90].map((m) => (
                <button key={m} aria-pressed={minutes === m} onClick={() => setMinutes(m)}>{m} min</button>
              ))}
            </div>
          </div>
        )}
        <p className="small muted">A foto vai para o feed da família. Se quiseres, podes apagá-la depois e o treino continua a contar.</p>
        <button className="btn primary huge block" onClick={publish} disabled={busy}>{busy ? 'A guardar…' : 'Concluir treino'}</button>
      </main>
    )
  }

  return (
    <div className="camera">
      <div className="row between" style={{ position: 'absolute', top: 'calc(12px + var(--safe-t))', left: 16, right: 16, zIndex: 2 }}>
        <button className="icon-btn" style={{ background: 'rgba(0,0,0,.45)', color: '#fff', border: 0 }} aria-label="Cancelar" onClick={() => nav(-1)}><X size={22} weight="bold" /></button>
        <span className="chip" style={{ background: 'rgba(0,0,0,.45)', color: '#fff', border: 0 }}>Foto do treino</span>
        <span style={{ width: 44 }} />
      </div>
      {camErr ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24, color: '#fff', textAlign: 'center' }}>
          <div className="stack" style={{ alignItems: 'center' }}>
            <JarMascot mood="wow" size={90} />
            <p>{camErr}</p>
            <button className="btn primary big" onClick={() => fileRef.current?.click()}>Abrir a câmara</button>
            <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        </div>
      ) : (
        <video ref={videoRef} playsInline muted autoPlay style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined, aspectRatio: '4 / 5' }} />
      )}
      <div className="camera-bar">
        <p className="small" style={{ width: 90, opacity: 0.8 }}>Mostra o material que usaste, ou tu!</p>
        <button className="shutter" aria-label="Tirar foto" onClick={take} disabled={!!camErr} />
        <button className="icon-btn" style={{ background: 'rgba(255,255,255,.12)', color: '#fff', border: 0, width: 56, height: 56 }} aria-label="Trocar de câmara" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}><CameraRotate size={26} /></button>
      </div>
    </div>
  )
}
