// Tipos partilhados entre o modo demo e o Supabase.
// Datas de calendário são sempre strings 'YYYY-MM-DD' no fuso Europe/Lisbon.

export type Role = 'admin' | 'member'

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar: string // id de um avatar pixel (ver components/Avatar)
  color: string
  role: Role
  min_days_week: number
  active: boolean
  restrictions: string[]
  voice_enabled: boolean
  // Repetir todas as semanas: dias da semana (0 = segunda) e o treino de cada um. null = não repete.
  repeat_weekly?: { wd: number; plan_id: string | null }[] | null
  created_at: string
}

export type EquipmentCategory = 'cardio' | 'machine' | 'free_weight' | 'accessory'
export type EquipmentStatus = 'ok' | 'broken' | 'arriving'

export interface Equipment {
  id: string
  name: string
  category: EquipmentCategory
  icon: string // id de PixelIcon
  details: string
  location: string
  status: EquipmentStatus
  max_load_kg: number | null
  notes: string
  photo_url: string | null
}

export type Pattern = 'empurrar' | 'puxar' | 'pernas' | 'anca' | 'core' | 'cardio' | 'mobilidade'

export interface Exercise {
  id: string
  name_pt: string
  name_en: string | null
  instructions_pt: string[]
  primary_muscles: string[]
  secondary_muscles: string[]
  pattern: Pattern
  level: 'beginner' | 'intermediate' | 'expert'
  category: string
  force: string | null
  mechanic: string | null
  equipment_ids: string[]
  source: 'free-exercise-db' | 'custom'
  reviewed: boolean
  hidden: boolean
}

export interface PlanItem {
  id: string
  exercise_id: string
  sets: number
  reps: number | null
  duration_s: number | null
  rest_s: number
  target_load_kg: number | null
  notes: string
}

export interface WorkoutPlan {
  id: string
  owner_id: string | null // null = plano da família
  name: string
  description: string
  color: string
  icon: string
  items: PlanItem[]
  updated_at: string
}

export type PlannedStatus = 'planned' | 'done' | 'missed' | 'excused'

export interface PlannedDay {
  id: string
  profile_id: string
  date: string
  plan_id: string | null
  status: PlannedStatus
  auto_filled: boolean
  moved_from: string | null
}

export interface SessionSet {
  exercise_id: string
  set_no: number
  reps: number | null
  load_kg: number | null
  duration_s: number | null
  done: boolean
}

export interface Session {
  id: string
  profile_id: string
  date: string
  started_at: string
  ended_at: string
  plan_id: string | null
  kind: 'quick' | 'guided'
  completed_all: boolean
  minutes: number
  photo_path: string | null // null = foto apagada (pela pessoa ou pela limpeza dos 90 dias)
  photo_taken_at: string
  in_feed: boolean
  planned_day_id: string | null
  sets: SessionSet[]
  notes: string
}

export type ExcuseType = 'sick' | 'injury' | 'travel' | 'other'
export type ExcuseStatus = 'pending' | 'approved' | 'rejected'

export interface Excuse {
  id: string
  planned_day_id: string
  profile_id: string
  date: string
  type: ExcuseType
  note: string
  status: ExcuseStatus
  decided_by: string | null
  decided_at: string | null
  auto: boolean
  created_at: string
}

export type JarKind = 'penalty' | 'payment' | 'spend' | 'adjust'

export interface JarEntry {
  id: string
  profile_id: string | null
  kind: JarKind
  amount_cents: number
  reason: string
  related_days: string[]
  status: 'unpaid' | 'paid' | 'void'
  month_key: string | null // 'YYYY-MM' nas multas
  created_by: string | null
  created_at: string
}

export interface JarSettings {
  penalty_cents: number
  consecutive_misses: number
  monthly_cap_cents: number
  plan_window_end_day: number // 5
  excuse_auto_day: number // 5
  goal_name: string
  goal_cents: number
  family_goal_sessions: number
  family_goal_reward: string
}

// Caminhadas: complemento ao treino. Não dão XP nem contam como dia marcado,
// mas aparecem no feed e desbloqueiam conquistas próprias.
export interface Walk {
  id: string
  profile_id: string // quem registou
  companions: string[] // outras pessoas da família que foram também
  date: string
  started_at: string
  ended_at: string
  duration_s: number
  distance_m: number | null // null = sem distância (registo manual sem km)
  route: [number, number][] | null // [lat, lng], simplificado
  source: 'manual' | 'live'
  notes: string
  created_at: string
}

export interface Reaction {
  id: string
  session_id: string
  profile_id: string
  kind: 'palmas' | 'fogo' | 'musculo'
  created_at: string
}

export interface MonthClosure {
  profile_id: string
  month_key: string
  closed_at: string
  misses: number
  penalties_cents: number
}

export interface AuditEntry {
  id: string
  actor_id: string | null
  action: string
  entity: string
  entity_id: string | null
  detail: string
  created_at: string
}

export interface BodyMetric {
  id: string
  date: string
  weight_kg: number
}

export interface BodyProfile {
  height_cm: number | null
  goal_kg: number | null
  weekly_reminder: boolean
}

// Tudo o que a família vê. Os dados de corpo (peso, IMC) ficam FORA deste snapshot.
export interface Snapshot {
  profiles: Profile[]
  equipment: Equipment[]
  plans: WorkoutPlan[]
  plannedDays: PlannedDay[]
  sessions: Session[]
  excuses: Excuse[]
  jar: JarEntry[]
  settings: JarSettings
  reactions: Reaction[]
  closures: MonthClosure[]
  audit: AuditEntry[]
  exerciseOverrides: Record<string, Partial<Exercise>>
  customExercises: Exercise[]
  walks: Walk[]
}

export interface LoginProfile {
  id: string
  username: string
  display_name: string
  avatar: string
  color: string
}
