import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MagnifyingGlass, Play, Plus, PencilSimple, Warning, CheckCircle } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { ExerciseIcon, Empty } from '../components/ui'
import { PixelIcon } from '../components/pixel/Pixel'
import { PATTERN_LABEL } from '../components/pixel/sprites'
import { conflicts, estMinutes } from '../lib/rules/restrictions'
import type { Exercise, Pattern } from '../data/types'

export const LEVEL_LABEL = { beginner: 'Iniciante', intermediate: 'Intermédio', expert: 'Avançado' } as const

export function Treinos() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'exercicios' ? 'exercicios' : 'planos'
  return (
    <main className="page">
      <header className="topbar"><h1>Treinos</h1></header>
      <div className="seg">
        <button aria-pressed={tab === 'planos'} onClick={() => setParams({})}>Planos</button>
        <button aria-pressed={tab === 'exercicios'} onClick={() => setParams({ tab: 'exercicios' })}>Exercícios</button>
      </div>
      {tab === 'planos' ? <Planos /> : <Biblioteca />}
    </main>
  )
}

function Planos() {
  const { snap, me, isAdmin } = useApp()
  const nav = useNavigate()
  const family = snap.plans.filter((p) => !p.owner_id)
  const mine = snap.plans.filter((p) => p.owner_id === me.id)
  const Card = ({ id }: { id: string }) => {
    const p = snap.plans.find((x) => x.id === id)!
    const canEdit = p.owner_id === me.id || (!p.owner_id && isAdmin)
    return (
      <div className="card stack" style={{ borderLeft: `6px solid ${p.color}` }}>
        <div className="row">
          <span style={{ width: 48, height: 48, borderRadius: 14, background: `color-mix(in srgb, ${p.color} 16%, white)`, display: 'grid', placeItems: 'center' }}><PixelIcon name={p.icon} size={30} /></span>
          <div className="grow">
            <h3>{p.name}</h3>
            <p className="small muted">{p.items.length} exercícios, cerca de {estMinutes(p)} min</p>
          </div>
          {canEdit && <Link to={`/planos/${p.id}`} className="icon-btn" aria-label={`Editar ${p.name}`}><PencilSimple size={20} weight="bold" /></Link>}
        </div>
        {p.description && <p className="small" style={{ color: 'var(--ink-2)' }}>{p.description}</p>}
        <button className="btn primary big block" onClick={() => nav(`/player/${p.id}`)} disabled={!p.items.length}><Play size={22} weight="fill" /> Começar</button>
      </div>
    )
  }
  return (
    <>
      <section className="stack">
        <div className="section-title"><h2>Da família</h2>{isAdmin && <Link to="/planos/novo?familia=1" className="small strong">Novo</Link>}</div>
        {family.map((p) => <div key={p.id}>{Card({ id: p.id })}</div>)}
      </section>
      <section className="stack">
        <div className="section-title"><h2>Os meus</h2></div>
        {mine.map((p) => <div key={p.id}>{Card({ id: p.id })}</div>)}
        {!mine.length && <Empty title="Ainda não tens planos teus" text="Monta um treino à tua medida, com os exercícios e o material lá de baixo." mood="happy" />}
        <Link to="/planos/novo" className="btn secondary big block"><Plus size={22} weight="bold" /> Criar plano</Link>
      </section>
    </>
  )
}

