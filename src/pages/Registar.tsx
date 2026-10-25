import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowClockwise } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { api } from '../lib/config'
import { dayOfMonth } from '../lib/dates'
import { XP } from '../lib/rules/game'
import { JarMascot } from '../components/pixel/JarMascot'
import { CameraCapture } from '../components/CameraCapture'
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
  const { me, snap, today, run, celebrate } = useApp()
  const nav = useNavigate()
  const loc = useLocation()
  const [params] = useSearchParams()
  const guided = (loc.state as { guided?: GuidedResult } | null)?.guided ?? null
  const recoverId = params.get('recuperar')
  const [shot, setShot] = useState<{ blob: Blob; url: string; at: string } | null>(null)
  const [minutes, setMinutes] = useState(guided?.minutes ?? 45)
  const [busy, setBusy] = useState(false)

  const already = snap.sessions.some((s) => s.profile_id === me.id && s.date === today)

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
    <CameraCapture title="Foto do treino" hint="Mostra o material que usaste, ou tu!" defaultFacing="user"
      fileMaxAgeMs={10 * 60_000} onShot={setShot} onCancel={() => nav(-1)} />
  )
}
