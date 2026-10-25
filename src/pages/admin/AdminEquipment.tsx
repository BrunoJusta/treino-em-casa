import { useState } from 'react'
import { Plus, PencilSimple } from '@phosphor-icons/react'
import { useApp } from '../../data/store'
import { api } from '../../lib/config'
import { PixelIcon } from '../../components/pixel/Pixel'
import { ICON_LABEL } from '../../components/pixel/sprites'
import { ConfirmSheet, Sheet } from '../../components/ui'
import type { Equipment } from '../../data/types'

const CAT = { cardio: 'Cardio', machine: 'Máquina', free_weight: 'Peso livre', accessory: 'Acessório' } as const
const STATUS = { ok: 'OK', broken: 'Avariado', arriving: 'A chegar' } as const
const ICONS = ['station', 'bike', 'treadmill', 'elliptical', 'row', 'ball', 'dumbbell', 'barbell', 'bench', 'weight', 'body']

export function AdminEquipment() {
  const { snap, exercises } = useApp()
  const [edit, setEdit] = useState<Equipment | null>(null)
  const blank: Equipment = { id: '', name: '', category: 'accessory', icon: 'dumbbell', details: '', location: 'Lá em baixo', status: 'ok', max_load_kg: null, notes: '', photo_url: null }
  return (
    <section className="stack">
      <div className="list">
        {snap.equipment.map((e) => (
          <button key={e.id} className="list-item" onClick={() => setEdit(e)}>
            <span style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--surface)', display: 'grid', placeItems: 'center' }}><PixelIcon name={e.icon} size={30} /></span>
            <div className="grow">
              <p className="strong">{e.name}</p>
              <p className="small muted">{CAT[e.category]}, {exercises.filter((x) => x.equipment_ids.includes(e.id)).length} exercícios</p>
            </div>
            <span className={`chip ${e.status === 'ok' ? 'ok' : e.status === 'broken' ? 'danger' : 'warn'}`}>{STATUS[e.status]}</span>
            <PencilSimple size={18} />
          </button>
        ))}
      </div>
      <button className="btn primary big block" onClick={() => setEdit(blank)}><Plus size={22} weight="bold" /> Juntar material</button>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar material' : 'Novo material'}>
        {edit && <EquipmentForm e={edit} onDone={() => setEdit(null)} />}
      </Sheet>
    </section>
  )
}

function EquipmentForm({ e, onDone }: { e: Equipment; onDone: () => void }) {
  const { run } = useApp()
  const [f, setF] = useState(e)
  const [ask, setAsk] = useState(false)
  const save = () => {
    if (!f.name.trim()) return
    const id = f.id || f.name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    void run(() => api.saveEquipment({ ...f, id, name: f.name.trim() }), 'Material guardado').then(onDone)
  }
  return (
    <div className="stack">
      <label className="field"><span>Nome</span><input className="input" value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} /></label>
      <div className="field"><span>Ícone</span>
        <div className="row-sm wrap">{ICONS.map((i) => <button key={i} className="icon-btn" aria-pressed={f.icon === i} aria-label={ICON_LABEL[i] ?? i} onClick={() => setF({ ...f, icon: i })} style={{ borderColor: f.icon === i ? 'var(--accent)' : undefined, background: f.icon === i ? 'var(--accent-soft)' : undefined }}><PixelIcon name={i} size={26} /></button>)}</div>
      </div>
      <div className="grid-2">
        <label className="field"><span>Categoria</span><select className="select" value={f.category} onChange={(x) => setF({ ...f, category: x.target.value as Equipment['category'] })}>{Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span>Estado</span><select className="select" value={f.status} onChange={(x) => setF({ ...f, status: x.target.value as Equipment['status'] })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span>Localização</span><input className="input" value={f.location} onChange={(x) => setF({ ...f, location: x.target.value })} /></label>
        <label className="field"><span>Limite (kg)</span><input className="input num" inputMode="numeric" value={f.max_load_kg ?? ''} onChange={(x) => setF({ ...f, max_load_kg: Number(x.target.value) || null })} /></label>
      </div>
      <label className="field"><span>Detalhes</span><textarea className="textarea" value={f.details} onChange={(x) => setF({ ...f, details: x.target.value })} /></label>
      <label className="field"><span>Notas</span><input className="input" value={f.notes} onChange={(x) => setF({ ...f, notes: x.target.value })} /></label>
      <button className="btn primary big block" onClick={save}>Guardar</button>
      {e.id && <button className="btn danger block" onClick={() => setAsk(true)}>Apagar</button>}
      <ConfirmSheet open={ask} onClose={() => setAsk(false)} title={`Apagar ${e.name}?`} text="Os exercícios que usam este material ficam como peso do corpo até lhes escolheres outro. Se só está avariado, muda o estado em vez de apagar." confirm="Apagar" danger
        onConfirm={() => void run(() => api.deleteEquipment(e.id), 'Material apagado').then(onDone)} />
    </div>
  )
}
