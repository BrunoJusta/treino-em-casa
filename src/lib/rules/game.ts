import { addDays, cmp, monthKey, weekStart, TZ } from '../dates'
import type { Excuse, MonthClosure, PlannedDay, Profile, Reaction, Session, Snapshot } from '../../data/types'

export const XP = {
  plannedDay: 50,
  extra: 30,
  guidedComplete: 20,
  weekComplete: 50,
  planOnTime: 30,
  reaction: 2,
  reactionDailyCap: 10,
  together: 10,
}

export const LEVELS = [
  { name: 'Caracol', min: 0 },
  { name: 'Aquecido', min: 300 },
  { name: 'Assíduo', min: 1200 },
  { name: 'Ferro', min: 3000 },
  { name: 'Aço', min: 6000 },
  { name: 'Lenda da Casa', min: 10000 },
]

export function levelFor(xp: number) {
  let idx = 0
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].min) idx = i
  const cur = LEVELS[idx]
  const next = LEVELS[idx + 1]
  const progress = next ? (xp - cur.min) / (next.min - cur.min) : 1
  return { index: idx, name: cur.name, next: next?.name ?? null, toNext: next ? next.min - xp : 0, progress, min: cur.min, nextMin: next?.min ?? cur.min }
}

/** Um treino por pessoa por dia conta para as contas (o primeiro do dia). */
export function countedSessions(sessions: Session[]): Session[] {
  const seen = new Set<string>()
  return [...sessions]
    .sort((a, b) => cmp(a.started_at, b.started_at))
    .filter((s) => {
      const k = `${s.profile_id}:${s.date}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
}

function weekFulfilled(profileId: string, ws: string, days: PlannedDay[], sessionDates: Set<string>, excuses: Excuse[]): boolean | null {
  const we = addDays(ws, 6)
  const inWeek = days.filter((d) => d.profile_id === profileId && cmp(d.date, ws) >= 0 && cmp(d.date, we) <= 0)
  if (!inWeek.length) return null
  return inWeek.every((d) => sessionDates.has(d.date) || d.status === 'done' || d.status === 'excused' || excuses.some((e) => e.planned_day_id === d.id && e.status === 'approved'))
}

export interface StreakInfo {
  weeks: number
  shield: boolean
  completedWeeks: string[]
}

/**
 * Streak de semanas cumpridas (não de dias). Ganha-se um escudo a cada 4 semanas seguidas (máximo 1);
 * o escudo salva automaticamente a próxima semana falhada.
 */
export function streakFor(profileId: string, today: string, snap: Pick<Snapshot, 'plannedDays' | 'sessions' | 'excuses'>): StreakInfo {
  const sessionDates = new Set(snap.sessions.filter((s) => s.profile_id === profileId).map((s) => s.date))
  const mine = snap.plannedDays.filter((d) => d.profile_id === profileId)
  if (!mine.length) return { weeks: 0, shield: false, completedWeeks: [] }
  const first = weekStart(mine.map((d) => d.date).sort()[0])
  const currentWs = weekStart(today)
  let weeks = 0
  let run = 0
  let shield = false
  const completedWeeks: string[] = []
  for (let ws = first; cmp(ws, currentWs) <= 0; ws = addDays(ws, 7)) {
    const ok = weekFulfilled(profileId, ws, mine, sessionDates, snap.excuses)
    if (ok === null) continue
    if (ws === currentWs && !ok) break // semana a decorrer, ainda não falhou
    if (ok) {
      weeks++
      run++
      completedWeeks.push(ws)
      if (run > 0 && run % 4 === 0) shield = true
    } else if (shield) {
      shield = false
      run = 0
    } else {
      weeks = 0
      run = 0
    }
  }
  return { weeks, shield, completedWeeks }
}

export function xpFor(profile: Profile, today: string, snap: Snapshot) {
  const mine = countedSessions(snap.sessions).filter((s) => s.profile_id === profile.id)
  const plannedDates = new Set(snap.plannedDays.filter((d) => d.profile_id === profile.id).map((d) => d.date))
  const byDate = new Map<string, string[]>()
  for (const s of countedSessions(snap.sessions)) {
    if (!byDate.has(s.date)) byDate.set(s.date, [])
    byDate.get(s.date)!.push(s.profile_id)
  }
  let xp = 0
  for (const s of mine) {
    xp += plannedDates.has(s.date) ? XP.plannedDay : XP.extra
    if (s.kind === 'guided' && s.completed_all) xp += XP.guidedComplete
    if ((byDate.get(s.date)?.length ?? 0) > 1) xp += XP.together
  }
  xp += streakFor(profile.id, today, snap).completedWeeks.length * XP.weekComplete
  // planear a tempo: meses com dias marcados e sem preenchimento automático
  const months = new Set(snap.plannedDays.filter((d) => d.profile_id === profile.id).map((d) => monthKey(d.date)))
  for (const m of months) {
    const ds = snap.plannedDays.filter((d) => d.profile_id === profile.id && monthKey(d.date) === m)
    if (ds.length && !ds.some((d) => d.auto_filled)) xp += XP.planOnTime
  }
  // aplausos dados, no máximo 10 XP por dia
  const perDay = new Map<string, number>()
  for (const r of snap.reactions.filter((r) => r.profile_id === profile.id)) {
    const d = r.created_at.slice(0, 10)
    perDay.set(d, Math.min(XP.reactionDailyCap, (perDay.get(d) ?? 0) + XP.reaction))
  }
  for (const v of perDay.values()) xp += v
  return xp
}

export interface RankRow {
  profile: Profile
  planned: number
  done: number
  consistency: number // 0..1
  extra: number
}

/** Ranking do mês: consistência (dias marcados cumpridos até hoje), desempate pelo número de treinos feitos. */
export function rankingFor(mk: string, today: string, snap: Snapshot): RankRow[] {
  const counted = countedSessions(snap.sessions)
  const rows = snap.profiles
    .filter((p) => p.active)
    .map((p) => {
      const days = snap.plannedDays.filter((d) => d.profile_id === p.id && monthKey(d.date) === mk && cmp(d.date, today) <= 0)
      const sessionDates = new Set(counted.filter((s) => s.profile_id === p.id).map((s) => s.date))
      const excusedIds = new Set(snap.excuses.filter((e) => e.status !== 'rejected').map((e) => e.planned_day_id))
      const relevant = days.filter((d) => !excusedIds.has(d.id) && d.status !== 'excused')
      // dias de hoje ainda sem treino não penalizam a percentagem
      const counting = relevant.filter((d) => d.date !== today || sessionDates.has(d.date))
      const done = counting.filter((d) => sessionDates.has(d.date)).length
      const totalDone = counted.filter((s) => s.profile_id === p.id && monthKey(s.date) === mk).length
      return { profile: p, planned: counting.length, done, consistency: counting.length ? done / counting.length : 0, extra: totalDone }
    })
  return rows.sort((a, b) => b.consistency - a.consistency || b.extra - a.extra || a.profile.display_name.localeCompare(b.profile.display_name))
}

export function familyGoalProgress(mk: string, snap: Snapshot) {
  const n = countedSessions(snap.sessions).filter((s) => monthKey(s.date) === mk).length
  return { done: n, target: snap.settings.family_goal_sessions, reward: snap.settings.family_goal_reward }
}

/* ---------- Badges ---------- */

export interface Badge {
  code: string
  name: string
  description: string
  icon: string // PixelIcon
  tier: 'bronze' | 'prata' | 'ouro' | 'especial'
  collective?: boolean
}

export const BADGES: Badge[] = [
  { code: 'first', name: 'Primeiro treino', description: 'Fizeste o teu primeiro treino lá em baixo.', icon: 'star', tier: 'bronze' },
  { code: 't10', name: '10 treinos', description: '10 treinos feitos.', icon: 'dumbbell', tier: 'bronze' },
  { code: 't25', name: '25 treinos', description: '25 treinos feitos.', icon: 'dumbbell', tier: 'prata' },
  { code: 't50', name: '50 treinos', description: '50 treinos feitos.', icon: 'dumbbell', tier: 'ouro' },
  { code: 't100', name: '100 treinos', description: '100 treinos. És da casa.', icon: 'crown', tier: 'especial' },
  { code: 'early', name: 'Madrugador', description: 'Treino antes das 8h.', icon: 'sun', tier: 'bronze' },
  { code: 'night', name: 'Noctívago', description: 'Treino depois das 21h.', icon: 'moon', tier: 'bronze' },
  { code: 'streak4', name: '4 semanas seguidas', description: 'Um mês de semanas cumpridas. Ganhaste um escudo.', icon: 'shield', tier: 'prata' },
  { code: 'streak12', name: '12 semanas seguidas', description: 'Três meses sem falhar uma semana.', icon: 'flame', tier: 'ouro' },
  { code: 'perfect', name: 'Mês perfeito', description: 'Todos os dias marcados do mês cumpridos.', icon: 'trophy', tier: 'ouro' },
  { code: 'together5', name: 'Treino a dois', description: '5 dias a treinar no mesmo dia que outra pessoa da família.', icon: 'heart', tier: 'prata' },
  { code: 'explorer', name: 'Explorador', description: 'Usaste todo o material da casa em treinos guiados.', icon: 'compass', tier: 'ouro' },
  { code: 'family', name: 'Família completa', description: 'Toda a gente treinou na mesma semana.', icon: 'house', tier: 'especial', collective: true },
  { code: 'emptyjar', name: 'Jarro vazio', description: 'Um mês inteiro sem ninguém pagar.', icon: 'jar', tier: 'especial', collective: true },
  { code: 'goal', name: 'Meta da família', description: 'A família cumpriu a meta do mês.', icon: 'flag', tier: 'especial', collective: true },
]

function hourOf(iso: string) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date(iso)))
}

export function badgesFor(profile: Profile, today: string, snap: Snapshot, exerciseEquip: Map<string, string[]>): { code: string; at: string }[] {
  const out: { code: string; at: string }[] = []
  const mine = countedSessions(snap.sessions).filter((s) => s.profile_id === profile.id).sort((a, b) => cmp(a.started_at, b.started_at))
  const n = (k: number) => mine[k - 1]?.ended_at
  if (mine.length >= 1) out.push({ code: 'first', at: n(1)! })
  for (const [k, c] of [[10, 't10'], [25, 't25'], [50, 't50'], [100, 't100']] as const) if (mine.length >= k) out.push({ code: c, at: n(k)! })
  const early = snap.sessions.find((s) => s.profile_id === profile.id && hourOf(s.started_at) < 8)
  if (early) out.push({ code: 'early', at: early.ended_at })
  const night = snap.sessions.find((s) => s.profile_id === profile.id && hourOf(s.started_at) >= 21)
  if (night) out.push({ code: 'night', at: night.ended_at })
  const st = streakFor(profile.id, today, snap)
  // contamos o maior run de semanas seguidas
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const w of st.completedWeeks) {
    run = prev && addDays(prev, 7) === w ? run + 1 : 1
    best = Math.max(best, run)
    prev = w
  }
  if (best >= 4) out.push({ code: 'streak4', at: today })
  if (best >= 12) out.push({ code: 'streak12', at: today })
  const perfect = snap.closures.find((c: MonthClosure) => c.profile_id === profile.id && c.misses === 0 && snap.plannedDays.filter((d) => d.profile_id === profile.id && monthKey(d.date) === c.month_key).length >= 4)
  if (perfect) out.push({ code: 'perfect', at: perfect.closed_at })
  const all = countedSessions(snap.sessions)
  const together = mine.filter((s) => all.some((o) => o.date === s.date && o.profile_id !== profile.id))
  if (together.length >= 5) out.push({ code: 'together5', at: together[4].ended_at })
  const okEquip = snap.equipment.filter((e) => e.status === 'ok').map((e) => e.id)
  const used = new Set<string>()
  for (const s of snap.sessions.filter((s) => s.profile_id === profile.id)) for (const set of s.sets) for (const e of exerciseEquip.get(set.exercise_id) ?? []) used.add(e)
  if (okEquip.length && okEquip.every((e) => used.has(e))) out.push({ code: 'explorer', at: today })
  for (const c of collectiveBadges(today, snap)) out.push(c)
  return out
}

export function collectiveBadges(today: string, snap: Snapshot): { code: string; at: string }[] {
  const out: { code: string; at: string }[] = []
  const active = snap.profiles.filter((p) => p.active)
  const counted = countedSessions(snap.sessions)
  const weeks = new Map<string, Set<string>>()
  for (const s of counted) {
    const w = weekStart(s.date)
    if (!weeks.has(w)) weeks.set(w, new Set())
    weeks.get(w)!.add(s.profile_id)
  }
  const fullWeek = [...weeks.entries()].sort().find(([, set]) => active.length > 1 && active.every((p) => set.has(p.id)))
  if (fullWeek) out.push({ code: 'family', at: fullWeek[0] })
  const closedMonths = new Set(snap.closures.map((c) => c.month_key))
  for (const m of [...closedMonths].sort()) {
    const allClosed = active.every((p) => snap.closures.some((c) => c.profile_id === p.id && c.month_key === m))
    if (allClosed && snap.closures.filter((c) => c.month_key === m).every((c) => c.penalties_cents === 0)) {
      out.push({ code: 'emptyjar', at: m })
      break
    }
  }
  const months = new Set(counted.map((s) => monthKey(s.date)))
  for (const m of [...months].sort()) {
    if (counted.filter((s) => monthKey(s.date) === m).length >= snap.settings.family_goal_sessions && cmp(m, monthKey(today)) <= 0) {
      out.push({ code: 'goal', at: m })
      break
    }
  }
  return out
}

export function totalMinutes(profileId: string, sessions: Session[]) {
  return sessions.filter((s) => s.profile_id === profileId).reduce((a, s) => a + s.minutes, 0)
}

export type { Reaction }
