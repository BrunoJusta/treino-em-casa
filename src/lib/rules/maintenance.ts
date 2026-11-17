import { cmp, dayOfMonth, monthKey, monthName } from '../dates'
import { cappedWeekAmount, computeMonthClose, monthsToClose, pendingExcusesFor, shouldAutoApprove, weekChunkOf, weekFlag, weekReason, weeksToClose, weekTally, weeklyClose, type WeekChunk } from './jar'
import { repeatDates } from './planning'
import type { JarEntry, Snapshot } from '../../data/types'

/**
 * Manutenção diária (idempotente). No Supabase o equivalente corre em SQL com pg_cron (ver supabase/migrations).
 * 1. Aceita desculpas pendentes do mês anterior a partir do dia 6.
 * 1b. Fecha as semanas que já acabaram (regra semanal): multa por cada treino em falta, lançada à segunda-feira.
 * 2. Fecha os meses anteriores de quem não tem desculpas pendentes: marca falhas e lança multas.
 * 3. Para quem ligou "Repetir todas as semanas", marca no mês os mesmos dias da semana, com o mesmo treino.
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
      if (pd && pd.status !== 'done') pd.status = 'excused'
      recheckWeek(s, e.profile_id, e.date, uid, nowIso)
      s.audit.push({ id: uid(), actor_id: null, action: 'excuse.auto_approve', entity: 'excuse', entity_id: e.id, detail: `Desculpa de ${e.date} aceite automaticamente no prazo`, created_at: nowIso })
    }
  }
  // 1b
  if (weeklyClose(s.settings)) {
    const from = s.settings.weekly_from ?? '2026-11-02'
    const flags = new Set(s.audit.map((a) => a.entity_id))
    for (const w of weeksToClose(today, from)) {
      for (const p of s.profiles) {
        if (!p.active || cmp(p.created_at.slice(0, 10) || '0000', w.days[w.days.length - 1]) > 0) continue
        const flag = weekFlag(p.id, w)
        if (flags.has(flag)) continue
        const t = weekTally(p.id, p.min_days_week, w, s.sessions, s.excuses, s.settings)
        if (t.pending) continue // espera pela decisão da desculpa
        const amount = cappedWeekAmount(p.id, w, t.amount, s.jar, s.settings)
        if (amount > 0) s.jar.push(weekEntry(p.id, w, t, amount, uid(), nowIso))
        s.audit.push({ id: uid(), actor_id: null, action: 'week.close', entity: 'profile', entity_id: flag, detail: `${weekReason(w, t)}${amount ? `: ${amount / 100} €` : ''}`, created_at: nowIso })
        flags.add(flag)
      }
    }
  }
  // 2
  for (const p of s.profiles) {
    for (const mk of monthsToClose(p.id, today, s.plannedDays, s.closures)) {
      if (pendingExcusesFor(p.id, mk, s.excuses).length) continue
      const res = computeMonthClose({ profileId: p.id, monthKey: mk, days: s.plannedDays, sessions: s.sessions, excuses: s.excuses }, s.settings)
      // dias que já passaram a falha no fecho da semana já têm a multa lançada
      const weekClosed = new Set(s.plannedDays.filter((d) => d.profile_id === p.id && monthKey(d.date) === mk && d.status === 'missed').map((d) => d.date))
      for (const d of s.plannedDays) {
        if (d.profile_id !== p.id || monthKey(d.date) !== mk) continue
        if (s.sessions.some((x) => x.profile_id === p.id && x.date === d.date)) d.status = 'done'
        else if (res.missedDays.includes(d.date)) d.status = 'missed'
      }
      let total = weeklyClose(s.settings) ? 0 : s.jar.filter((j) => j.profile_id === p.id && j.kind === 'penalty' && j.month_key === mk && j.status !== 'void').reduce((a, j) => a + j.amount_cents, 0)
      for (const pen of weeklyClose(s.settings) ? [] : res.penalties) { // na regra semanal as multas são do fecho da semana
        if (pen.related_days.every((d) => weekClosed.has(d))) continue
        if (s.jar.some((j) => j.kind === 'penalty' && j.profile_id === p.id && j.related_days.join() === pen.related_days.join())) continue
        total += pen.amount_cents
        s.jar.push({
          id: uid(), profile_id: p.id, kind: 'penalty', amount_cents: pen.amount_cents,
          reason: `${pen.related_days.length === 1 ? 'Falha no dia' : 'Falhas seguidas nos dias'} ${pen.related_days.map((d) => dayOfMonth(d)).join(' e ')} de ${monthName(mk)}`,
          related_days: pen.related_days, status: 'unpaid', month_key: mk, created_by: null, created_at: nowIso,
        })
      }
      if (weeklyClose(s.settings)) total = s.jar.filter((j) => j.profile_id === p.id && j.kind === 'penalty' && j.month_key === mk && j.status !== 'void').reduce((a, j) => a + j.amount_cents, 0)
      s.closures.push({ profile_id: p.id, month_key: mk, closed_at: nowIso, misses: res.missedDays.length, penalties_cents: total })
      s.audit.push({ id: uid(), actor_id: null, action: 'month.close', entity: 'profile', entity_id: p.id, detail: `Fecho de ${mk}: ${res.missedDays.length} falhas, ${total / 100} €`, created_at: nowIso })
    }
  }
  // 3. repetir todas as semanas, só para quem o pediu (cada mês é preenchido uma vez, de hoje em diante)
  const mk = monthKey(today)
  for (const p of s.profiles.filter((x) => x.active && x.repeat_weekly?.length)) {
    const flag = `repeat:${p.id}:${mk}`
    if (s.audit.some((a) => a.entity_id === flag)) continue
    const add = repeatDates(mk, today, p.repeat_weekly!, s.plannedDays.filter((d) => d.profile_id === p.id).map((d) => d.date))
    for (const x of add) s.plannedDays.push({ id: uid(), profile_id: p.id, date: x.date, plan_id: x.plan_id, status: 'planned', auto_filled: true, moved_from: null })
    s.audit.push({ id: uid(), actor_id: null, action: 'month.repeat', entity: 'planned_days', entity_id: flag, detail: `Repetição semanal: ${add.length} dias marcados`, created_at: nowIso })
  }
  return s
}

function weekEntry(profileId: string, w: WeekChunk, t: ReturnType<typeof weekTally>, amount: number, id: string, nowIso: string): JarEntry {
  return { id, profile_id: profileId, kind: 'penalty', amount_cents: amount, reason: weekReason(w, t), related_days: [w.days[0], w.days[w.days.length - 1]], status: 'unpaid', month_key: w.mk, created_by: null, created_at: nowIso }
}

/**
 * Uma desculpa decidida depois de a semana fechar: refaz a multa dessa semana.
 * Só mexe numa multa por pagar (uma já paga corrige-se à mão no Jarro).
 */
