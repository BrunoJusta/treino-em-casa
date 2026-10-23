import { useCallback, useEffect, useMemo, useState } from 'react'
import { LockSimple, Trash } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { api } from '../lib/config'
import { BackHeader, Empty, Switch } from '../components/ui'
import { addDays, cmp, shortDate } from '../lib/dates'
import { kg, num1 } from '../lib/format'
import { ConfirmSheet } from '../components/ui'
import type { BodyMetric, BodyProfile } from '../data/types'

const RANGES = [
  { id: '30', label: '30 dias', days: 30 },
  { id: '90', label: '3 meses', days: 90 },
  { id: '365', label: '1 ano', days: 365 },
]

// Faixas da OMS para adultos. Mostradas em cor neutra, sem vermelho.
function bmiBand(bmi: number) {
  if (bmi < 18.5) return 'Abaixo do peso'
  if (bmi < 25) return 'Peso normal'
  if (bmi < 30) return 'Excesso de peso'
  return 'Obesidade'
}

export function Corpo() {
  const { today, toast } = useApp()
  const [profile, setProfile] = useState<BodyProfile | null>(null)
  const [metrics, setMetrics] = useState<BodyMetric[]>([])
  const [range, setRange] = useState('90')
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(today)
  const [del, setDel] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await api.getBody()
    setProfile(r.profile)
    setMetrics([...r.metrics].sort((a, b) => cmp(a.date, b.date)))
  }, [])
  useEffect(() => { void load() }, [load])

  const saveProfile = async (p: Partial<BodyProfile>) => {
    const next = { ...profile!, ...p }
    setProfile(next)
    try { await api.saveBodyProfile(next) } catch (e) { toast((e as Error).message, 'error') }
  }
  const addWeight = async () => {
    const w = Number(weight.replace(',', '.'))
    if (!w || w < 25 || w > 300) return toast('Escreve o peso em kg, por exemplo 72,5', 'error')
    try { await api.addBodyMetric(date, Math.round(w * 10) / 10); setWeight(''); await load(); toast('Peso registado') } catch (e) { toast((e as Error).message, 'error') }
  }

  const last = metrics.at(-1)
  const first = metrics[0]
  const bmi = last && profile?.height_cm ? last.weight_kg / (profile.height_cm / 100) ** 2 : null
  const shown = useMemo(() => {
    const from = addDays(today, -RANGES.find((r) => r.id === range)!.days)
    return metrics.filter((m) => cmp(m.date, from) >= 0)
  }, [metrics, range, today])

  if (!profile) return <main className="page"><BackHeader title="Peso e IMC" /><div className="skeleton" style={{ height: 240 }} /></main>

  return (
    <main className="page">
      <BackHeader title="Peso e IMC" to="/perfil" />
      <p className="small muted row-sm"><LockSimple size={16} /> Privado. Só tu vês estes dados, nem o admin. Nunca entram no feed nem no ranking.</p>

      <section className="grid-2">
        <div className="stat"><span>Peso atual</span><b className="num">{last ? kg(last.weight_kg) : 'sem dados'}</b>{first && last && first !== last && <span className="num">{last.weight_kg - first.weight_kg > 0 ? '+' : ''}{kg(last.weight_kg - first.weight_kg)} desde {shortDate(first.date)}</span>}</div>
        <div className="stat"><span>IMC</span><b className="num">{bmi ? num1(bmi) : 'sem altura'}</b>{bmi && <span>{bmiBand(bmi)}</span>}</div>
      </section>

      <section className="card stack">
        <div className="seg">{RANGES.map((r) => <button key={r.id} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>)}</div>
        {shown.length >= 2 ? <WeightChart data={shown} goal={profile.goal_kg} /> : <Empty title="Ainda há poucos registos" text="Com dois ou mais pesos aparece aqui o gráfico da evolução." mood="happy" />}
      </section>

      <section className="card stack">
        <h3>Registar peso</h3>
        <div className="row-sm">
          <label className="field grow"><span>Peso (kg)</span><input className="input num" inputMode="decimal" enterKeyHint="done" autoComplete="off" onKeyDown={(e) => e.key === 'Enter' && addWeight()} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="72,5" /></label>
          <label className="field"><span>Dia</span><input className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
        <button className="btn primary big block" onClick={addWeight}>Guardar</button>
      </section>

      <section className="card stack">
        <h3>Os meus dados</h3>
        <div className="grid-2">
          <label className="field"><span>Altura (cm)</span><input className="input num" inputMode="numeric" defaultValue={profile.height_cm ?? ''} onBlur={(e) => saveProfile({ height_cm: Number(e.target.value) || null })} /></label>
          <label className="field"><span>Peso-objetivo (kg)</span><input className="input num" inputMode="decimal" defaultValue={profile.goal_kg ?? ''} onBlur={(e) => saveProfile({ goal_kg: Number(e.target.value.replace(',', '.')) || null })} /></label>
        </div>
        <label className="row between">
          <span><span className="strong">Lembrete semanal</span><br /><span className="small muted">Uma vez por semana, no ecrã Hoje. Só tu o vês.</span></span>
          <Switch checked={profile.weekly_reminder} onChange={(v) => saveProfile({ weekly_reminder: v })} label="Lembrete semanal" />
        </label>
      </section>

      <ConfirmSheet open={!!del} title="Apagar este registo?" text="O peso desse dia sai do gráfico. Não dá para desfazer." confirm="Apagar" danger onClose={() => setDel(null)}
        onConfirm={async () => { try { await api.deleteBodyMetric(del!); await load() } catch (e) { toast((e as Error).message, 'error') } }} />
      {metrics.length > 0 && (
        <section className="stack-sm">
          <h3>Registos</h3>
          <div className="list">
            {[...metrics].reverse().slice(0, 20).map((m) => (
              <div key={m.id} className="list-item" style={{ minHeight: 52 }}>
                <span className="grow">{shortDate(m.date)}</span>
                <span className="num strong">{kg(m.weight_kg)}</span>
                <button className="icon-btn plain" aria-label={`Apagar registo de ${shortDate(m.date)}`} onClick={() => setDel(m.id)}><Trash size={18} /></button>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

function WeightChart({ data, goal }: { data: BodyMetric[]; goal: number | null }) {
  const W = 340
  const H = 180
  const pad = { l: 34, r: 10, t: 12, b: 24 }
  const ws = data.map((d) => d.weight_kg)
  const min = Math.floor(Math.min(...ws, goal ?? Infinity) - 1)
  const max = Math.ceil(Math.max(...ws, goal ?? -Infinity) + 1)
  const t0 = new Date(data[0].date).getTime()
  const t1 = new Date(data.at(-1)!.date).getTime()
  const x = (d: string) => pad.l + ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - min) / Math.max(1, max - min)) * (H - pad.t - pad.b)
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(d.date).toFixed(1)},${y(d.weight_kg).toFixed(1)}`).join(' ')
  const area = `${path} L${x(data.at(-1)!.date)},${H - pad.b} L${x(data[0].date)},${H - pad.b} Z`
  const ticks = [min, Math.round((min + max) / 2), max]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Evolução do peso: de ${data[0].weight_kg} para ${data.at(-1)!.weight_kg} kg`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#E6E8EE" />
          <text x={pad.l - 6} y={y(t) + 4} fontSize="11" textAnchor="end" fill="#7C7F93">{t}</text>
        </g>
      ))}
      {goal && <line x1={pad.l} x2={W - pad.r} y1={y(goal)} y2={y(goal)} stroke="#40A02B" strokeDasharray="4 4" />}
      {goal && <text x={W - pad.r} y={y(goal) - 4} fontSize="11" textAnchor="end" fill="#2F7D1F">objetivo {goal} kg</text>}
      <path d={area} fill="#39C2EF" opacity="0.12" />
      <path d={path} fill="none" stroke="#39C2EF" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d) => <circle key={d.date} cx={x(d.date)} cy={y(d.weight_kg)} r="3.5" fill="#fff" stroke="#39C2EF" strokeWidth="2" />)}
      <text x={pad.l} y={H - 6} fontSize="11" fill="#7C7F93">{shortDate(data[0].date)}</text>
      <text x={W - pad.r} y={H - 6} fontSize="11" textAnchor="end" fill="#7C7F93">{shortDate(data.at(-1)!.date)}</text>
    </svg>
  )
}
