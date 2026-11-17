import { describe, expect, it } from 'vitest'
import { recheckWeek, runMaintenanceOn } from './maintenance'
import { weekRisk } from './jar'
import { DEFAULT_SETTINGS } from '../../data/api'
import type { Excuse, Session, Snapshot } from '../../data/types'

let n = 0
const uid = () => `id${n++}`
const ses = (date: string, profile_id = 'a'): Session => ({ id: uid(), profile_id, date } as Session)
const prof = (id: string) => ({ id, username: id, display_name: id, avatar: '', color: '', role: 'member', min_days_week: 2, active: true, restrictions: [], voice_enabled: true, created_at: '2026-10-01T00:00:00Z' })

function snap(sessions: Session[] = [], excuses: Excuse[] = []): Snapshot {
  return { profiles: [prof('a')], plannedDays: [], sessions, excuses, jar: [], closures: [], audit: [], settings: { ...DEFAULT_SETTINGS } } as unknown as Snapshot
}
const owed = (s: Snapshot) => s.jar.filter((j) => j.status !== 'void').map((j) => [j.related_days[0], j.amount_cents])

describe('regra semanal: 2,50 € por treino em falta', () => {
  it('semana sem treinos paga 5 €, com 1 treino paga 2,50 €, com 2 não paga', () => {
    const s = runMaintenanceOn(snap([ses('2026-11-10'), ses('2026-11-17'), ses('2026-11-19')]), '2026-11-24', uid, 'x')
    // 2–8: 0 treinos; 9–15: 1; 16–22: 2. A semana do dia 1 (só domingo) não pede nada.
    expect(owed(s)).toEqual([['2026-11-02', 500], ['2026-11-09', 250]])
  })

  it('não conta o que se marcou: quem não marcou dias paga na mesma', () => {
    const s = runMaintenanceOn(snap(), '2026-11-09', uid, 'x')
    expect(owed(s)).toEqual([['2026-11-02', 500]])
  })

  it('só fecha a semana na segunda-feira seguinte, e uma vez só', () => {
    expect(runMaintenanceOn(snap(), '2026-11-08', uid, 'x').jar).toHaveLength(0)
    const once = runMaintenanceOn(snap(), '2026-11-09', uid, 'x')
    expect(runMaintenanceOn(once, '2026-11-10', uid, 'x').jar).toHaveLength(1)
  })

  it('respeita o teto do mês e não cobra antes da data de início', () => {
    const s = runMaintenanceOn(snap(), '2026-12-01', uid, 'x')
    expect(s.jar.filter((j) => j.month_key === '2026-10')).toHaveLength(0)
    expect(s.jar.filter((j) => j.month_key === '2026-11').reduce((a, j) => a + j.amount_cents, 0)).toBe(1500)
  })

  it('uma desculpa aprovada conta como treino; pendente faz esperar', () => {
    const ex: Excuse = { id: 'e', planned_day_id: 'd', profile_id: 'a', date: '2026-11-04', type: 'sick', note: '', status: 'pending', decided_by: null, decided_at: null, auto: false, created_at: '' }
    const s0 = snap([ses('2026-11-03')], [ex])
    expect(runMaintenanceOn(s0, '2026-11-09', uid, 'x').jar).toHaveLength(0)
    ex.status = 'approved'
    expect(runMaintenanceOn(s0, '2026-11-09', uid, 'x').jar).toHaveLength(0)
  })

  it('desculpa aprovada depois do fecho anula a multa por pagar', () => {
    const s = runMaintenanceOn(snap([ses('2026-11-03')]), '2026-11-09', uid, 'x')
    expect(owed(s)).toEqual([['2026-11-02', 250]])
    s.excuses.push({ id: 'e', planned_day_id: 'd', profile_id: 'a', date: '2026-11-05', type: 'sick', note: '', status: 'approved', decided_by: null, decided_at: null, auto: false, created_at: '' })
    recheckWeek(s, 'a', '2026-11-05', uid, 'x')
    expect(owed(s)).toEqual([])
  })

  it('o aviso mostra quanto falta esta semana', () => {
    const r = weekRisk('a', 2, '2026-11-18', [ses('2026-11-16')], [], [], DEFAULT_SETTINGS)
    expect(r.week).toEqual({ required: 2, done: 1, missing: 1 })
    expect(r.recoverable_cents).toBe(250)
  })
})
