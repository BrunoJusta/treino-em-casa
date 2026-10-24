import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CheckCircle, Repeat, WarningCircle } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { api } from '../lib/config'
import { DayActions, STATE_LABEL } from '../components/DayActions'
import { cmp, dayOfMonth, longDate, monthDays, monthKey, monthName, prevMonth, WEEKDAY_ABBR, WEEKDAY_SHORT, weekday } from '../lib/dates'
import { canUnmark, checkMonthWeeks, monthRequirement, repeatPattern } from '../lib/rules/planning'
import { sfx, vibrate } from '../lib/fx'
import type { PlannedDay } from '../data/types'

/** O meu calendário: marcar, eliminar e mudar dias, e escolher o treino de cada dia. Vive dentro do Calendário. */
export function MyPlanner({ mk }: { mk: string }) {
  const { snap, me, today, run, stateOf, closedMonths } = useApp()
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
    if (ex) {
      // tocar num dia marcado tira-o logo, se a semana continuar com o mínimo; senão abre as opções
      const ctx = { today, days: mine, sessions: snap.sessions, excuses: snap.excuses, closedMonths, minPerWeek: me.min_days_week }
      if (canUnmark(ex, ctx).ok && (stateOf(ex) === 'planned' || stateOf(ex) === 'today')) {
        await run(() => api.removePlannedDay(ex.id), `Dia ${dayOfMonth(d)} eliminado`)
      } else setOpen(ex)
      return
    }
    if (cmp(d, today) < 0) return
    await run(() => api.addPlannedDays(me.id, [{ date: d, plan_id: null }]))
  }

  const repeat = async () => {
    const proposal = repeatPattern(mk, prevDays, me.min_days_week, today).filter((d) => !marked.includes(d))
    if (!proposal.length) return
    await run(() => api.addPlannedDays(me.id, proposal.map((date) => ({ date, plan_id: null }))), `${proposal.length} dias marcados`)
  }

  const upcoming = monthMine.filter((d) => cmp(d.date, today) >= 0 && (stateOf(d) === 'planned' || stateOf(d) === 'today')).sort((x, y) => cmp(x.date, y.date))
  const setDayPlan = (id: string, planId: string) => run(() => api.updatePlannedDay(id, { plan_id: planId || null }), 'Treino escolhido')

  return (
    <>

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
        <p className="small muted">Toca num dia para o marcar. Toca outra vez para o eliminar. Nos dias que já passaram, tocar abre as opções.</p>
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
            <span className="grow small">{w.days.length === 1 ? `Semana só com o dia ${dayOfMonth(w.days[0])}` : `Semana de ${dayOfMonth(w.days[0])} a ${dayOfMonth(w.days.at(-1)!)}`}</span>
            <span className={`chip ${w.ok ? 'ok' : 'warn'} num`}>{w.count}/{w.required}</span>
          </div>
        ))}
      </section>

      {prevDays.length > 0 && marked.length < required && (
        <button className="btn secondary big block" onClick={repeat}><Repeat size={22} weight="bold" /> Repetir o padrão de {monthName(prevMonth(mk))}</button>
      )}

      {upcoming.length > 0 && plans.length > 0 && (
        <section className="stack">
          <h2>Que treino em cada dia?</h2>
          <p className="small muted">Opcional. Escolhe o treino de cada dia marcado. Podes mudar até ao próprio dia.</p>
          <div className="list">
            {upcoming.map((d) => (
              <label key={d.id} className="list-item">
                <span className="grow">
                  <span className="strong" style={{ textTransform: 'capitalize' }}>{WEEKDAY_ABBR[weekday(d.date)]}, {dayOfMonth(d.date)}</span>
                  {d.date === today && <span className="chip on" style={{ marginLeft: 8, fontSize: 12, padding: '2px 8px' }}>hoje</span>}
                </span>
                <select className="select" style={{ width: 'auto', minWidth: 170 }} value={d.plan_id ?? ''} onChange={(e) => setDayPlan(d.id, e.target.value)} aria-label={`Treino de ${longDate(d.date)}`}>
                  <option value="">Escolho na hora</option>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            ))}
          </div>
        </section>
      )}
      <DayActions day={open} onClose={() => setOpen(null)} />
    </>
  )
}

/** /planear passou para dentro do Calendário. */
export function Planear() {
  return <Navigate to="/calendario" replace />
}
