import { useMemo } from 'react'
import { cmp, monthKey, monthName } from '../lib/dates'
import { riskPreview, jarTotals } from '../lib/rules/jar'
import { familyGoalProgress, levelFor, streakFor, xpFor, countedSessions } from '../lib/rules/game'
import { useApp } from './store'
import type { JarEntry, PlannedDay, Profile, Session, Snapshot } from './types'

export function usePerson(profile: Profile | null) {
  const { snap, today, stateOf } = useApp()
  return useMemo(() => {
    if (!profile) return null
    const mk = monthKey(today)
    const days = snap.plannedDays.filter((d) => d.profile_id === profile.id).sort((a, b) => cmp(a.date, b.date))
    const monthDays = days.filter((d) => monthKey(d.date) === mk)
    const todayDay = days.find((d) => d.date === today) ?? null
    const todaySession = snap.sessions.find((s) => s.profile_id === profile.id && s.date === today) ?? null
    const recover = monthDays.filter((d) => stateOf(d) === 'recover')
    const xp = xpFor(profile, today, snap)
    const level = levelFor(xp)
    const streak = streakFor(profile.id, today, snap)
    const risk = riskPreview({ profileId: profile.id, monthKey: mk, days: snap.plannedDays, sessions: snap.sessions, excuses: snap.excuses }, snap.settings, today)
    const sessions = countedSessions(snap.sessions).filter((s) => s.profile_id === profile.id)
    const monthDone = monthDays.filter((d) => stateOf(d) === 'done').length
    return { days, monthDays, todayDay, todaySession, recover, xp, level, streak, risk, sessions, monthDone }
  }, [profile, snap, today, stateOf])
}

export function useFamily() {
  const { snap, today } = useApp()
  return useMemo(() => {
    const mk = monthKey(today)
    return { goal: familyGoalProgress(mk, snap), jar: jarTotals(snap.jar), mk }
  }, [snap, today])
}

export interface FeedItem {
  id: string
  at: string
  kind: 'session' | 'penalty' | 'spend' | 'excuse' | 'close' | 'paid'
  profile: Profile | null
  session?: Session
  text: string
  sub?: string
}

export function buildFeed(snap: Snapshot): FeedItem[] {
  const byId = new Map(snap.profiles.map((p) => [p.id, p]))
  const items: FeedItem[] = []
  for (const s of snap.sessions) {
    const plan = snap.plans.find((p) => p.id === s.plan_id)
    items.push({ id: `s-${s.id}`, at: s.ended_at, kind: 'session', profile: byId.get(s.profile_id) ?? null, session: s, text: plan ? `fez ${plan.name}` : 'treinou', sub: `${s.minutes} min` })
  }
  // multas agrupadas por pessoa e fecho de mês, para o feed não ficar cheio de moedas
  const groups = new Map<string, JarEntry[]>()
  for (const j of snap.jar) {
    if (j.status === 'void') continue
    if (j.kind === 'penalty') {
      const k = `${j.profile_id}:${j.month_key ?? j.created_at.slice(0, 7)}`
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(j)
    }
    if (j.kind === 'spend') items.push({ id: `j-${j.id}`, at: j.created_at, kind: 'spend', profile: null, text: `O jarro pagou: ${j.reason}`, sub: `${j.amount_cents / 100} €` })
  }
  for (const [k, list] of groups) {
    const total = list.reduce((a, j) => a + j.amount_cents, 0)
    const mk = k.split(':')[1]
    const p = list[0].profile_id ? byId.get(list[0].profile_id) ?? null : null
    items.push({ id: `j-${k}`, at: list[0].created_at, kind: 'penalty', profile: p, text: `meteu ${total / 100} € no jarro`, sub: `Fecho de ${monthName(mk)}: ${list.length} ${list.length === 1 ? 'multa' : 'multas'} por falhas seguidas` })
  }
  for (const e of snap.excuses) {
    if (e.status === 'pending') continue
    const label = { sick: 'Doente', injury: 'Lesão', travel: 'Viagem', other: 'Outro' }[e.type]
    items.push({ id: `e-${e.id}`, at: e.decided_at ?? e.created_at, kind: 'excuse', profile: byId.get(e.profile_id) ?? null, text: e.status === 'approved' ? `teve uma desculpa aceite (${label})` : `teve uma desculpa recusada (${label})`, sub: e.auto ? 'Aceite automaticamente no prazo' : e.note })
  }
  return items.sort((a, b) => cmp(b.at, a.at))
}

export function plannedFor(snap: Snapshot, profileId: string, date: string): PlannedDay | undefined {
  return snap.plannedDays.find((d) => d.profile_id === profileId && d.date === date)
}