export function recheckWeek(s: Snapshot, profileId: string, date: string, uid: () => string, nowIso: string) {
  if (!weeklyClose(s.settings)) return
  const w = weekChunkOf(date)
  if (!s.audit.some((a) => a.entity_id === weekFlag(profileId, w))) return // a semana ainda não fechou
  const p = s.profiles.find((x) => x.id === profileId)
  if (!p) return
  const key = [w.days[0], w.days[w.days.length - 1]].join()
  const cur = s.jar.find((j) => j.kind === 'penalty' && j.profile_id === profileId && j.related_days.join() === key)
  if (cur && cur.status === 'paid') return
  const t = weekTally(profileId, p.min_days_week, w, s.sessions, s.excuses, s.settings)
  const amount = cappedWeekAmount(profileId, w, t.amount, s.jar, s.settings, cur?.id)
  if (cur) {
    if (amount > 0) Object.assign(cur, { amount_cents: amount, reason: weekReason(w, t), status: 'unpaid' })
    else Object.assign(cur, { status: 'void', reason: `${weekReason(w, t)} (anulada: desculpa aprovada)` })
  } else if (amount > 0) s.jar.push(weekEntry(profileId, w, t, amount, uid(), nowIso))
}

export function isBeforeToday(d: string, today: string) {
  return cmp(d, today) < 0
}
