import type { Exercise, WorkoutPlan } from '../../data/types'

// Etiquetas de restrição pré-definidas e o que cada uma apanha.
export const RESTRICTION_TAGS: { tag: string; test: (e: Exercise) => boolean }[] = [
  { tag: 'sem saltos', test: (e) => /salto|saltar|jump|hop/i.test(`${e.name_pt} ${e.name_en ?? ''}`) || e.category === 'plyometrics' },
  { tag: 'sem corrida', test: (e) => /corrida|correr|jogging|running|sprint/i.test(`${e.name_pt} ${e.name_en ?? ''}`) },
  { tag: 'joelho', test: (e) => e.pattern === 'pernas' && /agachamento|afundo|squat|lunge|extens/i.test(`${e.name_pt} ${e.name_en ?? ''}`) },
  { tag: 'ombro', test: (e) => /press de ombros|acima da cabeça|overhead|militar|elevações laterais|dips|fundos/i.test(`${e.name_pt} ${e.name_en ?? ''}`) },
  { tag: 'costas', test: (e) => /peso morto|deadlift|remada curvada|good morning/i.test(`${e.name_pt} ${e.name_en ?? ''}`) },
  { tag: 'pulso', test: (e) => /flexão de braços|push-up|pulso|wrist/i.test(`${e.name_pt} ${e.name_en ?? ''}`) },
]

export function conflicts(e: Exercise, restrictions: string[]): string[] {
  return RESTRICTION_TAGS.filter((r) => restrictions.includes(r.tag) && r.test(e)).map((r) => r.tag)
}

export function estMinutes(plan: Pick<WorkoutPlan, 'items'>): number {
  let s = 0
  for (const it of plan.items) s += it.sets * ((it.duration_s ?? (it.reps ?? 10) * 3.5) + it.rest_s)
  return Math.max(5, Math.round(s / 60))
}
