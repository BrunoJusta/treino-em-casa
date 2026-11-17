import { describe, expect, it } from 'vitest'
import { runMaintenanceOn } from './maintenance'
import { riskPreview } from './jar'
import { DEFAULT_SETTINGS } from '../../data/api'
import type { PlannedDay, Snapshot } from '../../data/types'

let n = 0
const uid = () => `id${n++}`
const pd = (date: string): PlannedDay => ({ id: `d-${date}`, profile_id: 'a', date, plan_id: null, status: 'planned', auto_filled: false, moved_from: null })

function snap(days: PlannedDay[]): Snapshot {
  return {
    profiles: [{ id: 'a', username: 'a', display_name: 'A', avatar: '', color: '', role: 'member', min_days_week: 2, active: true, restrictions: [], voice_enabled: true, created_at: '' }],
    plannedDays: days, sessions: [], excuses: [], jar: [], closures: [], audit: [], settings: { ...DEFAULT_SETTINGS },
  } as unknown as Snapshot
}

describe('fecho da semana (2,50 € por falha)', () => {
  it('lança a multa na segunda-feira seguinte, uma vez só', () => {
    const s0 = snap([pd('2026-11-12'), pd('2026-11-15'), pd('2026-11-18')])
    const sunday = runMaintenanceOn(s0, '2026-11-15', uid, 'x')
    expect(sunday.jar).toHaveLength(0) // a semana ainda não acabou
    const monday = runMaintenanceOn(s0, '2026-11-16', uid, 'x')
    expect(monday.jar.map((j) => [j.related_days[0], j.amount_cents, j.status])).toEqual([['2026-11-12', 250, 'unpaid'], ['2026-11-15', 250, 'unpaid']])
    expect(monday.plannedDays.find((d) => d.date === '2026-11-18')!.status).toBe('planned')
    const again = runMaintenanceOn(monday, '2026-11-17', uid, 'x')
    expect(again.jar).toHaveLength(2)
  })

  it('o fecho do mês não repete as multas já lançadas', () => {
    const s0 = snap([pd('2026-11-12'), pd('2026-11-25')])
    const weekly = runMaintenanceOn(s0, '2026-11-16', uid, 'x')
    const closed = runMaintenanceOn(weekly, '2026-12-01', uid, 'x')
    expect(closed.jar.map((j) => j.related_days[0]).sort()).toEqual(['2026-11-12', '2026-11-25'])
    expect(closed.closures[0].penalties_cents).toBe(500)
  })

  it('respeita o teto do mês', () => {
    const days = ['02', '03', '04', '05', '06', '07', '08'].map((d) => pd(`2026-11-${d}`))
    const r = runMaintenanceOn(snap(days), '2026-11-09', uid, 'x')
    expect(r.jar.reduce((a, j) => a + j.amount_cents, 0)).toBe(1500)
  })

  it('não lança multa a um dia com desculpa pendente', () => {
    const s0 = snap([pd('2026-11-12')])
    s0.excuses.push({ id: 'e', planned_day_id: 'd-2026-11-12', profile_id: 'a', date: '2026-11-12', type: 'sick', note: '', status: 'pending', decided_by: null, decided_at: null, auto: false, created_at: '' })
    expect(runMaintenanceOn(s0, '2026-11-16', uid, 'x').jar).toHaveLength(0)
  })

  it('o aviso de risco só mostra o que ainda se recupera esta semana', () => {
    const s1 = runMaintenanceOn(snap([pd('2026-11-12'), pd('2026-11-16')]), '2026-11-17', uid, 'x')
    const r = riskPreview({ profileId: 'a', monthKey: '2026-11', days: s1.plannedDays, sessions: [], excuses: [] }, s1.settings, '2026-11-17')
    expect(r.certain_cents).toBe(0)
    expect(r.recoverable_cents).toBe(250)
  })
})
