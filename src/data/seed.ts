import { addDays, cmp, monthDays, monthKey, prevMonth, todayLisbon, weekday } from '../lib/dates'
import { DEFAULT_SETTINGS } from './api'
import type { Equipment, PlannedDay, Profile, Session, Snapshot, WorkoutPlan } from './types'

export const PERSON_COLORS = ['#39C2EF', '#EA76CB', '#FE8019', '#40A02B', '#8839EF', '#DF8E1D', '#E64553', '#179299']
export const COLOR_NAMES: Record<string, string> = { '#39C2EF': 'Azul', '#EA76CB': 'Rosa', '#FE8019': 'Laranja', '#40A02B': 'Verde', '#8839EF': 'Roxo', '#DF8E1D': 'Âmbar', '#E64553': 'Vermelho', '#179299': 'Verde-água' }

export const SEED_EQUIPMENT: Equipment[] = [
  { id: 'multiestacao', name: 'Multiestação', category: 'machine', icon: 'station', details: 'Puxada, butterfly, pullover, cabo de cima (tríceps, abdominal e remada), extensão de pernas, flexão de pernas em pé, adutor e banco abdominal.', location: 'Lá em baixo', status: 'ok', max_load_kg: null, notes: 'O cabo de baixo está avariado.', photo_url: null },
  { id: 'bicicleta', name: 'Bicicleta estática', category: 'cardio', icon: 'bike', details: 'Domyos Essential.', location: 'Lá em baixo', status: 'ok', max_load_kg: null, notes: '', photo_url: null },
  { id: 'passadeira', name: 'Passadeira', category: 'cardio', icon: 'treadmill', details: 'Domyos.', location: 'Lá em baixo', status: 'ok', max_load_kg: null, notes: '', photo_url: null },
  { id: 'halteres-ajustaveis', name: 'Halteres ajustáveis', category: 'free_weight', icon: 'dumbbell', details: 'Discos em plástico, com barra de ligação para fazer uma barra curta.', location: 'Lá em baixo', status: 'ok', max_load_kg: null, notes: '', photo_url: null },
  { id: 'halteres-3kg', name: 'Halteres de 3 kg', category: 'free_weight', icon: 'dumbbell', details: 'Par em vinil (Bodytone).', location: 'Lá em baixo', status: 'ok', max_load_kg: 3, notes: '', photo_url: null },
  { id: 'caneleiras', name: 'Caneleiras', category: 'accessory', icon: 'weight', details: 'Par de caneleiras / pulseiras de peso.', location: 'Lá em baixo', status: 'ok', max_load_kg: null, notes: '', photo_url: null },
  { id: 'remo', name: 'Máquina de remo', category: 'cardio', icon: 'row', details: 'Domyos Initial Rower 100. Magnética, 10 níveis, Bluetooth (FTMS). Arruma-se na vertical.', location: 'Lá em baixo', status: 'arriving', max_load_kg: 110, notes: 'Até 110 kg de utilizador.', photo_url: null },
  { id: 'banco', name: 'Banco de musculação', category: 'accessory', icon: 'bench', details: 'Zipro Core. Plano, dobrável, suportes de barra em 7 alturas (70 a 105 cm) e paralelas para dips. Sem braços de segurança.', location: 'Lá em baixo', status: 'arriving', max_load_kg: 120, notes: 'Até 120 kg de utilizador e 180 kg nos suportes.', photo_url: null },
  { id: 'kit-50kg', name: 'Kit de 50 kg em ferro', category: 'free_weight', icon: 'barbell', details: 'Domyos. Barra de 155 cm, 2 halteres de 35 cm, cerca de 38 kg em discos, 3 pares de molas.', location: 'Lá em baixo', status: 'arriving', max_load_kg: 50, notes: '', photo_url: null },
]

const item = (id: string, exercise_id: string, sets: number, reps: number | null, rest_s: number, duration_s: number | null = null, target_load_kg: number | null = null) => ({ id, exercise_id, sets, reps, duration_s, rest_s, target_load_kg, notes: '' })

export const SEED_PLANS: WorkoutPlan[] = [
  {
    id: 'plan-forca-a', owner_id: null, name: 'Força A', description: 'Corpo inteiro, com empurrar e puxar.', color: '#39C2EF', icon: 'dumbbell', updated_at: '2026-09-01T10:00:00Z',
    items: [
      item('a1', 'Dumbbell_Bench_Press', 3, 10, 75, null, 8),
      item('a2', 'custom_puxada_multiestacao', 3, 10, 75, null, 25),
      item('a3', 'custom_agachamento_goblet', 3, 12, 75, null, 10),
      item('a4', 'One-Arm_Dumbbell_Row', 3, 10, 60, null, 10),
      item('a5', 'Plank', 3, null, 45, 30),
    ],
  },
  {
    id: 'plan-forca-b', owner_id: null, name: 'Força B', description: 'Ombros, costas e pernas na multiestação.', color: '#8839EF', icon: 'station', updated_at: '2026-09-01T10:00:00Z',
    items: [
      item('b1', 'Seated_Dumbbell_Press', 3, 10, 75, null, 6),
      item('b2', 'custom_pullover_multiestacao', 3, 12, 60, null, 15),
      item('b3', 'Leg_Extensions', 3, 12, 60, null, 20),
      item('b4', 'Standing_Leg_Curl', 3, 12, 60, null, 10),
      item('b5', 'Thigh_Adductor', 2, 15, 45, null, 15),
      item('b6', 'custom_abdominal_banco_multiestacao', 3, 12, 45),
    ],
  },
  {
    id: 'plan-cardio', owner_id: null, name: 'Cardio', description: 'Bicicleta e passadeira, sem impacto.', color: '#FE8019', icon: 'bike', updated_at: '2026-09-01T10:00:00Z',
    items: [
      item('c1', 'Bicycling_Stationary', 1, null, 60, 900),
      item('c2', 'custom_passadeira_inclinada', 1, null, 60, 900),
      item('c3', 'custom_prancha_lateral', 2, null, 30, 30),
    ],
  },
  {
    id: 'plan-leve', owner_id: null, name: 'Treino leve', description: 'Para dias de pouca energia. 30 minutos.', color: '#40A02B', icon: 'heart', updated_at: '2026-09-01T10:00:00Z',
    items: [
      item('l1', 'custom_passadeira_inclinada', 1, null, 60, 600),
      item('l2', 'custom_elevacoes_laterais_3kg', 2, 12, 45, null, 3),
      item('l3', 'custom_extensao_anca_caneleiras', 2, 12, 45),
      item('l4', 'Thigh_Adductor', 2, 12, 45, null, 10),
      item('l5', 'Dead_Bug', 2, 10, 45),
    ],
  },
]

