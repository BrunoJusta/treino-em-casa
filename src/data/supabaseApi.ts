import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import { DEFAULT_SETTINGS, usernameToEmail, type DataApi, type NewSession } from './api'
import type { Exercise, Profile, Snapshot, Session, Walk } from './types'

const CACHE_KEY = 'tec-snapshot-cache'
const QUEUE_KEY = 'tec-offline-queue'

type QueuedSession = Omit<NewSession, 'photo'> & { id: string; photo: Blob }

export function createSupabaseApi(url: string, anon: string): DataApi {
  const sb: SupabaseClient = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'tec-auth' },
  })
  let uid: string | null = null
  const signedCache = new Map<string, { url: string; exp: number }>()

  const must = <T,>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(traduzErro(r.error.message))
    return r.data
  }

  async function uploadSession(q: QueuedSession): Promise<Session> {
    const path = `${q.profile_id}/${q.id}.jpg`
    const up = await sb.storage.from('photos').upload(path, q.photo, { contentType: 'image/jpeg', upsert: true })
    if (up.error && !/exists/i.test(up.error.message)) throw new Error(up.error.message)
    const { photo: _p, ...row } = q
    void _p
    const rec = { ...row, photo_path: path, in_feed: true }
    const res = await sb.from('sessions').upsert(rec).select().single()
    return must(res) as Session
  }

  async function flushQueue() {
    const queue = ((await idbGet<QueuedSession[]>(QUEUE_KEY)) ?? []).slice()
    if (!queue.length || !navigator.onLine) return
    const left: QueuedSession[] = []
    for (const q of queue) {
      try { await uploadSession(q) } catch { left.push(q) }
    }
    await idbSet(QUEUE_KEY, left)
  }
  if (typeof window !== 'undefined') window.addEventListener('online', () => { void flushQueue() })

  async function audit(action: string, entity: string, entity_id: string | null, detail: string) {
    await sb.from('audit_log').insert({ actor_id: uid, action, entity, entity_id, detail })
  }

  const api: DataApi = {
    mode: 'supabase',
    async listLoginProfiles() {
      return must(await sb.rpc('list_login_profiles')) ?? []
    },
    async signIn(username, code) {
      const r = await sb.auth.signInWithPassword({ email: usernameToEmail(username), password: code })
      if (r.error) throw new Error('Código errado. Tenta outra vez.')
      uid = r.data.user.id
      return uid
    },
    async signOut() {
      await sb.auth.signOut()
      uid = null
      try { localStorage.removeItem(CACHE_KEY) } catch { /* nada */ }
    },
    async restore() {
      const { data } = await sb.auth.getSession()
      uid = data.session?.user.id ?? null
      if (uid) void flushQueue()
      return uid
    },
    async bootstrapAdmin(m) {
      const r = await sb.functions.invoke('admin-users', { body: { action: 'bootstrap', ...m } })
      if (r.error) throw new Error(await fnError(r.error))
    },
    async loadSnapshot() {
      try {
        const [profiles, equipment, plans, plannedDays, sessions, excuses, jar, settings, reactions, closures, audit, edits, custom, priv, walks] = await Promise.all([
          sb.from('profiles').select('*').order('created_at'),
          sb.from('equipment').select('*').order('name'),
          sb.from('plans').select('*'),
          sb.from('planned_days').select('*'),
          sb.from('sessions').select('*').order('started_at'),
          sb.from('excuses').select('*'),
          sb.from('jar_entries').select('*').order('created_at'),
          sb.from('settings').select('*').eq('id', 1).maybeSingle(),
          sb.from('reactions').select('*'),
          sb.from('month_closures').select('*'),
          sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(300),
          sb.from('exercise_edits').select('*'),
          sb.from('custom_exercises').select('*'),
          sb.from('profile_private').select('*'),
          sb.from('walks').select('*').order('started_at'),
        ])
        const snap: Snapshot = {
          // restrições: só chegam as minhas (ou todas, se for admin)
          profiles: (must(profiles) ?? []).map((p: Profile) => ({ ...p, restrictions: (priv.data ?? []).find((x: { profile_id: string }) => x.profile_id === p.id)?.restrictions ?? [] })),
          equipment: must(equipment) ?? [],
          plans: must(plans) ?? [],
          plannedDays: must(plannedDays) ?? [],
          sessions: must(sessions) ?? [],
          excuses: must(excuses) ?? [],
          jar: must(jar) ?? [],
          settings: { ...DEFAULT_SETTINGS, ...(must(settings) ?? {}) },
          reactions: must(reactions) ?? [],
          closures: must(closures) ?? [],
          audit: (audit.data ?? []).reverse(),
          exerciseOverrides: Object.fromEntries((edits.data ?? []).map((e: { exercise_id: string; patch: Partial<Exercise> }) => [e.exercise_id, e.patch])),
          customExercises: (custom.data ?? []).map((c: { data: Exercise }) => c.data),
          // se a migração das caminhadas ainda não correu, a app continua a funcionar sem elas
          walks: (walks.data ?? []) as Walk[],
        }
        // treinos ainda na fila offline aparecem logo
        const queue = (await idbGet<QueuedSession[]>(QUEUE_KEY)) ?? []
        for (const q of queue) if (!snap.sessions.some((s) => s.id === q.id)) snap.sessions.push({ ...q, photo_path: `local:${q.id}`, in_feed: true } as Session)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(snap)) } catch { /* cheio */ }
        return snap
      } catch (e) {
        const cached = (() => { try { return localStorage.getItem(CACHE_KEY) } catch { return null } })()
        if (cached) return JSON.parse(cached) as Snapshot
        throw e
      }
    },
    subscribe(cb) {
      let t: ReturnType<typeof setTimeout> | null = null
      const debounced = () => {
        if (t) clearTimeout(t)
        t = setTimeout(cb, 300)
      }
      const ch = sb.channel('familia')
      for (const table of ['planned_days', 'sessions', 'excuses', 'jar_entries', 'reactions', 'plans', 'profiles', 'settings', 'month_closures', 'equipment', 'walks']) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table }, debounced)
      }
      ch.subscribe()
      return () => { void sb.removeChannel(ch) }
    },
    async photoUrl(path) {
      if (path.startsWith('local:')) {
        const q = ((await idbGet<QueuedSession[]>(QUEUE_KEY)) ?? []).find((x) => `local:${x.id}` === path)
        return q ? URL.createObjectURL(q.photo) : ''
      }
      const c = signedCache.get(path)
      if (c && c.exp > Date.now()) return c.url
      const r = await sb.storage.from('photos').createSignedUrl(path, 3600)
      if (r.error) return ''
      signedCache.set(path, { url: r.data.signedUrl, exp: Date.now() + 3500_000 })
      return r.data.signedUrl
    },
    async addPlannedDays(profileId, days) {
      if (!days.length) return
      must(await sb.from('planned_days').upsert(days.map((d) => ({ profile_id: profileId, date: d.date, plan_id: d.plan_id, auto_filled: !!d.auto_filled, status: 'planned' })), { onConflict: 'profile_id,date', ignoreDuplicates: true }))
    },
    async removePlannedDay(id) {
      must(await sb.from('planned_days').delete().eq('id', id))
    },
    async updatePlannedDay(id, patch) {
      must(await sb.from('planned_days').update(patch).eq('id', id))
    },
    async createSession(n) {
      const q: QueuedSession = { ...n, id: crypto.randomUUID() }
      try {
        if (!navigator.onLine) throw new Error('offline')
        return await uploadSession(q)
      } catch {
        const queue = (await idbGet<QueuedSession[]>(QUEUE_KEY)) ?? []
        await idbSet(QUEUE_KEY, [...queue, q])
        const { photo: _p, ...rest } = q
        void _p
        return { ...rest, photo_path: `local:${q.id}`, in_feed: true }
      }
    },
    async hideSessionPhoto(id) {
      const s = must(await sb.from('sessions').select('photo_path').eq('id', id).single()) as { photo_path: string | null }
      if (s.photo_path) await sb.storage.from('photos').remove([s.photo_path])
      must(await sb.from('sessions').update({ in_feed: false, photo_path: null }).eq('id', id))
    },
    async toggleReaction(sessionId, kind) {
      const ex = must(await sb.from('reactions').select('id').eq('session_id', sessionId).eq('profile_id', uid).eq('kind', kind)) as { id: string }[]
      if (ex.length) must(await sb.from('reactions').delete().eq('id', ex[0].id))
      else must(await sb.from('reactions').insert({ session_id: sessionId, profile_id: uid, kind }))
    },
    async createWalk(w) {
      if (!uid) throw new Error('Sessão terminada. Entra outra vez.')
      const id = crypto.randomUUID()
      const { photo, ...rest } = w
      let photo_path: string | null = null
      if (photo) {
        photo_path = `${uid}/walk-${id}.jpg`
        const up = await sb.storage.from('photos').upload(photo_path, photo.blob, { contentType: 'image/jpeg', upsert: true })
        if (up.error) throw new Error(up.error.message)
      }
      const res = await sb.from('walks').insert({ ...rest, id, profile_id: uid, companions: w.companions.filter((c) => c !== uid), photo_path, photo_taken_at: photo ? photo.at : null })
      if (res.error) {
        // se a caminhada não ficou guardada, a foto não fica perdida no Storage
        if (photo_path) await sb.storage.from('photos').remove([photo_path])
        throw new Error(res.error.message)
      }
    },
    async hideWalkPhoto(id) {
      const w = must(await sb.from('walks').select('photo_path').eq('id', id).maybeSingle()) as { photo_path: string | null } | null
      if (!w?.photo_path) return
      await sb.storage.from('photos').remove([w.photo_path])
      must(await sb.from('walks').update({ photo_path: null }).eq('id', id))
    },
    async deleteWalk(id) {
      const w = must(await sb.from('walks').select('photo_path').eq('id', id).maybeSingle()) as { photo_path: string | null } | null
      if (w?.photo_path) await sb.storage.from('photos').remove([w.photo_path])
      must(await sb.from('walks').delete().eq('id', id))
    },
    async deleteAllWalks() {
      // a regra de acesso só deixa o admin apagar as caminhadas dos outros
      const rows = (must(await sb.from('walks').select('photo_path').not('photo_path', 'is', null)) ?? []) as { photo_path: string }[]
      const paths = rows.map((r) => r.photo_path)
      for (let i = 0; i < paths.length; i += 100) await sb.storage.from('photos').remove(paths.slice(i, i + 100))
      must(await sb.from('walks').delete().not('id', 'is', null))
      await audit('walks.reset', 'walks', null, 'Caminhadas apagadas')
    },
    async createExcuse(plannedDayId, type, note) {
      must(await sb.rpc('create_excuse', { p_planned_day: plannedDayId, p_type: type, p_note: note }))
    },
    async decideExcuse(id, approve) {
      must(await sb.rpc('decide_excuse', { p_id: id, p_approve: approve }))
    },
    async savePlan(plan) {
      must(await sb.from('plans').upsert({ ...plan, updated_at: new Date().toISOString() }))
    },
    async deletePlan(id) {
      must(await sb.from('plans').delete().eq('id', id))
    },
    async saveEquipment(e) {
      must(await sb.from('equipment').upsert(e))
      await audit('equipment.save', 'equipment', e.id, e.name)
    },
    async deleteEquipment(id) {
      must(await sb.from('equipment').delete().eq('id', id))
      await audit('equipment.delete', 'equipment', id, 'Material apagado')
    },
    async saveExerciseEdit(id, patch) {
      const cur = must(await sb.from('custom_exercises').select('data').eq('id', id).maybeSingle()) as { data: Exercise } | null
      if (cur) must(await sb.from('custom_exercises').update({ data: { ...cur.data, ...patch } }).eq('id', id))
      else {
        const prev = must(await sb.from('exercise_edits').select('patch').eq('exercise_id', id).maybeSingle()) as { patch: object } | null
        must(await sb.from('exercise_edits').upsert({ exercise_id: id, patch: { ...(prev?.patch ?? {}), ...patch } }))
      }
      await audit('exercise.edit', 'exercise', id, Object.keys(patch).join(', '))
    },
    async saveCustomExercise(e) {
      must(await sb.from('custom_exercises').upsert({ id: e.id, data: e }))
      await audit('exercise.create', 'exercise', e.id, e.name_pt)
    },
    async updateSettings(patch) {
      must(await sb.from('settings').update(patch).eq('id', 1))
      await audit('settings.update', 'settings', null, Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(', '))
    },
    async setJarEntryStatus(id, status, reason) {
      must(await sb.rpc('set_jar_status', { p_id: id, p_status: status, p_reason: reason ?? null }))
    },
    async addJarEntry(e) {
      must(await sb.from('jar_entries').insert({ ...e, status: 'paid', created_by: uid }))
      await audit(`jar.${e.kind}`, 'jar', null, `${e.reason}: ${e.amount_cents / 100} €`)
    },
    async createMember(m) {
      const r = await sb.functions.invoke('admin-users', { body: { action: 'create', ...m } })
      if (r.error) throw new Error(await fnError(r.error))
    },
    async updateProfile(id, patch) {
      const { restrictions, ...rest } = patch
      if (restrictions) must(await sb.from('profile_private').upsert({ profile_id: id, restrictions }))
      if (Object.keys(rest).length) must(await sb.from('profiles').update(rest).eq('id', id))
      if (id !== uid) await audit('profile.update', 'profile', id, Object.keys(patch).join(', '))
    },
    async resetCode(id, code) {
      const r = await sb.functions.invoke('admin-users', { body: { action: 'reset', id, code } })
      if (r.error) throw new Error(await fnError(r.error))
    },
    async uploadAvatar(profileId, photo) {
      const path = `${profileId}.jpg`
      const up = await sb.storage.from('avatars').upload(path, photo, { contentType: 'image/jpeg', upsert: true })
      if (up.error) throw new Error(traduzErro(up.error.message))
      const url = `${sb.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
      must(await sb.from('profiles').update({ avatar: url }).eq('id', profileId))
    },
    async changeOwnCode(code) {
      const r = await sb.auth.updateUser({ password: code })
      if (r.error) throw new Error(traduzErro(r.error.message))
    },
    async getBody() {
      const [p, m] = await Promise.all([
        sb.from('body_profiles').select('*').eq('profile_id', uid).maybeSingle(),
        sb.from('body_metrics').select('id,date,weight_kg').eq('profile_id', uid).order('date'),
      ])
      return { profile: (p.data as never) ?? { height_cm: null, goal_kg: null, weekly_reminder: false }, metrics: (m.data as never) ?? [] }
    },
    async saveBodyProfile(p) {
      must(await sb.from('body_profiles').upsert({ profile_id: uid, ...p }))
    },
    async addBodyMetric(date, weight_kg) {
      must(await sb.from('body_metrics').upsert({ profile_id: uid, date, weight_kg }, { onConflict: 'profile_id,date' }))
    },
    async deleteBodyMetric(id) {
      must(await sb.from('body_metrics').delete().eq('id', id))
    },
    async setRepeatWeekly(profileId, pattern, fill, months) {
      must(await sb.from('profiles').update({ repeat_weekly: pattern }).eq('id', profileId))
      if (fill.length) must(await sb.from('planned_days').upsert(fill.map((f) => ({ profile_id: profileId, date: f.date, plan_id: f.plan_id, auto_filled: true, status: 'planned' })), { onConflict: 'profile_id,date', ignoreDuplicates: true }))
      if (months.length) must(await sb.from('audit_log').insert(months.map((m) => ({ actor_id: uid, action: 'month.repeat', entity: 'planned_days', entity_id: `repeat:${profileId}:${m}`, detail: `Repetição semanal: ${fill.length} dias marcados` }))))
    },
    async resetActivity(includeBody) {
      // primeiro as fotos (o Storage só se apaga pela API), depois as tabelas
      const people = (must(await sb.from('profiles').select('id')) ?? []) as { id: string }[]
      for (const p of people) {
        const files = await sb.storage.from('photos').list(p.id, { limit: 1000 })
        const paths = (files.data ?? []).map((f) => `${p.id}/${f.name}`)
        if (paths.length) await sb.storage.from('photos').remove(paths)
      }
      must(await sb.rpc('reset_activity', { p_include_body: includeBody }))
      await idbSet(QUEUE_KEY, [])
      try { localStorage.removeItem(CACHE_KEY) } catch { /* nada */ }
    },
    async runMaintenance() {
      // No Supabase a manutenção corre no servidor (pg_cron, de hora a hora).
      // Aqui só o admin apaga as fotos com mais de 90 dias, porque o Storage só se apaga pela API.
      const me = must(await sb.from('profiles').select('role').eq('id', uid).maybeSingle()) as { role: string } | null
      if (me?.role !== 'admin') return
      const old = must(await sb.rpc('photos_to_cleanup')) as { id: string; photo_path: string }[]
      if (old?.length) {
        await sb.storage.from('photos').remove(old.map((o) => o.photo_path))
        must(await sb.rpc('mark_photos_cleaned', { p_ids: old.map((o) => o.id) }))
      }
      // fotos das caminhadas (se a migração 0012 ainda não correu, esta parte é ignorada)
      const oldWalks = await sb.rpc('walk_photos_to_cleanup')
      const ow = (oldWalks.data ?? []) as { id: string; photo_path: string }[]
      if (!oldWalks.error && ow.length) {
        await sb.storage.from('photos').remove(ow.map((o) => o.photo_path))
        must(await sb.rpc('mark_walk_photos_cleaned', { p_ids: ow.map((o) => o.id) }))
      }
    },
  }
  return api
}

async function fnError(e: unknown): Promise<string> {
  const ctx = (e as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    try { const j = await ctx.json(); if (j?.error) return j.error } catch { /* nada */ }
  }
  return (e as Error).message ?? 'Erro inesperado'
}

function traduzErro(msg: string): string {
  if (/row-level security|permission denied/i.test(msg)) return 'Não tens permissão para fazer isto.'
  if (/duplicate key/i.test(msg)) return 'Isso já existe.'
  if (/Password should be at least/i.test(msg)) return 'O código tem de ter 6 dígitos.'
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Sem ligação. Tenta outra vez daqui a pouco.'
  return msg
}
