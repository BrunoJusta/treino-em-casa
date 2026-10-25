import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import { todayLisbon, monthKey, addDays, cmp } from '../lib/dates'
import { runMaintenanceOn } from '../lib/rules/maintenance'
import { demoPhoto } from '../lib/demoPhoto'
import type { DataApi } from './api'
import { buildDemoSnapshot } from './seed'
import type { BodyMetric, BodyProfile, Snapshot } from './types'

const KEY = 'tec-demo-v1'
const SESSION_KEY = 'tec-demo-session'
const CODES_KEY = 'tec-demo-codes'
const DEMO_CODE = '123456'

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))
const now = () => new Date().toISOString()

function safeGet(k: string): string | null {
  try { return localStorage.getItem(k) } catch { return null }
}
function safeSet(k: string, v: string) {
  try { localStorage.setItem(k, v) } catch { /* armazenamento indisponível: fica só em memória */ }
}

let memory: Snapshot | null = null
const listeners = new Set<() => void>()

function load(): Snapshot {
  if (memory) return memory
  const raw = safeGet(KEY)
  if (raw) {
    try { memory = JSON.parse(raw) as Snapshot; memory.walks ??= []; return memory } catch { /* seed novo */ }
  }
  const s = buildDemoSnapshot()
  // uma desculpa pendente para mostrar o fluxo de aprovação
  const today = todayLisbon()
  const target = s.plannedDays
    .filter((d) => d.profile_id === 'p-padrasto' && cmp(d.date, today) < 0 && monthKey(d.date) === monthKey(today) && !s.sessions.some((x) => x.profile_id === d.profile_id && x.date === d.date))
    .at(-1)
  if (target) s.excuses.push({ id: uid(), planned_day_id: target.id, profile_id: 'p-padrasto', date: target.date, type: 'injury', note: 'Dor nas costas, fiquei a descansar.', status: 'pending', decided_by: null, decided_at: null, auto: false, created_at: `${addDays(target.date, 0)}T20:00:00Z` })
  memory = s
  persist()
  return s
}

function persist() {
  if (memory) safeSet(KEY, JSON.stringify(memory))
}

function mutate(fn: (s: Snapshot) => void, audit?: { action: string; entity: string; entity_id?: string | null; detail: string }) {
  const s = load()
  fn(s)
  if (audit) s.audit.push({ id: uid(), actor_id: currentUser, action: audit.action, entity: audit.entity, entity_id: audit.entity_id ?? null, detail: audit.detail, created_at: now() })
  persist()
  listeners.forEach((l) => l())
}

let currentUser: string | null = safeGet(SESSION_KEY)

function codes(): Record<string, string> {
  try { return JSON.parse(safeGet(CODES_KEY) ?? '{}') } catch { return {} }
}

function me() {
  const p = load().profiles.find((x) => x.id === currentUser)
  if (!p) throw new Error('Sessão terminada. Entra outra vez.')
  return p
}
function requireAdmin() {
  if (me().role !== 'admin') throw new Error('Só um admin pode fazer isto.')
}

const bodyKey = (k: string) => `tec-demo-body-${currentUser}-${k}`

