import { describe, expect, it } from 'vitest'
import { computeMonthClose, shouldAutoApprove, monthsToClose } from './jar'
import { autofillDates, canMove, canUnmark, checkMonthWeeks, weekRequirement } from './planning'
import { addDays, todayLisbon, weekday } from '../dates'
import type { Excuse, JarSettings, PlannedDay, Session } from '../../data/types'

const S: JarSettings = {
  penalty_cents: 500,
  consecutive_misses: 2,
  monthly_cap_cents: 1500,
  plan_window_end_day: 5,
  excuse_auto_day: 5,
  goal_name: 'Jantar',
  goal_cents: 10000,
  family_goal_sessions: 40,
  family_goal_reward: '',
}

let n = 0
const pd = (date: string, profile_id = 'a'): PlannedDay => ({ id: `d${n++}`, profile_id, date, plan_id: null, status: 'planned', auto_filled: false, moved_from: null })
const ses = (date: string, profile_id = 'a'): Session => ({
  id: `s${n++}`, profile_id, date, started_at: `${date}T10:00:00Z`, ended_at: `${date}T11:00:00Z`, plan_id: null, kind: 'quick', completed_all: false,
  minutes: 40, photo_path: 'x', photo_taken_at: `${date}T11:00:00Z`, in_feed: true, planned_day_id: null, sets: [], notes: '',
})

describe('fecho do mês', () => {
  it('falha, falha = 5 €; terceira falha seguida = mais 5 €', () => {
    const days = ['2026-11-02', '2026-11-04', '2026-11-06'].map((d) => pd(d))
    const r = computeMonthClose({ profileId: 'a', monthKey: '2026-11', days, sessions: [], excuses: [] }, S)
    expect(r.penalties.map((p) => p.amount_cents)).toEqual([500, 500])
    expect(r.missedDays).toHaveLength(3)
  })

  it('um treino pelo meio põe o contador a zero', () => {
    const days = ['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09'].map((d) => pd(d))
    const r = computeMonthClose({ profileId: 'a', monthKey: '2026-11', days, sessions: [ses('2026-11-04')], excuses: [] }, S)
    expect(r.penalties).toHaveLength(1)
    expect(r.penalties[0].related_days).toEqual(['2026-11-06', '2026-11-09'])
  })

  it('desculpa aprovada anula a falha e repõe o contador', () => {
    const days = ['2026-11-02', '2026-11-04', '2026-11-06'].map((d) => pd(d))
    const ex: Excuse = { id: 'e', planned_day_id: days[1].id, profile_id: 'a', date: days[1].date, type: 'sick', note: '', status: 'approved', decided_by: 'a', decided_at: '', auto: false, created_at: '' }
    const r = computeMonthClose({ profileId: 'a', monthKey: '2026-11', days, sessions: [], excuses: [ex] }, S)
    expect(r.penalties).toHaveLength(0)
  })

  it('respeita o teto de 15 € por mês', () => {
    const days = Array.from({ length: 10 }, (_, i) => pd(addDays('2026-11-02', i)))
    const r = computeMonthClose({ profileId: 'a', monthKey: '2026-11', days, sessions: [], excuses: [] }, S)
    expect(r.penalties.reduce((s, p) => s + p.amount_cents, 0)).toBe(1500)
    expect(r.capped).toBe(true)
  })

  it('o contador não passa de um mês para o outro', () => {
    const days = [pd('2026-10-30'), pd('2026-11-02')]
    const oct = computeMonthClose({ profileId: 'a', monthKey: '2026-10', days, sessions: [], excuses: [] }, S)
    const nov = computeMonthClose({ profileId: 'a', monthKey: '2026-11', days, sessions: [], excuses: [] }, S)
    expect(oct.penalties).toHaveLength(0)
    expect(nov.penalties).toHaveLength(0)
  })

  it('só fecha meses anteriores e não repete meses fechados', () => {
    const days = [pd('2026-09-10'), pd('2026-10-10'), pd('2026-11-10')]
    const m = monthsToClose('a', '2026-11-01', days, [{ profile_id: 'a', month_key: '2026-09', closed_at: '', misses: 0, penalties_cents: 0 }])
    expect(m).toEqual(['2026-10'])
  })

  it('desculpas pendentes são aceites a partir do dia 6 do mês seguinte', () => {
    const e = { status: 'pending', date: '2026-10-28' } as Excuse
    expect(shouldAutoApprove(e, '2026-11-05', S)).toBe(false)
    expect(shouldAutoApprove(e, '2026-11-06', S)).toBe(true)
    expect(shouldAutoApprove(e, '2026-12-01', S)).toBe(true)
  })
})

describe('planeamento', () => {
  it('semanas cortadas têm mínimo proporcional', () => {
    expect(weekRequirement(7, 2)).toBe(2)
    expect(weekRequirement(5, 2)).toBe(2)
    expect(weekRequirement(4, 2)).toBe(1)
    expect(weekRequirement(3, 2)).toBe(1)
    expect(weekRequirement(1, 2)).toBe(1)
  })

  it('novembro 2026: 1 dom (semana de 1 dia) + 4 semanas + seg 30', () => {
    const w = checkMonthWeeks('2026-11', [], 2)
    expect(w[0].days).toEqual(['2026-11-01'])
    expect(w[0].required).toBe(1)
    expect(w.at(-1)!.days).toEqual(['2026-11-30'])
  })

  it('preenchimento automático completa semanas com os dias do mês anterior', () => {
    const prev = ['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14'] // segundas e quartas
    const add = autofillDates('2026-11', [], prev, 2, '2026-11-06')
    expect(add.length).toBeGreaterThan(0)
    expect(add.every((d) => d >= '2026-11-06')).toBe(true)
    expect(add.filter((d) => d >= '2026-11-09').every((d) => [0, 2].includes(weekday(d)))).toBe(true)
  })

  it('pode mudar-se um dia falhado para a frente, dentro do mesmo mês', () => {
    const a = pd('2026-11-02')
    const ctx = { today: '2026-11-05', days: [a], sessions: [], excuses: [], closedMonths: new Set<string>(), minPerWeek: 2 }
    expect(canMove(a, '2026-11-06', ctx).ok).toBe(true)
    expect(canMove(a, '2026-11-04', ctx).ok).toBe(false)
    expect(canMove(a, '2026-12-01', ctx).ok).toBe(false)
  })

  it('não deixa tirar um dia se a semana ficar abaixo do mínimo', () => {
    const a = pd('2026-11-10')
    const b = pd('2026-11-12')
    const ctx = { today: '2026-11-05', days: [a, b], sessions: [], excuses: [], closedMonths: new Set<string>(), minPerWeek: 2 }
    expect(canUnmark(a, ctx).ok).toBe(false)
  })

  it('a data de hoje é calculada em Lisboa', () => {
    expect(todayLisbon(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-25') // depois da mudança de hora, UTC+0
    expect(todayLisbon(new Date('2026-07-01T23:30:00Z'))).toBe('2026-07-02') // verão, UTC+1
  })
})
