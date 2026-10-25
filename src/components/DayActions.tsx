import { useState } from 'react'
import { ArrowsLeftRight, FirstAidKit, Trash, Barbell } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { api } from '../lib/config'
import { cmp, dayOfMonth, longDate, monthDays, monthKey, WEEKDAY_SHORT, weekday } from '../lib/dates'
import { canMove, canUnmark, unmarkWarning, type DayState } from '../lib/rules/planning'
import { Sheet } from './ui'
import type { ExcuseType, PlannedDay } from '../data/types'

export const STATE_LABEL: Record<DayState, string> = {
  done: 'Feito',
  excused: 'Desculpado',
  pending: 'Desculpa por decidir',
  missed: 'Falhado',
  recover: 'Por recuperar',
  today: 'Marcado para hoje',
  planned: 'Marcado',
}

export const EXCUSE_LABEL: Record<ExcuseType, string> = { sick: 'Doente', injury: 'Lesão', travel: 'Viagem', other: 'Outro motivo' }

export function DayActions({ day, onClose }: { day: PlannedDay | null; onClose: () => void }) {
  const { me, snap, today, run, stateOf, closedMonths } = useApp()
  const [mode, setMode] = useState<'menu' | 'move' | 'excuse'>('menu')
  const [exType, setExType] = useState<ExcuseType>('sick')
  const [note, setNote] = useState('')
  const close = () => { setMode('menu'); setNote(''); onClose() }
  if (!day) return <Sheet open={false} onClose={close}>{null}</Sheet>
  const st = stateOf(day)
  const mine = snap.plannedDays.filter((d) => d.profile_id === me.id)
  const ctx = { today, days: mine, sessions: snap.sessions, excuses: snap.excuses, closedMonths, minPerWeek: me.min_days_week }
  const unmark = canUnmark(day, ctx)
  const unmarkWarn = unmark.ok ? unmarkWarning(day, ctx) : null
  const canChange = st === 'planned' || st === 'today' || st === 'recover'
  const canExcuse = st === 'recover' || st === 'today'
  const mk = monthKey(day.date)
  const targets = monthDays(mk).filter((d) => cmp(d, today) >= 0)
  const plan = snap.plans.find((p) => p.id === day.plan_id)

  return (
    <Sheet open={!!day} onClose={close} title={longDate(day.date)}>
      {mode === 'menu' && (
        <div className="stack">
          <div className="row-sm wrap">
            <span className={`chip ${st === 'done' ? 'ok' : st === 'recover' ? 'warn' : st === 'missed' ? 'danger' : st === 'today' || st === 'planned' ? 'on' : ''}`}>{STATE_LABEL[st]}</span>
            {day.auto_filled && <span className="chip">Repetição semanal</span>}
            {day.moved_from && <span className="chip">Veio do dia {dayOfMonth(day.moved_from)}</span>}
          </div>
          {st === 'recover' && <p className="small" style={{ color: 'var(--ink-2)' }}>Este dia já passou sem treino. Muda-o para hoje ou para um dia livre deste mês e treina nesse dia. Se não o recuperares, conta como falha no fecho do mês.</p>}
          {canChange && (
            <label className="field">
              <span>Treino para este dia</span>
              <select className="select big" value={day.plan_id ?? ''} onChange={(e) => run(() => api.updatePlannedDay(day.id, { plan_id: e.target.value || null }), 'Treino atualizado')}>
                <option value="">Escolho na hora</option>
                {snap.plans.filter((p) => !p.owner_id || p.owner_id === me.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}
          {!canChange && plan && <p className="row-sm"><Barbell size={18} /> {plan.name}</p>}
          {canChange && <button className="btn secondary big block" onClick={() => setMode('move')}><ArrowsLeftRight size={22} weight="bold" /> Mudar para outro dia</button>}
          {canExcuse && <button className="btn secondary big block" onClick={() => setMode('excuse')}><FirstAidKit size={22} weight="bold" /> Pedir desculpa</button>}
          {canChange && cmp(day.date, today) >= 0 && (
            <div className="stack-sm">
              <button className="btn danger block" disabled={!unmark.ok} aria-describedby={unmark.ok ? undefined : 'unmark-why'} onClick={() => run(() => api.removePlannedDay(day.id), 'Dia eliminado').then(close)}><Trash size={20} weight="bold" /> Eliminar este dia</button>
              {!unmark.ok && <p id="unmark-why" className="small muted">{unmark.reason}</p>}
              {unmarkWarn && <p className="small" style={{ color: 'var(--warn)' }}>{unmarkWarn}</p>}
            </div>
          )}
        </div>
      )}
      {mode === 'move' && (
        <div className="stack">
          <p className="small" style={{ color: 'var(--ink-2)' }}>Escolhe o dia novo. Só dá para dias deste mês, de hoje em diante, que ainda não estejam marcados.</p>
          <div className="cal">
            {WEEKDAY_SHORT.map((w, i) => <div key={i} className="cal-head">{w}</div>)}
            {Array.from({ length: weekday(`${mk}-01`) }, (_, i) => <div key={`e${i}`} />)}
            {monthDays(mk).map((d) => {
              const ok = targets.includes(d) && canMove(day, d, ctx).ok
              return (
                <button key={d} className={`plan-day ${ok ? '' : 'locked'} ${d === today ? 'today' : ''}`} disabled={!ok} aria-label={longDate(d)} onClick={() => run(() => api.updatePlannedDay(day.id, { date: d, moved_from: day.moved_from ?? day.date }), `Mudado para dia ${dayOfMonth(d)}`).then(close)}>
                  {dayOfMonth(d)}
                </button>
              )
            })}
          </div>
          <button className="btn ghost" onClick={() => setMode('menu')}>Voltar</button>
        </div>
      )}
      {mode === 'excuse' && (
        <div className="stack">
          <p className="small" style={{ color: 'var(--ink-2)' }}>O admin decide. Enquanto não decide, o dia não conta como falha. Se ninguém decidir até dia {snap.settings.excuse_auto_day} do mês seguinte, é aceite automaticamente.</p>
          <div className="grid-2">
            {(Object.keys(EXCUSE_LABEL) as ExcuseType[]).map((t) => (
              <button key={t} className={`btn ${exType === t ? 'primary' : 'secondary'}`} aria-pressed={exType === t} onClick={() => setExType(t)}>{EXCUSE_LABEL[t]}</button>
            ))}
          </div>
          <label className="field"><span>Nota (opcional)</span><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></label>
          <button className="btn primary big block" onClick={() => run(() => api.createExcuse(day.id, exType, note), 'Desculpa enviada ao admin').then(close)}>Enviar desculpa</button>
          <button className="btn ghost" onClick={() => setMode('menu')}>Voltar</button>
        </div>
      )}
    </Sheet>
  )
}
