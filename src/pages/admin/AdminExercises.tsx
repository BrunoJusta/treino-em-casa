import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, EyeSlash } from '@phosphor-icons/react'
import { useApp } from '../../data/store'
import { api } from '../../lib/config'
import { Sheet, Switch } from '../../components/ui'
import { PATTERN_LABEL } from '../../components/pixel/sprites'
import { ExerciseRow, useExerciseFilter } from '../Treinos'
import type { Exercise, Pattern } from '../../data/types'

export function AdminExercises() {
  const { exercises, exerciseById } = useApp()
  const [params, setParams] = useSearchParams()
  const [edit, setEdit] = useState<Exercise | null>(null)
  const [onlyTodo, setOnlyTodo] = useState(false)
  const { list, controls } = useExerciseFilter()
  const [limit, setLimit] = useState(40)
  const hidden = exercises.filter((e) => e.hidden)
  const rows = onlyTodo ? list.filter((e) => !e.reviewed) : list

  useEffect(() => {
    const id = params.get('id')
    if (id && exerciseById.get(id)) setEdit(exerciseById.get(id)!)
  }, [params, exerciseById])

  const blank: Exercise = { id: `custom_${Date.now()}`, name_pt: '', name_en: null, instructions_pt: [], primary_muscles: [], secondary_muscles: [], pattern: 'empurrar', level: 'beginner', category: 'strength', force: null, mechanic: null, equipment_ids: [], source: 'custom', reviewed: true, hidden: false }

  return (
    <section className="stack">
      <p className="small muted">{exercises.filter((e) => e.reviewed).length} revistos de {exercises.length}. Os exercícios vêm do free-exercise-db (domínio público), filtrados pelo material da casa e traduzidos para pt-PT. Revê a tradução e marca como revisto.</p>
      {controls}
      <div className="row-sm">
        <button className={`chip ${onlyTodo ? 'on' : ''}`} aria-pressed={onlyTodo} onClick={() => setOnlyTodo((v) => !v)}>Só por rever</button>
        <span className="small muted num">{rows.length} exercícios, {hidden.length} escondidos</span>
      </div>
      <div className="list">{rows.slice(0, limit).map((e) => <ExerciseRow key={e.id} e={e} onClick={() => setEdit(e)} />)}</div>
      {rows.length > limit && <button className="btn secondary block" onClick={() => setLimit((l) => l + 40)}>Mostrar mais</button>}
      <button className="btn primary big block" onClick={() => setEdit(blank)}><Plus size={22} weight="bold" /> Criar exercício</button>
      {hidden.length > 0 && (
        <details className="card soft"><summary className="strong row-sm"><EyeSlash size={18} /> Escondidos ({hidden.length})</summary>
          <div className="list" style={{ marginTop: 12 }}>{hidden.map((e) => <ExerciseRow key={e.id} e={e} onClick={() => setEdit(e)} />)}</div>
        </details>
      )}
      <Sheet open={!!edit} onClose={() => { setEdit(null); if (params.get('id')) setParams({}) }} title={edit?.name_pt || 'Novo exercício'}>
        {edit && <ExerciseForm e={edit} isNew={!exerciseById.has(edit.id)} onDone={() => { setEdit(null); if (params.get('id')) setParams({}) }} />}
      </Sheet>
    </section>
  )
}

function ExerciseForm({ e, isNew, onDone }: { e: Exercise; isNew: boolean; onDone: () => void }) {
  const { snap, run } = useApp()
  const [f, setF] = useState({ ...e, steps: e.instructions_pt.join('\n'), muscles: e.primary_muscles.join(', ') })
  const save = () => {
    if (!f.name_pt.trim()) return
    const patch: Partial<Exercise> = {
      name_pt: f.name_pt.trim(),
      instructions_pt: f.steps.split('\n').map((s) => s.trim()).filter(Boolean),
      primary_muscles: f.muscles.split(',').map((s) => s.trim()).filter(Boolean),
      pattern: f.pattern,
      level: f.level,
      equipment_ids: f.equipment_ids,
      reviewed: f.reviewed,
      hidden: f.hidden,
    }
    void run(() => (isNew ? api.saveCustomExercise({ ...e, ...patch }) : api.saveExerciseEdit(e.id, patch)), 'Exercício guardado').then(onDone)
  }
  return (
    <div className="stack">
      {e.name_en && <p className="small muted">Original: {e.name_en}</p>}
      <label className="field"><span>Nome em pt-PT</span><input className="input" value={f.name_pt} onChange={(x) => setF({ ...f, name_pt: x.target.value })} /></label>
      <label className="field"><span>Passos (um por linha)</span><textarea className="textarea" style={{ minHeight: 180 }} value={f.steps} onChange={(x) => setF({ ...f, steps: x.target.value })} /></label>
      <div className="grid-2">
        <label className="field"><span>Padrão</span><select className="select" value={f.pattern} onChange={(x) => setF({ ...f, pattern: x.target.value as Pattern })}>{Object.entries(PATTERN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span>Nível</span><select className="select" value={f.level} onChange={(x) => setF({ ...f, level: x.target.value as Exercise['level'] })}><option value="beginner">Iniciante</option><option value="intermediate">Intermédio</option><option value="expert">Avançado</option></select></label>
      </div>
      <label className="field"><span>Músculos (separados por vírgula)</span><input className="input" value={f.muscles} onChange={(x) => setF({ ...f, muscles: x.target.value })} /></label>
      <div className="field"><span>Material</span>
        <div className="row-sm wrap">
          {snap.equipment.map((q) => {
            const on = f.equipment_ids.includes(q.id)
            return <button key={q.id} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setF({ ...f, equipment_ids: on ? f.equipment_ids.filter((x) => x !== q.id) : [...f.equipment_ids, q.id] })}>{q.name}</button>
          })}
        </div>
        <span className="help">Sem nada escolhido = peso do corpo.</span>
      </div>
      <label className="row between"><span className="strong">Revisto</span><Switch checked={f.reviewed} onChange={(v) => setF({ ...f, reviewed: v })} label="Revisto" /></label>
      <label className="row between"><span className="strong">Esconder da biblioteca</span><Switch checked={f.hidden} onChange={(v) => setF({ ...f, hidden: v })} label="Esconder" /></label>
      <button className="btn primary big block" onClick={save}>Guardar</button>
    </div>
  )
}
