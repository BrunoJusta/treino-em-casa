import { cmp, dayOfMonth, monthKey, monthName, monthWeeks, nextMonth, weekStart } from '../dates'
import { weekRequirement } from './planning'
import type { Excuse, JarEntry, JarSettings, MonthClosure, PlannedDay, Profile, Session } from '../../data/types'

/*
 * Regras do jarro (decididas com a família):
 * - Um dia marcado que passou sem treino fica "Por recuperar" até ao fim dessa semana (domingo) e pode ser mudado para outro dia dessa semana.
 *   Depois de a semana acabar conta como falha e já não se muda.
 * - No dia 1 às 00h15 fecha-se o mês anterior. Só aí as falhas ficam definitivas.
 * - Multa por cada falha (2,50 € desde novembro de 2026). Nas regras, "a partir da falha n.º" = 1 faz cada falha contar sozinha;
 *   com 2 só conta a partir da segunda seguida (era a regra antiga: 5 €).
 * - Um treino feito, ou uma desculpa aprovada, põe o contador a zero. O contador não passa de um mês para o outro.
 * - Teto por pessoa por mês (20 € desde 17 de novembro de 2026).
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
export function riskPreview(input: PersonMonthInput, settings: JarSettings, today: string): { atRisk: PenaltyDraft[]; streak: number; certain_cents: number; recoverable_cents: number } {
  const pastDays = input.days.filter((d) => cmp(d.date, today) < 0)
  const res = computeMonthClose({ ...input, days: pastDays }, settings)
  // Os dias falhados desta semana ainda se recuperam até domingo; os de semanas que já passaram são falhas certas.
  const thisWeek = weekStart(today)
  const certain = computeMonthClose({ ...input, days: pastDays.filter((d) => weekStart(d.date) !== thisWeek) }, settings)
  const sum = (ps: PenaltyDraft[]) => ps.reduce((a, x) => a + x.amount_cents, 0)
  // com multa por falha, as das semanas que já acabaram são lançadas logo no fecho da semana (já estão no jarro)
  const certain_cents = weeklyClose(settings) ? 0 : sum(certain.penalties)
  const recoverable_cents = Math.max(0, sum(res.penalties) - sum(certain.penalties))
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
  return { atRisk: res.penalties, streak, certain_cents, recoverable_cents }
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

const EUR_WHOLE = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
const EUR_CENTS = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** 5 € ou 2,50 € (com espaço que não parte a linha). */
export function euros(cents: number): string {
  return (cents % 100 === 0 ? EUR_WHOLE : EUR_CENTS).format(cents / 100)
}

/** Regra semanal (consecutive_misses = 1): multa por treino em falta em cada semana, lançada à segunda-feira. Com 2 ou mais volta a regra antiga das falhas seguidas, no fecho do mês. */
export function weeklyClose(settings: JarSettings): boolean {
  return settings.consecutive_misses <= 1
}

/*
 * Regra semanal (desde 2 de novembro de 2026): conta o que se FEZ, não o que se marcou.
 * Cada semana (segunda a domingo, cortada no mês) pede o mínimo de treinos da pessoa (weekRequirement).
 * Cada treino em falta custa penalty_cents (2,50 €). Uma desculpa aprovada conta como treino.
 * A multa é lançada à segunda-feira seguinte, uma vez por pessoa e semana, com o teto do mês.
 */
export interface WeekChunk { mk: string; start: string; days: string[] }

export const weekFlag = (profileId: string, w: WeekChunk) => `week:${profileId}:${w.mk}:${w.start}`

/** Semanas (cortadas no mês) desde `from` que já acabaram (a segunda-feira seguinte já chegou). */
export function weeksToClose(today: string, from: string): WeekChunk[] {
  const out: WeekChunk[] = []
  const thisWeek = weekStart(today)
  for (let mk = monthKey(from); cmp(mk, monthKey(today)) <= 0; mk = nextMonth(mk)) {
    for (const w of monthWeeks(mk)) {
      if (cmp(w.start, weekStart(from)) < 0 || cmp(w.start, thisWeek) >= 0) continue
      out.push({ mk, start: w.start, days: w.days })
    }
  }
  return out
}

