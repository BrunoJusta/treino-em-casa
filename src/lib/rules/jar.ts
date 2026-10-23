import { cmp, dayOfMonth, monthKey, nextMonth } from '../dates'
import type { Excuse, JarEntry, JarSettings, MonthClosure, PlannedDay, Profile, Session } from '../../data/types'

/*
 * Regras do jarro (decididas com a família):
 * - Durante o mês, um dia marcado que passou sem treino fica "Por recuperar" e pode ser mudado para outro dia do mesmo mês.
 * - No dia 1 às 00h15 fecha-se o mês anterior. Só aí as falhas ficam definitivas.
 * - Multa de 5 € por cada falha a partir da segunda seguida (falha, falha = 5 €, mais uma falha = mais 5 €).
 * - Um treino feito, ou uma desculpa aprovada, põe o contador a zero. O contador não passa de um mês para o outro.
 * - Teto de 15 € por pessoa por mês.
 * - Quem tem desculpas por decidir espera. No dia 5 às 23h59 as desculpas pendentes do mês anterior são aceites.
 * - Correr o fecho duas vezes não duplica nada (há um registo de fecho por pessoa e mês).
 */

export interface PersonMonthInput {
  profileId: string
  monthKey: string
  days: PlannedDay[]
  sessions: Session[]
  excuses: Excuse[]
}

export interface PenaltyDraft {
  amount_cents: number
  related_days: string[]
}

export interface CloseResult {
  missedDays: string[]
  penalties: PenaltyDraft[]
  capped: boolean
}

export function computeMonthClose(input: PersonMonthInput, settings: JarSettings): CloseResult {
  const days = input.days.filter((d) => d.profile_id === input.profileId && monthKey(d.date) === input.monthKey).sort((a, b) => cmp(a.date, b.date))
  const doneDates = new Set(input.sessions.filter((s) => s.profile_id === input.profileId).map((s) => s.date))
  const approved = new Set(input.excuses.filter((e) => e.status === 'approved').map((e) => e.planned_day_id))

  let counter = 0
  let chain: string[] = []
  let total = 0
  let capped = false
  const missedDays: string[] = []
  const penalties: PenaltyDraft[] = []

  for (const d of days) {
    if (d.status === 'done' || doneDates.has(d.date) || d.status === 'excused' || approved.has(d.id)) {
      counter = 0
      chain = []
      continue
    }
    missedDays.push(d.date)
    counter++
    chain.push(d.date)
    if (counter >= settings.consecutive_misses) {
      const room = settings.monthly_cap_cents - total
      if (room <= 0) {
        capped = true
        continue
      }
      const amount = Math.min(settings.penalty_cents, room)
      if (amount < settings.penalty_cents) capped = true
      total += amount
      penalties.push({ amount_cents: amount, related_days: chain.slice(-settings.consecutive_misses) })
    }
  }
  return { missedDays, penalties, capped }
}

/** Dias com desculpa por decidir num mês, para uma pessoa. */
export function pendingExcusesFor(profileId: string, mk: string, excuses: Excuse[]): Excuse[] {
  return excuses.filter((e) => e.profile_id === profileId && e.status === 'pending' && monthKey(e.date) === mk)
}

/** As desculpas pendentes do mês M são aceites automaticamente a partir do dia (excuse_auto_day + 1) do mês M+1. */
export function shouldAutoApprove(e: Excuse, today: string, settings: JarSettings): boolean {
  if (e.status !== 'pending') return false
  const mk = monthKey(e.date)
  const deadlineMonth = nextMonth(mk)
  if (cmp(monthKey(today), deadlineMonth) > 0) return true
  return monthKey(today) === deadlineMonth && dayOfMonth(today) > settings.excuse_auto_day
}

/** Meses que já podiam estar fechados para esta pessoa (anteriores ao mês atual, com dias marcados). */
export function monthsToClose(profileId: string, today: string, days: PlannedDay[], closures: MonthClosure[]): string[] {
  const current = monthKey(today)
  const done = new Set(closures.filter((c) => c.profile_id === profileId).map((c) => c.month_key))
  const months = new Set(days.filter((d) => d.profile_id === profileId).map((d) => monthKey(d.date)))
  return [...months].filter((m) => cmp(m, current) < 0 && !done.has(m)).sort()
}

/** Pré-visualização do risco durante o mês: o que aconteceria se o mês fechasse agora. */
export function riskPreview(input: PersonMonthInput, settings: JarSettings, today: string): { atRisk: PenaltyDraft[]; streak: number } {
  const pastDays = input.days.filter((d) => cmp(d.date, today) < 0)
  const res = computeMonthClose({ ...input, days: pastDays }, settings)
  // falhas seguidas no fim (as mais recentes)
  const sorted = pastDays.filter((d) => d.profile_id === input.profileId && monthKey(d.date) === input.monthKey).sort((a, b) => cmp(a.date, b.date))
  const done = new Set(input.sessions.filter((s) => s.profile_id === input.profileId).map((s) => s.date))
  const approvedOrPending = new Set(input.excuses.filter((e) => e.status !== 'rejected').map((e) => e.planned_day_id))
  let streak = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    const d = sorted[i]
    if (done.has(d.date) || d.status === 'done' || approvedOrPending.has(d.id) || d.status === 'excused') break
    streak++
  }
  return { atRisk: res.penalties, streak }
}

export function jarTotals(jar: JarEntry[]) {
  let collected = 0 // multas pagas que estão no jarro
  let owed = 0 // multas por pagar
  let spent = 0
  for (const e of jar) {
    if (e.status === 'void') continue
    if (e.kind === 'penalty') {
      if (e.status === 'paid') collected += e.amount_cents
      else owed += e.amount_cents
    } else if (e.kind === 'spend') spent += e.amount_cents
    else if (e.kind === 'adjust') collected += e.amount_cents
  }
  return { collected, owed, spent, balance: collected - spent, potential: collected + owed - spent }
}

export function owedBy(jar: JarEntry[], profiles: Profile[]) {
  return profiles
    .map((p) => ({ profile: p, cents: jar.filter((e) => e.profile_id === p.id && e.kind === 'penalty' && e.status === 'unpaid').reduce((s, e) => s + e.amount_cents, 0) }))
    .filter((x) => x.cents > 0)
}

export function euros(cents: number): string {
  const v = cents / 100
  return `${Number.isInteger(v) ? v : v.toFixed(2).replace('.', ',')} €`
}
