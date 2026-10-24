import { useState } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { MyPlanner } from './Planear'
import { useApp } from '../data/store'
import { Avatar } from '../components/Avatar'
import { DayActions, STATE_LABEL } from '../components/DayActions'
import { Sheet, TopBar } from '../components/ui'
import { cmp, dayOfMonth, longDate, monthDays, monthKey, monthLabel, nextMonth, prevMonth, WEEKDAY_SHORT, weekday } from '../lib/dates'
import type { PlannedDay } from '../data/types'
import type { DayState } from '../lib/rules/planning'

export function Calendario() {
  const { snap, me, today, stateOf } = useApp()
  const [mk, setMk] = useState(monthKey(today))
  const [view, setView] = useState<'familia' | 'eu'>('eu')
  const [selDay, setSelDay] = useState<string | null>(null)
  const [myDay, setMyDay] = useState<PlannedDay | null>(null)
  const people = snap.profiles.filter((p) => p.active)
  const days = monthDays(mk)
  const lead = weekday(days[0])
  const byDate = new Map<string, PlannedDay[]>()
  for (const d of snap.plannedDays) {
    if (monthKey(d.date) !== mk) continue
    if (!byDate.has(d.date)) byDate.set(d.date, [])
    byDate.get(d.date)!.push(d)
  }
  const extraOn = (date: string, pid: string) => snap.sessions.some((s) => s.profile_id === pid && s.date === date) && !byDate.get(date)?.some((d) => d.profile_id === pid)

  const dotClass = (st: DayState) => (st === 'done' ? 'done' : st === 'recover' ? 'recover' : st === 'missed' ? 'missed' : st === 'excused' || st === 'pending' ? 'excused' : 'planned')

  return (
    <main className="page">
      <TopBar title="Calendário" />
      <div className="seg" role="group" aria-label="Vista">
        <button aria-pressed={view === 'eu'} onClick={() => setView('eu')}>O meu</button>
        <button aria-pressed={view === 'familia'} onClick={() => setView('familia')}>Família</button>
      </div>
      <div className="row between">
        <button className="icon-btn" aria-label="Mês anterior" onClick={() => setMk(prevMonth(mk))}><CaretLeft size={20} weight="bold" /></button>
        <h2>{monthLabel(mk)}</h2>
        <button className="icon-btn" aria-label="Mês seguinte" onClick={() => setMk(nextMonth(mk))}><CaretRight size={20} weight="bold" /></button>
      </div>

      {view === 'eu' ? <MyPlanner mk={mk} /> : (
      <>
      <div className="cal">
        {WEEKDAY_SHORT.map((w, i) => <div key={i} className="cal-head" aria-hidden>{w}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} className="cal-day empty" />)}
        {days.map((d) => {
          const list = byDate.get(d) ?? []
          const past = cmp(d, today) < 0
          return (
            <button key={d} className={`cal-day ${d === today ? 'today' : ''} ${past ? 'past' : ''}`} onClick={() => setSelDay(d)} aria-label={`${longDate(d)}, ${list.length} marcados`}>
              <span className="num">{dayOfMonth(d)}</span>
              <span className="cal-dots">
                {people.map((p) => {
                  const pd = list.find((x) => x.profile_id === p.id)
                  if (pd) return <i key={p.id} className={`cal-dot ${dotClass(stateOf(pd))}`} style={{ color: p.color }} />
                  if (extraOn(d, p.id)) return <i key={p.id} className="cal-dot done" style={{ color: p.color }} />
                  return null
                })}
              </span>
            </button>
          )
        })}
      </div>

      <section className="card soft stack-sm" aria-label="Legenda">
        {(
          <div className="row-sm wrap">
            {people.map((p) => <span key={p.id} className="chip" style={{ background: '#fff' }}><i className="cal-dot done" style={{ color: p.color }} /> {p.display_name}</span>)}
          </div>
        )}
        <div className="row-sm wrap small">
          <span className="row-sm"><i className="cal-dot planned" /> marcado</span>
          <span className="row-sm"><i className="cal-dot done" /> feito</span>
          <span className="row-sm"><i className="cal-dot recover" style={{ color: 'var(--warn)' }} /> por recuperar</span>
          <span className="row-sm"><i className="cal-dot missed" /> falhado</span>
          <span className="row-sm"><i className="cal-dot excused" /> desculpado</span>
        </div>
      </section>
      </>
      )}

      <Sheet open={!!selDay} onClose={() => setSelDay(null)} title={selDay ? longDate(selDay) : ''}>
        {selDay && (
          <div className="list">
            {people.map((p) => {
              const pd = (byDate.get(selDay) ?? []).find((x) => x.profile_id === p.id)
              const st = pd ? stateOf(pd) : null
              const ses = snap.sessions.find((s) => s.profile_id === p.id && s.date === selDay)
              const plan = snap.plans.find((x) => x.id === (ses?.plan_id ?? pd?.plan_id))
              return (
                <button key={p.id} className="list-item" disabled={p.id !== me.id || !pd} onClick={() => { if (pd && p.id === me.id) { setSelDay(null); setMyDay(pd) } }}>
                  <Avatar avatar={p.avatar} color={p.color} name={p.display_name} size={40} />
                  <div className="grow">
                    <p className="strong">{p.display_name}</p>
                    <p className="small muted">{ses ? `Treinou${plan ? ` ${plan.name}` : ''}, ${ses.minutes} min` : st ? `${STATE_LABEL[st]}${plan ? `: ${plan.name}` : ''}` : 'Dia livre'}</p>
                  </div>
                  {st && <span className={`chip ${st === 'done' ? 'ok' : st === 'recover' ? 'warn' : st === 'missed' ? 'danger' : ''}`}>{STATE_LABEL[st]}</span>}
                </button>
              )
            })}
          </div>
        )}
      </Sheet>
      <DayActions day={myDay} onClose={() => setMyDay(null)} />
    </main>
  )
}
