import type {
  BodyMetric, BodyProfile, Equipment, Exercise, ExcuseType, JarEntry, JarSettings, LoginProfile, PlannedDay,
  Profile, Reaction, Session, Snapshot, WorkoutPlan,
} from './types'

export interface NewSession {
  profile_id: string
  date: string
  started_at: string
  ended_at: string
  plan_id: string | null
  kind: 'quick' | 'guided'
  completed_all: boolean
  minutes: number
  planned_day_id: string | null
  sets: Session['sets']
  notes: string
  photo: Blob
  photo_taken_at: string
}

export interface NewMember {
  username: string
  display_name: string
  code: string
  avatar: string
  color: string
  role: 'admin' | 'member'
  min_days_week: number
}

export interface DataApi {
  mode: 'demo' | 'supabase'
  // sessão
  listLoginProfiles(): Promise<LoginProfile[]>
  signIn(username: string, code: string): Promise<string>
  signOut(): Promise<void>
  restore(): Promise<string | null>
  bootstrapAdmin?(m: NewMember): Promise<void>
  // leitura
  loadSnapshot(): Promise<Snapshot>
  subscribe(cb: () => void): () => void
  photoUrl(path: string): Promise<string>
  // planeamento
  addPlannedDays(profileId: string, days: { date: string; plan_id: string | null; auto_filled?: boolean }[]): Promise<void>
  removePlannedDay(id: string): Promise<void>
  updatePlannedDay(id: string, patch: Partial<Pick<PlannedDay, 'date' | 'plan_id' | 'moved_from'>>): Promise<void>
  // treinos
  createSession(s: NewSession): Promise<Session>
  hideSessionPhoto(sessionId: string): Promise<void>
  toggleReaction(sessionId: string, kind: Reaction['kind']): Promise<void>
  // desculpas
  createExcuse(plannedDayId: string, type: ExcuseType, note: string): Promise<void>
  decideExcuse(id: string, approve: boolean): Promise<void>
  // planos
  savePlan(plan: WorkoutPlan): Promise<void>
  deletePlan(id: string): Promise<void>
  // admin
  saveEquipment(e: Equipment): Promise<void>
  deleteEquipment(id: string): Promise<void>
  saveExerciseEdit(id: string, patch: Partial<Exercise>): Promise<void>
  saveCustomExercise(e: Exercise): Promise<void>
  updateSettings(patch: Partial<JarSettings>): Promise<void>
  setJarEntryStatus(id: string, status: JarEntry['status'], reason?: string): Promise<void>
  addJarEntry(e: Pick<JarEntry, 'kind' | 'amount_cents' | 'reason' | 'profile_id'>): Promise<void>
  createMember(m: NewMember): Promise<void>
  updateProfile(id: string, patch: Partial<Profile>): Promise<void>
  resetCode(id: string, code: string): Promise<void>
  uploadAvatar(profileId: string, photo: Blob): Promise<void>
  changeOwnCode(code: string): Promise<void>
  // corpo (privado)
  getBody(): Promise<{ profile: BodyProfile; metrics: BodyMetric[] }>
  saveBodyProfile(p: BodyProfile): Promise<void>
  addBodyMetric(date: string, weight_kg: number): Promise<void>
  deleteBodyMetric(id: string): Promise<void>
  // repetir todas as semanas: guarda o padrão, marca os dias e anota os meses já preenchidos
  setRepeatWeekly(profileId: string, pattern: { wd: number; plan_id: string | null }[] | null, fill: { date: string; plan_id: string | null }[], months: string[]): Promise<void>
  // backoffice: apaga a atividade de todos (treinos, fotos, dias, jarro, registo)
  resetActivity(includeBody: boolean): Promise<void>
  // manutenção (no Supabase corre no servidor com pg_cron; no demo corre ao abrir)
  runMaintenance(today: string): Promise<void>
}

export const DEFAULT_SETTINGS: JarSettings = {
  penalty_cents: 500,
  consecutive_misses: 2,
  monthly_cap_cents: 1500,
  plan_window_end_day: 5,
  excuse_auto_day: 5,
  goal_name: 'Jantar de Natal',
  goal_cents: 10000,
  family_goal_sessions: 40,
  family_goal_reward: 'Escolher o restaurante do jantar pago pelo jarro',
}

export const usernameToEmail = (u: string) => `${u.trim().toLowerCase()}@treinoemcasa.local`
