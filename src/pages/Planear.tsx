import { useState } from 'react'
import { CheckCircle, Repeat, WarningCircle } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { api } from '../lib/config'
import { BackHeader } from '../components/ui'
import { DayActions, STATE_LABEL } from '../components/DayActions'
import { cmp, dayOfMonth, longDate, monthDays, monthKey, monthLabel, monthName, nextMonth, prevMonth, WEEKDAY_ABBR, WEEKDAY_SHORT, weekday } from '../lib/dates'
import { checkMonthWeeks, monthRequirement, repeatPattern } from '../lib/rules/planning'
import { sfx, vibrate } from '../lib/fx'
import type { PlannedDay } from '../data/types'

export function Planear() {
  const { snap, me, today, run, stateOf } = useApp()
  const cur = monthKey(today)
  const [mk, setMk] = useState(cur)
  const [open, setOpen] = useState<PlannedDay | null>(null)
  const mine = snap.plannedDays.filter((d) => d.profile_id === me.id)
  const monthMine = mine.filter((d) => monthKey(d.date) === mk)
  const marked = monthMine.map((d) => d.date)
  const weeks = checkMonthWeeks(mk, marked, me.min_days_week)
  const required = monthRequirement(mk, me.min_days_week)
  const allOk = weeks.every((w) => w.ok)
  const days = monthDays(mk)
  const prevDays = mine.filter((d) => monthKey(d.date) === prevMonth(mk)).map((d) => d.date)
  const plans = snap.plans.filter((p) => !p.owner_id || p.owner_id === me.id)

  const toggle = async (d: string) => {
    sfx.tap()
    vibrate(10)
    const ex = monthMine.find((x) => x.date === d)
    if (ex) { setOpen(ex); return }
    if (cmp(d, today) < 0) return
    await run(() => api.addPlannedDays(me.id, [{ date: d, plan_id: null }]))
  }

  const repeat = async () => {
    const proposal = repeatPattern(mk, prevDays, me.min_days_week, today).filter((d) => !marked.includes(d))
    if (!proposal.length) return
    await run(() => api.addPlannedDays(me.id, proposal.map((date) => ({ date, plan_id: null }))), `${proposal.length} dias marcados`)
  }

  const setWeekdayPlan = async (wd: number, planId: string) => {
    const targets = monthMine.filter((d) => weekday(d.date) === wd && cmp(d.date, today) >= 0 && (stateOf(d) === 'planned' || stateOf(d) === 'today'))
    await run(async () => { for (const t of targets) await api.updatePlannedDay(t.id, { plan_id: planId || null }) }, 'Treinos atribuídos')
  }
  const usedWeekdays = [...new Set(monthMine.filter((d) => cmp(d.date, today) >= 0).map((d) => weekday(d.date)))].sort()

  return (
    <main className="page">
      <BackHeader title="Planear o mês" to="/calendario" />
      <div className="seg">
        <button aria-pressed={mk === cur} onClick={() => setMk(cur)}>{monthLabel(cur)}</button>
        <button aria-pressed={mk === nextMonth(cur)} onClick={() => setMk(nextMonth(cur))}>{monthLabel(nextMonth(cur))}</button>
      </div>

      <div className={`card ${allOk ? 'accent' : 'warn'} row`}>
        {allOk ? <CheckCircle size={30} weight="fill" color="var(--accent-text)" /> : <WarningCircle size={30} weight="fill" color="var(--warn)" />}
        <div className="grow">
          <p className="strong num">{marked.length} dias marcados, mínimo {required}</p>
          <p className="small" style={{ color: 'var(--ink-2)' }}>
            {allOk ? 'Todas as semanas têm o mínimo. Podes mudar os dias quando quiseres, dentro do mês.' : `Pelo menos ${me.min_days_week} dias por semana (1 nas semanas cortadas). Planeia até dia ${snap.settings.plan_window_end_day}; depois a app completa o que faltar.`}
          </p>
        </div>
      </div>

      <section className="stack-sm" aria-label={`Dias de ${monthName(mk)}`}>
        <p className="small muted">Toca nos dias em que vais treinar.</p>
        <div className="cal" style={{ gap: 6 }}>
          {WEEKDAY_SHORT.map((w, i) => <div key={i} className="cal-head">{w}</div>)}
          {Array.from({ length: weekday(days[0]) }, (_, i) => <div key={`e${i}`} />)}
          {days.map((d) => {
            const pd = monthMine.find((x) => x.date === d)
            const st = pd ? stateOf(pd) : null
            const locked = !pd && cmp(d, today) < 0
            const cls = st ? (st === 'planned' || st === 'today' ? `on ${pd!.auto_filled ? 'auto' : ''}` : st) : ''
            return (
              <button key={d} className={`plan-day ${cls} ${locked ? 'locked' : ''} ${d === today ? 'today' : ''}`} onClick={() => toggle(d)} disabled={locked} aria-label={`${longDate(d)}: ${st ? STATE_LABEL[st] + (pd!.auto_filled ? ', preenchido pela app' : '') : locked ? 'já passou' : 'livre, tocar para marcar'}`}>
                {dayOfMonth(d)}
              </button>
            )
          })}
        </div>
      </section>

      <section className="list" aria-label="Semanas">
        {weeks.map((w) => (
          <div key={w.start} className="list-item" style={{ minHeight: 48, padding: '10px 16px' }}>
            <span className="grow small">Semana de {dayOfMonth(w.days[0])} a {dayOfMonth(w.days.at(-1)!)}</span>
            <span className={`chip ${w.ok ? 'ok' : 'warn'} num`}>{w.count}/{w.required}</span>
          </div>
        ))}
      </section>

      {prevDays.length > 0 && marked.length < required && (
        <button className="btn secondary big block" onClick={repeat}><Repeat size={22} weight="bold" /> Repetir o padrão de {monthName(prevMonth(mk))}</button>
      )}

      {usedWeekdays.length > 0 && plans.length > 0 && (
        <section className="stack">
          <h2>Que treino em cada dia?</h2>
          <p className="small muted">Opcional. Aplica a todos os dias marcados desse dia da semana, daqui para a frente.</p>
          <div className="list">
            {usedWeekdays.map((wd) => {
              const sample = monthMine.find((d) => weekday(d.date) === wd && cmp(d.date, today) >= 0)
              return (
                <label key={wd} className="list-item">
                  <span className="grow strong" style={{ textTransform: 'capitalize' }}>{WEEKDAY_ABBR[wd]}</span>
                  <select className="select" style={{ width: 'auto', minWidth: 170 }} value={sample?.plan_id ?? ''} onChange={(e) => setWeekdayPlan(wd, e.target.value)}>
                    <option value="">Escolho na hora</option>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
              )
            })}
          </div>
        </section>
      )}
      <DayActions day={open} onClose={() => setOpen(null)} />
    </main>
  )
}
