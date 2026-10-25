import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Footprints, PencilSimpleLine, User, Users, MapTrifold } from '@phosphor-icons/react'
import { useApp } from '../../data/store'
import { api } from '../../lib/config'
import { Avatar } from '../Avatar'
import { Sheet } from '../ui'
import { addDays, cmp } from '../../lib/dates'
import { loadLive, setPendingCompanions } from '../../lib/walk'

type Step = 'mode' | 'who' | 'form'

/** Registar uma caminhada: à mão (dia e tempo) ou ao vivo, com mapa. Primeiro pergunta se é sozinho ou acompanhado. */
export function WalkSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, snap, today, run, toast } = useApp()
  const nav = useNavigate()
  const [step, setStep] = useState<Step>('mode')
  const [mode, setMode] = useState<'manual' | 'live'>('manual')
  const [company, setCompany] = useState<'alone' | 'group' | null>(null)
  const [people, setPeople] = useState<string[]>([])
  const [date, setDate] = useState(today)
  const [minutes, setMinutes] = useState('')
  const [km, setKm] = useState('')
  const [notes, setNotes] = useState('')
  const others = snap.profiles.filter((p) => p.active && p.id !== me.id)

  const reset = () => { setStep('mode'); setCompany(null); setPeople([]); setDate(today); setMinutes(''); setKm(''); setNotes('') }
  const close = () => { reset(); onClose() }

  const pick = (m: 'manual' | 'live') => {
    if (m === 'live' && loadLive()) { close(); nav('/caminhada'); return }
    setMode(m)
    setStep('who')
  }

  const afterWho = () => {
    const comp = company === 'group' ? people : []
    if (company === 'group' && !comp.length) { toast('Escolhe quem vai contigo, ou escolhe "Sozinho".', 'error'); return }
    if (mode === 'live') {
      setPendingCompanions(comp)
      close()
      nav('/caminhada')
    } else setStep('form')
  }

  const save = async () => {
    const min = Number(minutes.replace(',', '.'))
    if (!min || min < 1 || min > 1440) { toast('Diz quantos minutos andaste.', 'error'); return }
    const dist = km.trim() ? Number(km.replace(',', '.')) : null
    if (dist !== null && (!(dist >= 0) || dist > 200)) { toast('A distância não parece certa.', 'error'); return }
    if (cmp(date, today) > 0) { toast('A caminhada não pode ser no futuro.', 'error'); return }
    const dur = Math.round(min * 60)
    // sem hora certa: hoje acaba agora; noutro dia, fica a meio da tarde
    const end = date === today ? new Date() : new Date(`${date}T18:00:00`)
    const start = new Date(end.getTime() - dur * 1000)
    await run(() => api.createWalk({
      companions: company === 'group' ? people : [],
      date, started_at: start.toISOString(), ended_at: end.toISOString(), duration_s: dur,
      distance_m: dist === null ? null : Math.round(dist * 1000), route: null, source: 'manual', notes: notes.trim().slice(0, 300),
    }), 'Caminhada registada')
    close()
  }

  const title = step === 'mode' ? 'Caminhada' : step === 'who' ? 'Vais sozinho ou acompanhado?' : 'Registar caminhada'

  return (
    <Sheet open={open} onClose={close} title={title}>
      {step === 'mode' && (
        <div className="stack">
          <p className="small" style={{ color: 'var(--ink-2)' }}>As caminhadas não dão XP nem contam como treino, mas ficam registadas, aparecem no feed e desbloqueiam conquistas próprias.</p>
          <button className="walk-choice" onClick={() => pick('live')}>
            <span className="ico"><MapTrifold size={26} weight="fill" /></span>
            <span className="grow"><b>{loadLive() ? 'Voltar à caminhada' : 'Começar caminhada'}</b><span>Conta o tempo e os km e desenha o percurso no mapa.</span></span>
          </button>
          <button className="walk-choice" onClick={() => pick('manual')}>
            <span className="ico"><PencilSimpleLine size={26} weight="bold" /></span>
            <span className="grow"><b>Registar caminhada</b><span>Já foste? Mete o dia e quanto tempo andaste.</span></span>
          </button>
        </div>
      )}

      {step === 'who' && (
        <div className="stack">
          <div className="grid-2">
            <button className={`btn big ${company === 'alone' ? 'walk' : 'secondary'}`} aria-pressed={company === 'alone'} onClick={() => { setCompany('alone'); setPeople([]) }}><User size={22} weight="bold" /> Sozinho</button>
            <button className={`btn big ${company === 'group' ? 'walk' : 'secondary'}`} aria-pressed={company === 'group'} onClick={() => setCompany('group')}><Users size={22} weight="bold" /> Acompanhado</button>
          </div>
          {company === 'group' && (
            <div className="stack-sm">
              <p className="small strong">Quem vai contigo?</p>
              <div className="walk-people">
                {others.map((p) => {
                  const on = people.includes(p.id)
                  return (
                    <button key={p.id} className="walk-person" aria-pressed={on} onClick={() => setPeople(on ? people.filter((x) => x !== p.id) : [...people, p.id])}>
                      <Avatar avatar={p.avatar} color={p.color} name={p.display_name} size={44} />
                      {p.display_name}
                    </button>
                  )
                })}
              </div>
              <p className="tiny muted">A caminhada fica registada para todos os que foram, e conta para as conquistas de cada um.</p>
            </div>
          )}
          <button className="btn walk big block" disabled={!company} onClick={afterWho}>
            <Footprints size={22} weight="bold" /> {mode === 'live' ? 'Abrir o mapa' : 'Continuar'}
          </button>
          <button className="btn ghost" onClick={() => setStep('mode')}>Voltar</button>
        </div>
      )}

      {step === 'form' && (
        <div className="stack">
          <label className="field"><span>Dia</span><input className="input" type="date" value={date} min={addDays(today, -60)} max={today} onChange={(e) => setDate(e.target.value)} /></label>
          <div className="grid-2">
            <label className="field"><span>Tempo (minutos)</span><input className="input num" inputMode="numeric" placeholder="45" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
            <label className="field"><span>Distância (km, opcional)</span><input className="input num" inputMode="decimal" placeholder="3,5" value={km} onChange={(e) => setKm(e.target.value)} /></label>
          </div>
          <label className="field"><span>Nota (opcional)</span><input className="input" maxLength={300} placeholder="Volta pela praia" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <button className="btn walk big block" onClick={save}><Footprints size={22} weight="bold" /> Guardar caminhada</button>
          <button className="btn ghost" onClick={() => setStep('who')}>Voltar</button>
        </div>
      )}
    </Sheet>
  )
}
