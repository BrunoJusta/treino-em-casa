import { Reorder, useDragControls } from 'motion/react'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, DotsSixVertical, Plus, Trash, Warning, Minus } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { api } from '../lib/config'
import { BackHeader, ExerciseIcon, Sheet } from '../components/ui'
import { PixelIcon } from '../components/pixel/Pixel'
import { ICON_LABEL } from '../components/pixel/sprites'
import { COLOR_NAMES, PERSON_COLORS } from '../data/seed'
import { conflicts, estMinutes } from '../lib/rules/restrictions'
import { dur } from '../lib/format'
import { ExerciseRow, useExerciseFilter } from './Treinos'
import type { PlanItem, WorkoutPlan } from '../data/types'

const ICONS = ['dumbbell', 'barbell', 'station', 'bike', 'row', 'heart', 'flame', 'star', 'core', 'pernas']
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))

export function PlanoEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { snap, me, isAdmin, exerciseById, run } = useApp()
  const nav = useNavigate()
  const existing = snap.plans.find((p) => p.id === id)
  const [plan, setPlan] = useState<WorkoutPlan>(
    () => existing ?? { id: uid(), owner_id: params.get('familia') && isAdmin ? null : me.id, name: '', description: '', color: PERSON_COLORS[0], icon: 'dumbbell', items: [], updated_at: '' },
  )
  const [adding, setAdding] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const { list, controls } = useExerciseFilter()
  const canEdit = !existing || existing.owner_id === me.id || (!existing.owner_id && isAdmin)
  const people = plan.owner_id ? snap.profiles.filter((p) => p.id === plan.owner_id) : snap.profiles.filter((p) => p.active)

  const set = (patch: Partial<WorkoutPlan>) => setPlan((p) => ({ ...p, ...patch }))
  const setItem = (iid: string, patch: Partial<PlanItem>) => set({ items: plan.items.map((i) => (i.id === iid ? { ...i, ...patch } : i)) })
  const add = (exId: string) => {
    const ex = exerciseById.get(exId)!
    const timed = ex.pattern === 'cardio' || /prancha|plank/i.test(ex.name_pt)
    set({ items: [...plan.items, { id: uid(), exercise_id: exId, sets: timed && ex.pattern === 'cardio' ? 1 : 3, reps: timed ? null : 10, duration_s: timed ? (ex.pattern === 'cardio' ? 600 : 30) : null, rest_s: 60, target_load_kg: null, notes: '' }] })
    setAdding(false)
  }
  const save = async () => {
    if (!plan.name.trim()) return
    const r = await run(() => api.savePlan({ ...plan, name: plan.name.trim() }), 'Plano guardado')
    if (r !== undefined) nav('/treinos')
  }

  if (!canEdit) return <main className="page"><BackHeader title="Plano" /><p>Só o admin pode mudar os planos da família.</p></main>

  return (
    <main className="page no-nav">
      <BackHeader title={existing ? 'Editar plano' : 'Novo plano'} to="/treinos" />
      <label className="field"><span>Nome</span><input className="input" value={plan.name} onChange={(e) => set({ name: e.target.value })} placeholder="Por exemplo: Força A" maxLength={40} /></label>
      <label className="field"><span>Descrição</span><input className="input" value={plan.description} onChange={(e) => set({ description: e.target.value })} maxLength={120} /></label>
      <div className="field">
        <span>Cor e ícone</span>
        <div className="row-sm wrap">
          {PERSON_COLORS.map((c) => (
            <button key={c} onClick={() => set({ color: c })} aria-label={COLOR_NAMES[c] ?? c} aria-pressed={plan.color === c} style={{ width: 36, height: 36, borderRadius: 10, background: c, border: plan.color === c ? '3px solid var(--ink)' : '3px solid #fff', boxShadow: '0 0 0 1px var(--line)' }} />
          ))}
        </div>
        <div className="row-sm wrap">
          {ICONS.map((i) => (
            <button key={i} onClick={() => set({ icon: i })} aria-label={ICON_LABEL[i] ?? i} aria-pressed={plan.icon === i} className="icon-btn" style={{ borderColor: plan.icon === i ? 'var(--accent)' : undefined, background: plan.icon === i ? 'var(--accent-soft)' : undefined }}><PixelIcon name={i} size={26} /></button>
          ))}
        </div>
      </div>
      {isAdmin && (
        <div className="seg">
          <button aria-pressed={plan.owner_id === null} onClick={() => set({ owner_id: null })}>Da família</button>
          <button aria-pressed={plan.owner_id !== null} onClick={() => set({ owner_id: me.id })}>Só meu</button>
        </div>
      )}

      <section className="stack">
        <div className="section-title"><h2>Exercícios</h2><span className="small muted num">cerca de {estMinutes(plan)} min</span></div>
        <Reorder.Group axis="y" values={plan.items} onReorder={(items) => set({ items })} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plan.items.map((it) => (
            <ItemCard key={it.id} item={it} onChange={(p) => setItem(it.id, p)} onRemove={() => set({ items: plan.items.filter((x) => x.id !== it.id) })}
              onMove={(dir) => { const i = plan.items.indexOf(it); const j = i + dir; if (j < 0 || j >= plan.items.length) return; const items = [...plan.items]; [items[i], items[j]] = [items[j], items[i]]; set({ items }) }} warnFor={people.filter((p) => { const ex = exerciseById.get(it.exercise_id); return ex && conflicts(ex, p.restrictions).length }).map((p) => p.display_name)} />
          ))}
        </Reorder.Group>
        <button className="btn secondary big block" onClick={() => setAdding(true)}><Plus size={22} weight="bold" /> Juntar exercício</button>
      </section>

      <div className="stack-sm">
        <button className="btn primary big block" onClick={save} disabled={!plan.name.trim() || !plan.items.length}>Guardar plano</button>
        {existing && <button className="btn danger block" onClick={() => setConfirmDel(true)}><Trash size={20} /> Apagar plano</button>}
      </div>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Juntar exercício">
        {controls}
        <div className="list">
          {list.slice(0, 60).map((e) => <ExerciseRow key={e.id} e={e} onClick={() => add(e.id)} right={<Plus size={20} weight="bold" />} />)}
        </div>
      </Sheet>
      <Sheet open={confirmDel} onClose={() => setConfirmDel(false)} title="Apagar este plano?">
        <p className="muted">Os dias marcados com este plano ficam com "escolho na hora". Os treinos já feitos não mudam.</p>
        <button className="btn danger big block" onClick={() => run(() => api.deletePlan(plan.id), 'Plano apagado').then(() => nav('/treinos'))}>Apagar</button>
      </Sheet>
    </main>
  )
}

