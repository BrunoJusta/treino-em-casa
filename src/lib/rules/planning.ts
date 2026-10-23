import { addDays, cmp, dayOfMonth, monthDays, monthKey, monthWeeks, prevMonth, weekday, weekStart } from '../dates'
import type { Excuse, PlannedDay, Session } from '../../data/types'

/**
 * Mínimo de dias numa semana (segunda a domingo) dentro de um mês.
 * As semanas cortadas no início e no fim do mês têm o mínimo proporcional:
 * com menos de 4 dias dentro do mês, pede metade (arredondada para cima).
 */
export function weekRequirement(daysInMonthForWeek: number, minPerWeek: number): number {
  if (daysInMonthForWeek >= 4) return minPerWeek
  return Math.min(daysInMonthForWeek, Math.ceil(minPerWeek / 2))
}

export interface WeekCheck {
  start: string
  days: string[]
  required: number
  count: number
  ok: boolean
}

export function checkMonthWeeks(mk: string, marked: string[], minPerWeek: number): WeekCheck[] {
  const set = new Set(marked)
  return monthWeeks(mk).map((w) => {
    const required = weekRequirement(w.days.length, minPerWeek)
    const count = w.days.filter((d) => set.has(d)).length
    return { start: w.start, days: w.days, required, count, ok: count >= required }
  })
}

export function monthRequirement(mk: string, minPerWeek: number): number {
  return checkMonthWeeks(mk, [], minPerWeek).reduce((s, w) => s + w.required, 0)
}

export type DayState =
  | 'done' // treino feito
  | 'excused' // desculpa aprovada
  | 'pending' // desculpa por decidir
  | 'missed' // falha definitiva (mês fechado)
  | 'recover' // dia que já passou sem treino, ainda dá para recuperar este mês
  | 'today' // marcado para hoje
  | 'planned' // marcado para o futuro

export function dayState(
  pd: PlannedDay,
  today: string,
  sessions: Session[],
  excuses: Excuse[],
  closedMonths: Set<string>,
): DayState {
  if (pd.status === 'done' || sessions.some((s) => s.profile_id === pd.profile_id && s.date === pd.date)) return 'done'
  const ex = excuses.find((e) => e.planned_day_id === pd.id && e.status !== 'rejected')
  if (pd.status === 'excused' || ex?.status === 'approved') return 'excused'
  if (ex?.status === 'pending') return 'pending'
  if (pd.status === 'missed' || closedMonths.has(`${pd.profile_id}:${monthKey(pd.date)}`)) return 'missed'
  if (cmp(pd.date, today) < 0) return 'recover'
  if (pd.date === today) return 'today'
  return 'planned'
}

export interface Ctx {
  today: string
  days: PlannedDay[] // dias marcados da pessoa
  sessions: Session[]
  excuses: Excuse[]
  closedMonths: Set<string>
  minPerWeek: number
}

/** Pode tirar-se um dia? Só dias de hoje em diante, ainda sem treino, e sem deixar a semana abaixo do mínimo. */
export function canUnmark(pd: PlannedDay, ctx: Ctx): { ok: boolean; reason?: string } {
  if (cmp(pd.date, ctx.today) < 0) return { ok: false, reason: 'Os dias que já passaram não se eliminam. Podes mudá-los para outro dia deste mês.' }
  const st = dayState(pd, ctx.today, ctx.sessions, ctx.excuses, ctx.closedMonths)
  if (st === 'done') return { ok: false, reason: 'Este dia já tem treino feito.' }
  if (st === 'pending' || st === 'excused') return { ok: false, reason: 'Este dia tem uma desculpa.' }
  const mk = monthKey(pd.date)
  const marked = ctx.days.filter((d) => monthKey(d.date) === mk && d.id !== pd.id).map((d) => d.date)
  const wk = checkMonthWeeks(mk, marked, ctx.minPerWeek).find((w) => w.start === weekStart(pd.date))
  if (wk && !wk.ok) {
    return { ok: false, reason: `Esta semana precisa de pelo menos ${wk.required} ${wk.required === 1 ? 'dia' : 'dias'}. Em vez de eliminar, muda-o para outro dia.` }
  }
  return { ok: true }
}

/** Pode mudar-se um dia marcado para outra data? Dentro do mesmo mês, para hoje ou para a frente. */
export function canMove(pd: PlannedDay, to: string, ctx: Ctx): { ok: boolean; reason?: string } {
  const st = dayState(pd, ctx.today, ctx.sessions, ctx.excuses, ctx.closedMonths)
  if (st === 'done') return { ok: false, reason: 'Este dia já tem treino feito.' }
  if (st === 'missed') return { ok: false, reason: 'Este mês já fechou.' }
  if (st === 'pending' || st === 'excused') return { ok: false, reason: 'Este dia tem uma desculpa.' }
  if (monthKey(to) !== monthKey(pd.date)) return { ok: false, reason: 'Os dias não passam para outro mês.' }
  if (cmp(to, ctx.today) < 0) return { ok: false, reason: 'Só podes mudar para hoje ou para a frente.' }
  if (ctx.days.some((d) => d.date === to)) return { ok: false, reason: 'Esse dia já está marcado.' }
  return { ok: true }
}

/** Dias da semana preferidos da pessoa, com base no mês anterior (do mais usado para o menos usado). */
export function preferredWeekdays(prevDays: string[]): number[] {
  const count = [0, 0, 0, 0, 0, 0, 0]
  for (const d of prevDays) count[weekday(d)]++
  const used = count.map((c, i) => ({ c, i })).filter((x) => x.c > 0).sort((a, b) => b.c - a.c || a.i - b.i).map((x) => x.i)
  // Ordem de recurso: segunda, quinta, quarta, sábado, terça, sexta, domingo
  const fallback = [0, 3, 2, 5, 1, 4, 6]
  return [...used, ...fallback.filter((i) => !used.includes(i))]
}

/**
 * Preenchimento automático no dia 6: completa as semanas abaixo do mínimo,
 * repetindo os dias da semana do mês anterior. Só usa dias de hoje em diante.
 */
export function autofillDates(mk: string, marked: string[], prevMonthDays: string[], minPerWeek: number, today: string): string[] {
  const pref = preferredWeekdays(prevMonthDays)
  const set = new Set(marked)
  const add: string[] = []
  for (const w of checkMonthWeeks(mk, marked, minPerWeek)) {
    let missing = w.required - w.count
    if (missing <= 0) continue
    const candidates = w.days.filter((d) => !set.has(d) && cmp(d, today) >= 0).sort((a, b) => pref.indexOf(weekday(a)) - pref.indexOf(weekday(b)))
    for (const d of candidates) {
      if (missing <= 0) break
      add.push(d)
      set.add(d)
      missing--
    }
  }
  return add.sort()
}

/** Proposta para "repetir o padrão do mês passado". */
export function repeatPattern(mk: string, prevMonthDays: string[], minPerWeek: number, today: string): string[] {
  const wds = new Set(prevMonthDays.map(weekday))
  const base = wds.size ? monthDays(mk).filter((d) => wds.has(weekday(d)) && cmp(d, today) >= 0) : []
  const extra = autofillDates(mk, base, prevMonthDays, minPerWeek, today)
  return [...base, ...extra].sort()
}

export function isPlanningWindow(today: string, windowEndDay: number): boolean {
  return dayOfMonth(today) <= windowEndDay
}

export { prevMonth, addDays }