export function useExerciseFilter(initial?: { pattern?: Pattern | 'all' }) {
  const { exercises, snap } = useApp()
  const [q, setQ] = useState('')
  const [pattern, setPattern] = useState<Pattern | 'all'>(initial?.pattern ?? 'all')
  const [equip, setEquip] = useState<string>('all')
  const [onlyReviewed, setOnlyReviewed] = useState(false)
  const list = useMemo(() => {
    const nq = q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    return exercises
      .filter((e) => !e.hidden)
      .filter((e) => pattern === 'all' || e.pattern === pattern)
      .filter((e) => equip === 'all' || (equip === 'none' ? !e.equipment_ids.length : e.equipment_ids.includes(equip)))
      .filter((e) => !onlyReviewed || e.reviewed)
      .filter((e) => !nq || `${e.name_pt} ${e.name_en ?? ''} ${e.primary_muscles.join(' ')}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(nq))
      .sort((a, b) => Number(b.reviewed) - Number(a.reviewed) || a.name_pt.localeCompare(b.name_pt, 'pt'))
  }, [exercises, q, pattern, equip, onlyReviewed])
  const controls = (
    <div className="stack-sm">
      <label className="row" style={{ position: 'relative' }}>
        <MagnifyingGlass size={20} style={{ position: 'absolute', left: 14, color: 'var(--muted)' }} aria-hidden />
        <input className="input" style={{ paddingLeft: 44 }} placeholder="Procurar, por exemplo supino ou glúteos…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar exercícios" type="search" enterKeyHint="search" autoComplete="off" spellCheck={false} />
      </label>
      <div className="chips" role="group" aria-label="Padrão de movimento">
        <button className={`chip ${pattern === 'all' ? 'on' : ''}`} aria-pressed={pattern === 'all'} onClick={() => setPattern('all')}>Todos</button>
        {(Object.keys(PATTERN_LABEL) as Pattern[]).map((p) => (
          <button key={p} className={`chip ${pattern === p ? 'on' : ''}`} aria-pressed={pattern === p} onClick={() => setPattern(p)}>{PATTERN_LABEL[p]}</button>
        ))}
      </div>
      <div className="row-sm">
        <select className="select grow" value={equip} onChange={(e) => setEquip(e.target.value)} aria-label="Material">
          <option value="all">Todo o material</option>
          <option value="none">Peso do corpo</option>
          {snap.equipment.map((e) => <option key={e.id} value={e.id}>{e.name}{e.status === 'arriving' ? ' (a chegar)' : e.status === 'broken' ? ' (avariado)' : ''}</option>)}
        </select>
        <button className={`chip ${onlyReviewed ? 'on' : ''}`} onClick={() => setOnlyReviewed((v) => !v)} aria-pressed={onlyReviewed}>Revistos</button>
      </div>
    </div>
  )
  return { list, controls }
}

export function ExerciseRow({ e, onClick, right }: { e: Exercise; onClick?: () => void; right?: React.ReactNode }) {
  const { me, snap } = useApp()
  const c = conflicts(e, me.restrictions)
  const arriving = e.equipment_ids.some((id) => snap.equipment.find((x) => x.id === id)?.status !== 'ok')
  const body = (
    <>
      <ExerciseIcon ex={e} />
      <div className="grow">
        <p className="strong" style={{ lineHeight: 1.25 }}>{e.name_pt}</p>
        <p className="tiny muted">{PATTERN_LABEL[e.pattern]} · {e.primary_muscles.slice(0, 2).join(', ')}{arriving ? ' · material a chegar' : ''}</p>
      </div>
      {c.length > 0 && <><Warning size={20} weight="fill" color="var(--warn)" aria-hidden /><span className="sr-only">Atenção: {c.join(', ')}</span></>}
      {e.reviewed && !c.length && <><CheckCircle size={18} weight="fill" color="var(--accent-text)" aria-hidden /><span className="sr-only">Revisto</span></>}
      {right}
    </>
  )
  return onClick ? <button className="list-item" onClick={onClick}>{body}</button> : <div className="list-item">{body}</div>
}

function Biblioteca() {
  const { list, controls } = useExerciseFilter()
  const nav = useNavigate()
  const [limit, setLimit] = useState(40)
  return (
    <section className="stack">
      {controls}
      <p className="small muted num">{list.length} exercícios</p>
      {list.length ? (
        <div className="list">
          {list.slice(0, limit).map((e) => <ExerciseRow key={e.id} e={e} onClick={() => nav(`/exercicios/${e.id}`)} />)}
        </div>
      ) : (
        <Empty title="Nada encontrado" text="Tenta outra palavra ou tira os filtros." />
      )}
      {list.length > limit && <button className="btn secondary block" onClick={() => setLimit((l) => l + 40)}>Mostrar mais</button>}
    </section>
  )
}