export const demoApi: DataApi = {
  mode: 'demo',
  async listLoginProfiles() {
    return load().profiles.filter((p) => p.active).map(({ id, username, display_name, avatar, color }) => ({ id, username, display_name, avatar, color }))
  },
  async signIn(username, code) {
    const p = load().profiles.find((x) => x.username === username && x.active)
    const expected = codes()[username] ?? DEMO_CODE
    if (!p || code !== expected) throw new Error('Código errado. Tenta outra vez.')
    currentUser = p.id
    safeSet(SESSION_KEY, p.id)
    return p.id
  },
  async signOut() {
    currentUser = null
    try { localStorage.removeItem(SESSION_KEY) } catch { /* nada */ }
  },
  async restore() {
    if (currentUser && load().profiles.some((p) => p.id === currentUser)) return currentUser
    return null
  },
  async loadSnapshot() {
    return structuredClone(load())
  },
  subscribe(cb) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },
  async photoUrl(path) {
    if (path.startsWith('demo:')) return demoPhoto(path)
    const blob = await idbGet<Blob>(`photo:${path}`)
    return blob ? URL.createObjectURL(blob) : demoPhoto('demo:0:0')
  },
  async addPlannedDays(profileId, days) {
    mutate((s) => {
      for (const d of days) {
        if (s.plannedDays.some((x) => x.profile_id === profileId && x.date === d.date)) continue
        s.plannedDays.push({ id: uid(), profile_id: profileId, date: d.date, plan_id: d.plan_id, status: 'planned', auto_filled: !!d.auto_filled, moved_from: null })
      }
    })
  },
  async removePlannedDay(id) {
    mutate((s) => { s.plannedDays = s.plannedDays.filter((d) => d.id !== id) })
  },
  async updatePlannedDay(id, patch) {
    mutate((s) => {
      const d = s.plannedDays.find((x) => x.id === id)
      if (d) Object.assign(d, patch)
    }, patch.date ? { action: 'day.move', entity: 'planned_day', entity_id: id, detail: `Dia mudado de ${patch.moved_from} para ${patch.date}` } : undefined)
  },
  async createSession(n) {
    const path = `${n.profile_id}/${uid()}.jpg`
    await idbSet(`photo:${path}`, n.photo)
    const { photo: _photo, ...rest } = n
    void _photo
    const s = { ...rest, id: uid(), photo_path: path, in_feed: true }
    mutate((snap) => {
      snap.sessions.push(s)
      const pd = snap.plannedDays.find((d) => d.id === n.planned_day_id)
      if (pd) pd.status = 'done'
    })
    return s
  },
  async hideSessionPhoto(id) {
    const s = load().sessions.find((x) => x.id === id)
    if (s?.photo_path && !s.photo_path.startsWith('demo:')) await idbDel(`photo:${s.photo_path}`)
    mutate((snap) => {
      const x = snap.sessions.find((y) => y.id === id)
      if (x) { x.in_feed = false; x.photo_path = null }
    })
  },
  async toggleReaction(sessionId, kind) {
    mutate((s) => {
      const ex = s.reactions.find((r) => r.session_id === sessionId && r.profile_id === currentUser && r.kind === kind)
      if (ex) s.reactions = s.reactions.filter((r) => r !== ex)
      else s.reactions.push({ id: uid(), session_id: sessionId, profile_id: currentUser!, kind, created_at: now() })
    })
  },
  async createWalk(w) {
    const m = me()
    if (cmp(w.date, todayLisbon()) > 0) throw new Error('A caminhada não pode ser no futuro.')
    mutate((s) => { s.walks.push({ ...w, id: uid(), profile_id: m.id, companions: w.companions.filter((c) => c !== m.id), created_at: now() }) })
  },
  async deleteWalk(id) {
    const m = me()
    mutate((s) => {
      const w = s.walks.find((x) => x.id === id)
      if (!w) return
      if (w.profile_id !== m.id && m.role !== 'admin') throw new Error('Só quem registou pode apagar.')
      s.walks = s.walks.filter((x) => x.id !== id)
    })
  },
  async deleteAllWalks() {
    requireAdmin()
    mutate((s) => { s.walks = [] }, { action: 'walks.reset', entity: 'walks', detail: 'Caminhadas apagadas' })
  },
  async createExcuse(plannedDayId, type, note) {
    const pd = load().plannedDays.find((d) => d.id === plannedDayId)
    if (!pd) return
    mutate((s) => {
      s.excuses.push({ id: uid(), planned_day_id: plannedDayId, profile_id: pd.profile_id, date: pd.date, type, note, status: 'pending', decided_by: null, decided_at: null, auto: false, created_at: now() })
    }, { action: 'excuse.create', entity: 'planned_day', entity_id: plannedDayId, detail: `Desculpa para ${pd.date}` })
  },
  async decideExcuse(id, approve) {
    requireAdmin()
    mutate((s) => {
      const e = s.excuses.find((x) => x.id === id)
      if (!e) return
      e.status = approve ? 'approved' : 'rejected'
      e.decided_by = currentUser
      e.decided_at = now()
      const pd = s.plannedDays.find((d) => d.id === e.planned_day_id)
      if (pd && approve) pd.status = 'excused'
    }, { action: approve ? 'excuse.approve' : 'excuse.reject', entity: 'excuse', entity_id: id, detail: approve ? 'Desculpa aprovada' : 'Desculpa rejeitada' })
  },
  async savePlan(plan) {
    mutate((s) => {
      const i = s.plans.findIndex((p) => p.id === plan.id)
      const p = { ...plan, updated_at: now() }
      if (i >= 0) s.plans[i] = p
      else s.plans.push(p)
    })
  },
  async deletePlan(id) {
    mutate((s) => {
      s.plans = s.plans.filter((p) => p.id !== id)
      for (const d of s.plannedDays) if (d.plan_id === id) d.plan_id = null
    })
  },
  async saveEquipment(e) {
    requireAdmin()
    mutate((s) => {
      const i = s.equipment.findIndex((x) => x.id === e.id)
      if (i >= 0) s.equipment[i] = e
      else s.equipment.push(e)
    }, { action: 'equipment.save', entity: 'equipment', entity_id: e.id, detail: e.name })
  },
  async deleteEquipment(id) {
    requireAdmin()
    mutate((s) => { s.equipment = s.equipment.filter((e) => e.id !== id) }, { action: 'equipment.delete', entity: 'equipment', entity_id: id, detail: 'Material apagado' })
  },
  async saveExerciseEdit(id, patch) {
    requireAdmin()
    mutate((s) => {
      const c = s.customExercises.find((e) => e.id === id)
      if (c) Object.assign(c, patch)
      else s.exerciseOverrides[id] = { ...(s.exerciseOverrides[id] ?? {}), ...patch }
    }, { action: 'exercise.edit', entity: 'exercise', entity_id: id, detail: Object.keys(patch).join(', ') })
  },
  async saveCustomExercise(e) {
    requireAdmin()
    mutate((s) => {
      const i = s.customExercises.findIndex((x) => x.id === e.id)
      if (i >= 0) s.customExercises[i] = e
      else s.customExercises.push(e)
    }, { action: 'exercise.create', entity: 'exercise', entity_id: e.id, detail: e.name_pt })
  },
  async updateSettings(patch) {
    requireAdmin()
    mutate((s) => { s.settings = { ...s.settings, ...patch } }, { action: 'settings.update', entity: 'settings', detail: Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(', ') })
  },
  async setJarEntryStatus(id, status, reason) {
    requireAdmin()
    mutate((s) => {
      const e = s.jar.find((x) => x.id === id)
      if (e) { e.status = status; if (reason) e.reason = `${e.reason} (anulada: ${reason})` }
    }, { action: `jar.${status}`, entity: 'jar_entry', entity_id: id, detail: reason ?? status })
  },
  async addJarEntry(e) {
    requireAdmin()
    mutate((s) => {
      s.jar.push({ id: uid(), profile_id: e.profile_id, kind: e.kind, amount_cents: e.amount_cents, reason: e.reason, related_days: [], status: 'paid', month_key: null, created_by: currentUser, created_at: now() })
    }, { action: `jar.${e.kind}`, entity: 'jar', detail: `${e.reason}: ${e.amount_cents / 100} €` })
  },
  async createMember(m) {
    requireAdmin()
    if (load().profiles.some((p) => p.username === m.username)) throw new Error('Esse nome de utilizador já existe.')
    const c = codes()
    c[m.username] = m.code
    safeSet(CODES_KEY, JSON.stringify(c))
    mutate((s) => {
      s.profiles.push({ id: uid(), username: m.username, display_name: m.display_name, avatar: m.avatar, color: m.color, role: m.role, min_days_week: m.min_days_week, active: true, restrictions: [], voice_enabled: true, created_at: now() })
    }, { action: 'profile.create', entity: 'profile', detail: m.display_name })
  },
  async updateProfile(id, patch) {
    if (id !== currentUser) requireAdmin()
    if (id === currentUser && me().role !== 'admin') {
      delete patch.role
      delete patch.min_days_week
      delete patch.active
    }
    mutate((s) => {
      const p = s.profiles.find((x) => x.id === id)
      if (p) Object.assign(p, patch)
    }, { action: 'profile.update', entity: 'profile', entity_id: id, detail: Object.keys(patch).join(', ') })
  },
  async uploadAvatar(profileId, photo) {
    if (profileId !== currentUser) requireAdmin()
    const url = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(photo) })
    mutate((s) => { const p = s.profiles.find((x) => x.id === profileId); if (p) p.avatar = url }, { action: 'profile.avatar', entity: 'profile', entity_id: profileId, detail: 'Foto de perfil nova' })
  },
  async resetCode(id, code) {
    requireAdmin()
    const p = load().profiles.find((x) => x.id === id)
    if (!p) return
    const c = codes()
    c[p.username] = code
    safeSet(CODES_KEY, JSON.stringify(c))
    mutate(() => {}, { action: 'profile.reset_code', entity: 'profile', entity_id: id, detail: 'Código novo gerado' })
  },
  async changeOwnCode(code) {
    const p = me()
    const c = codes()
    c[p.username] = code
    safeSet(CODES_KEY, JSON.stringify(c))
  },
  async getBody() {
    const profile: BodyProfile = JSON.parse(safeGet(bodyKey('profile')) ?? 'null') ?? { height_cm: null, goal_kg: null, weekly_reminder: false }
    let metrics: BodyMetric[] | null = JSON.parse(safeGet(bodyKey('metrics')) ?? 'null')
    if (!metrics) {
      // dados de exemplo só para o modo demo
      const t = todayLisbon()
      metrics = Array.from({ length: 10 }, (_, i) => ({ id: uid(), date: addDays(t, -7 * (9 - i)), weight_kg: Math.round((84.6 - i * 0.45 + (i % 3 === 1 ? 0.3 : 0)) * 10) / 10 }))
      safeSet(bodyKey('metrics'), JSON.stringify(metrics))
      safeSet(bodyKey('profile'), JSON.stringify({ height_cm: 178, goal_kg: 78, weekly_reminder: true }))
      return { profile: { height_cm: 178, goal_kg: 78, weekly_reminder: true }, metrics }
    }
    return { profile, metrics }
  },
  async saveBodyProfile(p) {
    safeSet(bodyKey('profile'), JSON.stringify(p))
  },
  async addBodyMetric(date, weight_kg) {
    const { metrics } = await this.getBody()
    const next = [...metrics.filter((m) => m.date !== date), { id: uid(), date, weight_kg }].sort((a, b) => cmp(a.date, b.date))
    safeSet(bodyKey('metrics'), JSON.stringify(next))
  },
  async deleteBodyMetric(id) {
    const { metrics } = await this.getBody()
    safeSet(bodyKey('metrics'), JSON.stringify(metrics.filter((m) => m.id !== id)))
  },
  async setRepeatWeekly(profileId, pattern, fill, months) {
    if (profileId !== currentUser) requireAdmin()
    mutate((s) => {
      const p = s.profiles.find((x) => x.id === profileId)
      if (p) p.repeat_weekly = pattern
      for (const f of fill) if (!s.plannedDays.some((d) => d.profile_id === profileId && d.date === f.date)) s.plannedDays.push({ id: uid(), profile_id: profileId, date: f.date, plan_id: f.plan_id, status: 'planned', auto_filled: true, moved_from: null })
      for (const m of months) s.audit.push({ id: uid(), actor_id: currentUser, action: 'month.repeat', entity: 'planned_days', entity_id: `repeat:${profileId}:${m}`, detail: `Repetição semanal: ${fill.length} dias marcados`, created_at: now() })
    }, { action: pattern ? 'repeat.on' : 'repeat.off', entity: 'profile', entity_id: profileId, detail: pattern ? 'Repetir todas as semanas ligado' : 'Repetir todas as semanas desligado' })
  },
  async resetActivity(includeBody) {
    requireAdmin()
    const s = load()
    for (const x of s.sessions) if (x.photo_path && !x.photo_path.startsWith('demo:')) await idbDel(`photo:${x.photo_path}`)
    mutate((snap) => {
      snap.sessions = []
      snap.walks = []
      snap.plannedDays = []
      snap.excuses = []
      snap.jar = []
      snap.reactions = []
      snap.closures = []
      snap.audit = []
      // depois de repor, o mês atual não volta a ser preenchido automaticamente
      const mk = monthKey(todayLisbon())
      for (const p of snap.profiles) snap.audit.push({ id: uid(), actor_id: currentUser, action: 'month.autofill', entity: 'planned_days', entity_id: `autofill:${p.id}:${mk}`, detail: 'Sem preenchimento automático depois de repor', created_at: now() })
    }, { action: 'reset.activity', entity: 'all', detail: includeBody ? 'Dados repostos (incluindo peso e IMC)' : 'Dados repostos' })
    if (includeBody) {
      try { Object.keys(localStorage).filter((k) => k.startsWith('tec-demo-body')).forEach((k) => localStorage.setItem(k, k.endsWith('metrics') ? '[]' : 'null')) } catch { /* nada */ }
    }
  },
  async runMaintenance(today) {
    const before = load()
    const after = runMaintenanceOn(before, today, uid, now())
    // limpeza das fotos com mais de 90 dias
    const limit = addDays(today, -90)
    for (const s of after.sessions) if (s.photo_path && cmp(s.date, limit) < 0) { s.photo_path = null; s.in_feed = false }
    if (JSON.stringify(after) !== JSON.stringify(before)) {
      memory = after
      persist()
      listeners.forEach((l) => l())
    }
  },
}

export function resetDemo() {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(CODES_KEY)
    Object.keys(localStorage).filter((k) => k.startsWith('tec-demo-body')).forEach((k) => localStorage.removeItem(k))
  } catch { /* nada */ }
  memory = null
}
