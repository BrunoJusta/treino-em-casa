import { cmp, dayOfMonth, monthKey, monthName, prevMonth } from '../dates'
import { computeMonthClose, monthsToClose, pendingExcusesFor, shouldAutoApprove } from './jar'
import { autofillDates } from './planning'
import type { Snapshot } from '../../data/types'

/**
 * Manutenção diária (idempotente). No Supabase o equivalente corre em SQL com pg_cron (ver supabase/migrations).
 * 1. Aceita desculpas pendentes do mês anterior a partir do dia 6.
 * 2. Fecha os meses anteriores de quem não tem desculpas pendentes: marca falhas e lança multas.
 * 3. A partir do dia 6, completa automaticamente as semanas abaixo do mínimo no mês atual.
 */
export function runMaintenanceOn(snap: Snapshot, today: string, uid: () => string, nowIso: string): Snapshot {
  const s: Snapshot = structuredClone(snap)
  // 1
  for (const e of s.excuses) {
    if (shouldAutoApprove(e, today, s.settings)) {
      e.status = 'approved'
      e.auto = true
      e.decided_at = nowIso
      const pd = s.plannedDays.find((d) => d.id === e.planned_day_id)
      if (pd) pd.status = 'excused'
      s.audit.push({ id: uid(), actor_id: null, action: 'excuse.auto_approve', entity: 'excuse', entity_id: e.id, detail: `Desculpa de ${e.date} aceite automaticamente no prazo`, created_at: nowIso })
    }
  }
  // 2
  for (const p of s.profiles) {
    for (const mk of monthsToClose(p.id, today, s.plannedDays, s.closures)) {
      if (pendingExcusesFor(p.id, mk, s.excuses).length) continue
      const res = computeMonthClose({ profileId: p.id, monthKey: mk, days: s.plannedDays, sessions: s.sessions, excuses: s.excuses }, s.settings)
      for (const d of s.plannedDays) {
        if (d.profile_id !== p.id || monthKey(d.date) !== mk) continue
        if (s.sessions.some((x) => x.profile_id === p.id && x.date === d.date)) d.status = 'done'
        else if (res.missedDays.includes(d.date)) d.status = 'missed'
      }
      let total = 0
      for (const pen of res.penalties) {
        total += pen.amount_cents
        s.jar.push({
          id: uid(), profile_id: p.id, kind: 'penalty', amount_cents: pen.amount_cents,
          reason: `Falhas seguidas nos dias ${pen.related_days.map((d) => dayOfMonth(d)).join(' e ')} de ${monthName(mk)}`,
          related_days: pen.related_days, status: 'unpaid', month_key: mk, created_by: null, created_at: nowIso,
        })
      }
      s.closures.push({ profile_id: p.id, month_key: mk, closed_at: nowIso, misses: res.missedDays.length, penalties_cents: total })
      s.audit.push({ id: uid(), actor_id: null, action: 'month.close', entity: 'profile', entity_id: p.id, detail: `Fecho de ${mk}: ${res.missedDays.length} falhas, ${total / 100} €`, created_at: nowIso })
    }
  }
  // 3
  const mk = monthKey(today)
  if (dayOfMonth(today) > s.settings.plan_window_end_day) {
    // só quem já existia no início do mês (quem entra a meio começa no mês seguinte)
    for (const p of s.profiles.filter((x) => x.active && x.created_at.slice(0, 7) < mk)) {
      const flag = `autofill:${p.id}:${mk}`
      if (s.audit.some((a) => a.entity_id === flag)) continue
      const marked = s.plannedDays.filter((d) => d.profile_id === p.id && monthKey(d.date) === mk).map((d) => d.date)
      const prev = s.plannedDays.filter((d) => d.profile_id === p.id && monthKey(d.date) === prevMonth(mk)).map((d) => d.date)
      const add = autofillDates(mk, marked, prev, p.min_days_week, today)
      for (const date of add) s.plannedDays.push({ id: uid(), profile_id: p.id, date, plan_id: null, status: 'planned', auto_filled: true, moved_from: null })
      s.audit.push({ id: uid(), actor_id: null, action: 'month.autofill', entity: 'planned_days', entity_id: flag, detail: add.length ? `Preenchidos ${add.length} dias automaticamente` : 'Mês já estava completo', created_at: nowIso })
    }
  }
  return s
}

export function isBeforeToday(d: string, today: string) {
  return cmp(d, today) < 0
}