export function weekChunkOf(date: string): WeekChunk {
  const mk = monthKey(date)
  const w = monthWeeks(mk).find((x) => x.start === weekStart(date))!
  return { mk, start: w.start, days: w.days }
}

/** Contas de uma semana para uma pessoa: quantos treinos pede, quantos fez, desculpas, quanto falta. */
export function weekTally(profileId: string, minPerWeek: number, w: WeekChunk, sessions: Session[], excuses: Excuse[], settings: JarSettings) {
  const inWeek = new Set(w.days)
  const required = weekRequirement(w.days.length, minPerWeek)
  const doneDates = new Set(sessions.filter((x) => x.profile_id === profileId && inWeek.has(x.date)).map((x) => x.date))
  const mine = excuses.filter((e) => e.profile_id === profileId && inWeek.has(e.date))
  const excused = new Set(mine.filter((e) => e.status === 'approved' && !doneDates.has(e.date)).map((e) => e.date)).size
  const pending = mine.some((e) => e.status === 'pending')
  const missing = Math.max(0, required - doneDates.size - excused)
  return { required, done: doneDates.size, excused, pending, missing, amount: missing * settings.penalty_cents }
}

/** Valor da multa da semana com o teto do mês (sem contar a própria multa, se já existir). */
export function cappedWeekAmount(profileId: string, w: WeekChunk, amount: number, jar: JarEntry[], settings: JarSettings, exceptId?: string): number {
  const already = jar.filter((j) => j.id !== exceptId && j.profile_id === profileId && j.kind === 'penalty' && j.month_key === w.mk && j.status !== 'void').reduce((a, j) => a + j.amount_cents, 0)
  return Math.max(0, Math.min(amount, settings.monthly_cap_cents - already))
}

export function weekReason(w: WeekChunk, t: { required: number; done: number; excused: number; missing: number }): string {
  const a = w.days[0]
  const b = w.days[w.days.length - 1]
  const range = a === b ? `Dia ${dayOfMonth(a)}` : `Semana de ${dayOfMonth(a)} a ${dayOfMonth(b)}`
  return `${range} de ${monthName(w.mk)}: ${t.done + t.excused} de ${t.required} treinos (${t.missing} em falta)`
}

/** Risco da semana atual: quanto vai ser lançado na segunda-feira se não treinar mais. */
export function weekRisk(profileId: string, minPerWeek: number, today: string, sessions: Session[], excuses: Excuse[], jar: JarEntry[], settings: JarSettings) {
  const w = weekChunkOf(today)
  const t = weekTally(profileId, minPerWeek, w, sessions, excuses, settings)
  const recoverable_cents = cmp(today, settings.weekly_from ?? '0000') < 0 ? 0 : cappedWeekAmount(profileId, w, t.amount, jar, settings)
  return { atRisk: [] as PenaltyDraft[], streak: 0, certain_cents: 0, recoverable_cents, week: { required: t.required, done: t.done + t.excused, missing: t.missing } }
}

/** Texto do aviso de risco: separa o que ainda se recupera esta semana do que já é certo. */
export function riskText(r: { certain_cents: number; recoverable_cents: number; week?: { required: number; done: number; missing: number } }, _settings?: JarSettings): string {
  const parts: string[] = []
  if (r.week && r.recoverable_cents > 0) parts.push(`Esta semana tens ${r.week.done} de ${r.week.required} ${r.week.required === 1 ? 'treino' : 'treinos'}. Faz ${r.week.missing === 1 ? 'mais 1 treino' : `mais ${r.week.missing} treinos`} até domingo; se não, na segunda-feira são lançados ${euros(r.recoverable_cents)} no jarro.`)
  else if (r.recoverable_cents > 0) parts.push(`Recupera um dos dias falhados desta semana até domingo e poupas ${euros(r.recoverable_cents)}.`)
  if (r.certain_cents > 0) parts.push(`${euros(r.certain_cents)} já ${r.certain_cents === 100 ? 'é certo' : 'são certos'}: os dias de semanas que já passaram contam como falha e a multa é lançada no fecho do mês.`)
  return parts.join(' ')
}