// Pequeno gerador pseudo-aleatório para o seed ser sempre igual.
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function buildDemoSnapshot(now = new Date()): Snapshot {
  const today = todayLisbon(now)
  const created = '2026-08-25T10:00:00Z'
  const people: [string, string, string, number, 'admin' | 'member', string[], string[], number][] = [
    // username, nome, avatar, cor, papel, restrições, dias da semana preferidos, assiduidade
    ['bruno', 'Bruno', 'a1', 0, 'admin', ['sem saltos', 'sem corrida'], ['0', '2', '4'], 0.86],
    ['irma', 'Irmã', 'a2', 1, 'member', [], ['1', '3'], 0.8],
    ['cunhado', 'Cunhado', 'a3', 2, 'member', [], ['0', '3', '5'], 0.68],
    ['mae', 'Mãe', 'a4', 3, 'member', ['joelho'], ['1', '4'], 0.9],
    ['padrasto', 'Padrasto', 'a5', 4, 'member', [], ['2', '5'], 0.55],
  ]
  const profiles: Profile[] = people.map(([u, n, , c, role, restrictions], i) => ({
    id: `p-${u}`, username: u, display_name: n, avatar: '', color: PERSON_COLORS[c], role, min_days_week: 2, active: true,
    restrictions, voice_enabled: true, created_at: created, ...(i === 0 ? {} : {}),
  }))

  const plannedDays: PlannedDay[] = []
  const sessions: Session[] = []
  const r = rng(42)
  const cur = monthKey(today)
  const months = [prevMonth(prevMonth(cur)), prevMonth(cur), cur]
  const planIds = SEED_PLANS.map((p) => p.id)
  let n = 0
  people.forEach(([u, , , , , , wds, att], pi) => {
    const pid = `p-${u}`
    for (const mk of months) {
      for (const d of monthDays(mk)) {
        if (!wds.includes(String(weekday(d)))) continue
        if (cmp(d, '2026-09-01') < 0) continue
        const id = `pd-${n++}`
        const plan_id = planIds[(n + pi) % planIds.length]
        plannedDays.push({ id, profile_id: pid, date: d, plan_id, status: 'planned', auto_filled: false, moved_from: null })
        if (cmp(d, today) < 0 && r() < att) {
          const h = 7 + Math.floor(r() * 14)
          const start = `${d}T${String(h).padStart(2, '0')}:${String(Math.floor(r() * 50)).padStart(2, '0')}:00Z`
          const minutes = 25 + Math.floor(r() * 35)
          const end = new Date(new Date(start).getTime() + minutes * 60000).toISOString()
          const guided = r() < 0.6
          sessions.push({
            id: `s-${n}`, profile_id: pid, date: d, started_at: start, ended_at: end, plan_id: guided ? plan_id : null, kind: guided ? 'guided' : 'quick',
            completed_all: guided && r() < 0.8, minutes, photo_path: `demo:${pi}:${n % 4}`, photo_taken_at: end, in_feed: true, planned_day_id: id, sets: [], notes: '',
          })
        }
      }
    }
  })
  // Um treino extra de hoje de manhã para a Mãe e o Bruno marcado para hoje, para o feed ter vida.
  const extraDay = addDays(today, -1)
  sessions.push({
    id: 's-extra', profile_id: 'p-irma', date: extraDay, started_at: `${extraDay}T19:10:00Z`, ended_at: `${extraDay}T19:45:00Z`, plan_id: 'plan-cardio', kind: 'guided',
    completed_all: true, minutes: 35, photo_path: 'demo:1:2', photo_taken_at: `${extraDay}T19:45:00Z`, in_feed: true, planned_day_id: null, sets: [], notes: '',
  })
  if (!plannedDays.some((d) => d.profile_id === 'p-bruno' && d.date === today)) {
    plannedDays.push({ id: `pd-${n++}`, profile_id: 'p-bruno', date: today, plan_id: 'plan-forca-a', status: 'planned', auto_filled: false, moved_from: null })
  }

  return {
    profiles,
    equipment: SEED_EQUIPMENT,
    plans: SEED_PLANS,
    plannedDays,
    sessions,
    excuses: [],
    jar: [],
    settings: { ...DEFAULT_SETTINGS },
    reactions: sessions.slice(-30).flatMap((s, i) => (i % 2 ? [{ id: `r-${i}`, session_id: s.id, profile_id: profiles[(i + 1) % 5].id, kind: (['palmas', 'fogo', 'musculo'] as const)[i % 3], created_at: s.ended_at }] : [])),
    closures: [],
    audit: [],
    exerciseOverrides: {},
    customExercises: [],
  }
}
