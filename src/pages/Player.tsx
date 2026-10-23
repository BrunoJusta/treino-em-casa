import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Camera, CaretDown, CaretUp, Minus, Pause, Play, Plus, SkipForward, SpeakerHigh, SpeakerSlash, X, Check } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { api } from '../lib/config'
import { ExerciseIcon, Sheet } from '../components/ui'
import { JarMascot } from '../components/pixel/JarMascot'
import { keepAwake, say, sfx, vibrate } from '../lib/fx'
import { dur, durSpoken } from '../lib/format'
import type { Exercise, PlanItem, SessionSet } from '../data/types'
import type { GuidedResult } from './Registar'

type Step =
  | { kind: 'work'; item: PlanItem; ex: Exercise; set: number; of: number; idx: number }
  | { kind: 'rest'; seconds: number; next: Exercise | null }

export function Player() {
  const { planId } = useParams()
  const { snap, me, exerciseById, run } = useApp()
  const nav = useNavigate()
  const plan = snap.plans.find((p) => p.id === planId)
  const [voice, setVoice] = useState(me.voice_enabled)
  const [phase, setPhase] = useState<'intro' | 'go' | 'end'>('intro')
  const [i, setI] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [paused, setPaused] = useState(false)
  const [loads, setLoads] = useState<Record<string, number>>({})
  const [results, setResults] = useState<SessionSet[]>([])
  const [showHow, setShowHow] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const startedAt = useRef(new Date().toISOString())
  const endAt = useRef<number>(0)
  const spoken = useRef<Set<number>>(new Set())

  const steps: Step[] = useMemo(() => {
    if (!plan) return []
    const out: Step[] = []
    const items = plan.items.filter((it) => exerciseById.has(it.exercise_id))
    items.forEach((item, ii) => {
      const ex = exerciseById.get(item.exercise_id)!
      for (let s = 1; s <= item.sets; s++) {
        out.push({ kind: 'work', item, ex, set: s, of: item.sets, idx: ii })
        const last = ii === items.length - 1 && s === item.sets
        if (!last && item.rest_s > 0) out.push({ kind: 'rest', seconds: item.rest_s, next: s < item.sets ? ex : exerciseById.get(items[ii + 1].exercise_id) ?? null })
      }
    })
    return out
  }, [plan, exerciseById])

  // carga sugerida: a última usada por esta pessoa, ou a do plano
  useEffect(() => {
    if (!plan) return
    const l: Record<string, number> = {}
    for (const it of plan.items) {
      const last = [...snap.sessions].reverse().find((s) => s.profile_id === me.id && s.sets.some((x) => x.exercise_id === it.exercise_id && x.load_kg))
      const lastLoad = last?.sets.filter((x) => x.exercise_id === it.exercise_id && x.load_kg).at(-1)?.load_kg
      if (lastLoad || it.target_load_kg) l[it.exercise_id] = lastLoad ?? it.target_load_kg ?? 0
    }
    setLoads(l)
  }, [plan, snap.sessions, me.id])

  useEffect(() => {
    let release = () => {}
    keepAwake().then((r) => (release = r))
    return () => { release(); try { speechSynthesis.cancel() } catch { /* nada */ } }
  }, [])

  const speak = useCallback((t: string) => { if (voice) say(t) }, [voice])
  const step = steps[i]

  const startTimer = useCallback((secs: number) => {
    endAt.current = Date.now() + secs * 1000
    spoken.current = new Set()
    setRemaining(secs)
    setPaused(false)
  }, [])

  const advance = useCallback(() => {
    if (i + 1 >= steps.length) {
      setPhase('end')
      sfx.done()
      speak('Treino terminado. Muito bem!')
      return
    }
    setI(i + 1)
  }, [i, steps.length, speak])

  // ao entrar num passo
  useEffect(() => {
    if (phase !== 'go' || !step) return
    if (step.kind === 'rest') {
      startTimer(step.seconds)
      speak(`Descanso, ${durSpoken(step.seconds)}`)
    } else {
      setShowHow(false)
      if (step.item.duration_s) startTimer(step.item.duration_s)
      else setRemaining(0)
      const what = step.item.duration_s ? durSpoken(step.item.duration_s) : `${step.item.reps} repetições`
      speak(step.set === 1 ? `${step.ex.name_pt}. ${what}` : `Série ${step.set}. ${what}`)
    }
  }, [i, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // relógio
  useEffect(() => {
    if (phase !== 'go' && phase !== 'intro') return
    const timed = phase === 'intro' || step?.kind === 'rest' || (step?.kind === 'work' && !!step.item.duration_s)
    if (!timed || paused) return
    const iv = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 3 && left > 0 && !spoken.current.has(left)) {
        spoken.current.add(left)
        sfx.beep()
        vibrate(40)
        if (phase === 'intro') speak(['', 'um', 'dois', 'três'][left])
      }
      if (left === 0) {
        clearInterval(iv)
        if (phase === 'intro') {
          sfx.go()
          speak('Vai!')
          setPhase('go')
        } else if (step?.kind === 'rest') {
          sfx.go()
          vibrate([60, 40, 60])
          advance()
        } else if (step?.kind === 'work') {
          completeSet(true)
        }
      }
    }, 200)
    return () => clearInterval(iv)
  }, [phase, i, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase === 'intro') startTimer(3)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const completeSet = (done: boolean) => {
    if (!step || step.kind !== 'work') return
    if (done) { sfx.coin(); vibrate(30) }
    setResults((r) => [...r, { exercise_id: step.ex.id, set_no: step.set, reps: step.item.reps, load_kg: loads[step.ex.id] ?? null, duration_s: step.item.duration_s, done }])
    advance()
  }

  const togglePause = () => {
    if (paused) { endAt.current = Date.now() + remaining * 1000; setPaused(false) } else setPaused(true)
  }

  const finish = () => {
    const minutes = Math.max(1, Math.round((Date.now() - new Date(startedAt.current).getTime()) / 60000))
    const workSteps = steps.filter((s) => s.kind === 'work').length
    const doneSets = results.filter((r) => r.done).length
    const guided: GuidedResult = { plan_id: plan!.id, started_at: startedAt.current, minutes, completed_all: doneSets >= workSteps, sets: results }
    nav('/treinar', { state: { guided } })
  }

  const toggleVoice = () => {
    const v = !voice
    setVoice(v)
    void run(() => api.updateProfile(me.id, { voice_enabled: v }))
  }

  if (!plan || !steps.length) {
    return <main className="page no-nav"><p>Este treino não tem exercícios.</p><button className="btn primary" onClick={() => nav('/treinos')}>Ver treinos</button></main>
  }

  const workIdx = steps.slice(0, i + 1).filter((s) => s.kind === 'work').length
  const totalWork = steps.filter((s) => s.kind === 'work').length

  return (
    <div className={`player ${step?.kind === 'rest' && phase === 'go' ? 'rest' : ''}`}>
      <header className="row">
        <button className="icon-btn" aria-label="Sair do treino" onClick={() => setConfirmExit(true)}><X size={22} weight="bold" /></button>
        <div className="grow">
          <p className="strong">{plan.name}</p>
          <div className="bar pixel" style={{ height: 10, marginTop: 4 }} role="progressbar" aria-valuemin={0} aria-valuemax={totalWork} aria-valuenow={workIdx} aria-label="Progresso do treino"><i style={{ width: `${(workIdx / totalWork) * 100}%` }} /></div>
        </div>
        <button className="icon-btn" aria-label={voice ? 'Desligar voz' : 'Ligar voz'} aria-pressed={voice} onClick={toggleVoice}>{voice ? <SpeakerHigh size={22} weight="bold" /> : <SpeakerSlash size={22} weight="bold" />}</button>
      </header>

      <p className="sr-only" aria-live="polite">
        {phase === 'go' && step?.kind === 'work' ? `${step.ex.name_pt}, série ${step.set} de ${step.of}` : phase === 'go' && step?.kind === 'rest' ? 'Descanso' : phase === 'end' ? 'Treino terminado' : ''}
      </p>
      <AnimatePresence mode="wait">
        {phase === 'intro' && (
          <motion.section key="intro" className="grow stack" style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="strong muted">Prepara-te</p>
            <motion.div key={remaining} className="countdown" initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>{remaining || 'Vai!'}</motion.div>
            <p className="muted">{steps[0].kind === 'work' ? steps[0].ex.name_pt : ''}</p>
          </motion.section>
        )}

        {phase === 'go' && step?.kind === 'work' && (
          <motion.section key={`w${i}`} className="stack" style={{ flex: 1, gap: 18 }} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <div className="row">
              <ExerciseIcon ex={step.ex} size={64} />
              <div className="grow">
                <p className="small muted">Exercício {step.idx + 1} de {plan.items.length}</p>
                <h1 style={{ fontSize: 26 }}>{step.ex.name_pt}</h1>
              </div>
            </div>
            <div className="set-pills" aria-label={`Série ${step.set} de ${step.of}`}>
              {Array.from({ length: step.of }, (_, k) => <span key={k} className={`set-pill ${k + 1 < step.set ? 'done' : k + 1 === step.set ? 'cur' : ''}`} />)}
            </div>
            <p className="center strong muted">Série {step.set} de {step.of}{step.item.duration_s ? `, ${dur(step.item.duration_s)}` : ''}</p>
            {step.item.duration_s ? (
              <TimerRing total={step.item.duration_s} left={remaining} />
            ) : (
              <div className="center">
                <div className="countdown">{step.item.reps}</div>
                <p className="strong muted">repetições</p>
              </div>
            )}
            {step.ex.equipment_ids.length > 0 && !step.item.duration_s && (
              <div className="row" style={{ justifyContent: 'center', gap: 16 }}>
                <button className="icon-btn" style={{ width: 56, height: 56 }} aria-label="Menos 1 kg" onClick={() => setLoads((l) => ({ ...l, [step.ex.id]: Math.max(0, (l[step.ex.id] ?? 0) - 1) }))}><Minus size={24} weight="bold" /></button>
                <div className="center" style={{ minWidth: 90 }}><b className="num" style={{ fontSize: 30 }}>{loads[step.ex.id] ?? 0}</b> <span className="muted">kg</span></div>
                <button className="icon-btn" style={{ width: 56, height: 56 }} aria-label="Mais 1 kg" onClick={() => setLoads((l) => ({ ...l, [step.ex.id]: (l[step.ex.id] ?? 0) + 1 }))}><Plus size={24} weight="bold" /></button>
              </div>
            )}
            <button className="btn ghost sm" style={{ alignSelf: 'center' }} onClick={() => setShowHow((s) => !s)} aria-expanded={showHow}>
              Como se faz {showHow ? <CaretUp size={16} /> : <CaretDown size={16} />}
            </button>
            {showHow && (
              <ol className="small" style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {step.ex.instructions_pt.map((t, k) => <li key={k}>{t}</li>)}
              </ol>
            )}
            {step.item.notes && <p className="card soft small">{step.item.notes}</p>}
            <div style={{ flex: 1 }} />
            <div className="row">
              <button className="btn secondary big" onClick={() => completeSet(false)} aria-label="Saltar esta série"><SkipForward size={22} weight="bold" /> Saltar</button>
              {step.item.duration_s ? (
                <button className="btn ink big grow" onClick={togglePause}>{paused ? <><Play size={22} weight="fill" /> Continuar</> : <><Pause size={22} weight="fill" /> Pausa</>}</button>
              ) : (
                <button className="btn primary huge grow" onClick={() => completeSet(true)}><Check size={26} weight="bold" /> Feito</button>
              )}
            </div>
          </motion.section>
        )}

        {phase === 'go' && step?.kind === 'rest' && (
          <motion.section key={`r${i}`} className="stack" style={{ flex: 1, alignItems: 'center', gap: 18 }} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <p className="strong" style={{ color: 'var(--accent-text)' }}>Descanso</p>
            <TimerRing total={step.seconds} left={remaining} />
            {step.next && (
              <div className="card row" style={{ width: '100%' }}>
                <ExerciseIcon ex={step.next} size={44} />
                <div className="grow"><p className="tiny muted">A seguir</p><p className="strong">{step.next.name_pt}</p></div>
              </div>
            )}
            <div style={{ flex: 1 }} />
            <div className="row" style={{ width: '100%' }}>
              <button className="btn secondary big" onClick={() => { endAt.current += 15000; setRemaining((r) => r + 15) }}>+15 s</button>
              <button className="btn ink big grow" onClick={togglePause}>{paused ? 'Continuar' : 'Pausa'}</button>
              <button className="btn primary big" onClick={advance} aria-label="Saltar descanso"><SkipForward size={22} weight="bold" /></button>
            </div>
          </motion.section>
        )}

        {phase === 'end' && (
          <motion.section key="end" className="stack" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <JarMascot mood="party" level={0.6} size={130} />
            <h1>Treino terminado!</h1>
            <p className="muted">{results.filter((r) => r.done).length} de {totalWork} séries feitas em {Math.max(1, Math.round((Date.now() - new Date(startedAt.current).getTime()) / 60000))} min.</p>
            <p className="small">Falta só a foto para o treino contar.</p>
            <button className="btn primary huge block" onClick={finish}><Camera size={26} weight="bold" /> Tirar a foto e concluir</button>
          </motion.section>
        )}
      </AnimatePresence>

      <Sheet open={confirmExit} onClose={() => setConfirmExit(false)} title="Sair do treino?">
        <p className="muted">O treino só conta quando tirares a foto no fim. Se saíres agora, perdes o progresso desta sessão.</p>
        <div className="stack-sm">
          <button className="btn primary big block" onClick={() => setConfirmExit(false)}>Continuar a treinar</button>
          {results.length > 0 && <button className="btn secondary block" onClick={finish}>Terminar já e tirar a foto</button>}
          <button className="btn danger block" onClick={() => nav('/')}>Sair sem guardar</button>
        </div>
      </Sheet>
    </div>
  )
}

function TimerRing({ total, left }: { total: number; left: number }) {
  const size = 240
  const r = 104
  const c = 2 * Math.PI * r
  const pct = total ? left / total : 0
  const mm = Math.floor(left / 60)
  const ss = left % 60
  return (
    <div className="ring" style={{ width: size, height: size, alignSelf: 'center' }} role="timer" aria-live="off" aria-label={durSpoken(left)}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={16} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={16} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .25s linear' }} />
      </svg>
      <div><span className="countdown" style={{ fontSize: left >= 60 ? 64 : 88 }}>{left >= 60 ? `${mm}:${String(ss).padStart(2, '0')}` : left}</span></div>
    </div>
  )
}