function Stepper({ label, value, onChange, step = 1, min = 0, suffix, format }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; suffix?: string; format?: (v: number) => string }) {
  return (
    <div className="stack-sm" style={{ alignItems: 'center' }}>
      <span className="tiny muted strong">{label}</span>
      <div className="row-sm">
        <button className="icon-btn" style={{ width: 44, height: 44, borderRadius: 12 }} aria-label={`Menos ${label}`} onClick={() => onChange(Math.max(min, value - step))}><Minus size={16} weight="bold" /></button>
        <span className="num strong" style={{ minWidth: 64, textAlign: 'center', whiteSpace: 'nowrap' }}>{format ? format(value) : `${value}${suffix ?? ''}`}</span>
        <button className="icon-btn" style={{ width: 44, height: 44, borderRadius: 12 }} aria-label={`Mais ${label}`} onClick={() => onChange(value + step)}><Plus size={16} weight="bold" /></button>
      </div>
    </div>
  )
}

function ItemCard({ item, onChange, onRemove, onMove, warnFor }: { item: PlanItem; onChange: (p: Partial<PlanItem>) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void; warnFor: string[] }) {
  const { exerciseById } = useApp()
  const ex = exerciseById.get(item.exercise_id)
  const controls = useDragControls()
  const timed = item.duration_s !== null
  if (!ex) return null
  return (
    <Reorder.Item value={item} dragListener={false} dragControls={controls} className="card stack" style={{ padding: 12 }}>
      <div className="row">
        <button className="icon-btn plain" style={{ touchAction: 'none', cursor: 'grab' }} onPointerDown={(e) => controls.start(e)} aria-label="Arrastar para ordenar"><DotsSixVertical size={22} weight="bold" /></button>
        <ExerciseIcon ex={ex} size={40} />
        <p className="strong grow" style={{ lineHeight: 1.25 }}>{ex.name_pt}</p>
        <button className="icon-btn plain" onClick={() => onMove(-1)} aria-label={`Subir ${ex.name_pt}`}><ArrowUp size={18} /></button>
        <button className="icon-btn plain" onClick={() => onMove(1)} aria-label={`Descer ${ex.name_pt}`}><ArrowDown size={18} /></button>
        <button className="icon-btn plain" onClick={onRemove} aria-label={`Tirar ${ex.name_pt}`}><Trash size={20} /></button>
      </div>
      {warnFor.length > 0 && <p className="small row-sm" style={{ color: 'var(--warn)' }}><Warning size={18} weight="fill" /> Choca com restrições de: {warnFor.join(', ')}</p>}
      <div className="seg" style={{ maxWidth: 260 }}>
        <button aria-pressed={!timed} onClick={() => onChange({ duration_s: null, reps: item.reps ?? 10 })}>Repetições</button>
        <button aria-pressed={timed} onClick={() => onChange({ duration_s: item.duration_s ?? 30, reps: null })}>Tempo</button>
      </div>
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <Stepper label="Séries" value={item.sets} min={1} onChange={(v) => onChange({ sets: v })} />
        {timed ? <Stepper label="Tempo" value={item.duration_s ?? 30} step={(item.duration_s ?? 30) >= 300 ? 60 : (item.duration_s ?? 30) >= 60 ? 30 : 15} min={10} format={dur} onChange={(v) => onChange({ duration_s: v })} /> : <Stepper label="Repetições" value={item.reps ?? 10} min={1} onChange={(v) => onChange({ reps: v })} />}
        <Stepper label="Descanso" value={item.rest_s} step={15} format={dur} onChange={(v) => onChange({ rest_s: v })} />
        {ex.equipment_ids.length > 0 && !timed && <Stepper label="Carga" value={item.target_load_kg ?? 0} suffix="kg" onChange={(v) => onChange({ target_load_kg: v || null })} />}
      </div>
      <input className="input" placeholder="Nota (opcional)" value={item.notes} onChange={(e) => onChange({ notes: e.target.value })} aria-label={`Nota para ${ex.name_pt}`} />
    </Reorder.Item>
  )
}
