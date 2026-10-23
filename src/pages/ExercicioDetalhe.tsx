import { Link, useParams } from 'react-router-dom'
import { PencilSimple, YoutubeLogo, Warning } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { BackHeader, ExerciseIcon } from '../components/ui'
import { PixelIcon } from '../components/pixel/Pixel'
import { PATTERN_LABEL } from '../components/pixel/sprites'
import { conflicts } from '../lib/rules/restrictions'
import { LEVEL_LABEL } from './Treinos'

export function ExercicioDetalhe() {
  const { id } = useParams()
  const { exerciseById, snap, me, isAdmin } = useApp()
  const e = exerciseById.get(id ?? '')
  if (!e) return <main className="page"><BackHeader title="Exercício" /><p>Não encontrei este exercício.</p></main>
  const c = conflicts(e, me.restrictions)
  const eq = e.equipment_ids.map((x) => snap.equipment.find((y) => y.id === x)).filter(Boolean)
  const yt = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.name_en ?? e.name_pt} exercício técnica`)}`
  return (
    <main className="page">
      <BackHeader title="" right={isAdmin ? <Link to={`/admin/exercicios?id=${e.id}`} className="icon-btn" aria-label="Editar"><PencilSimple size={20} weight="bold" /></Link> : undefined} />
      <div className="row" style={{ gap: 16 }}>
        <ExerciseIcon ex={e} size={84} />
        <div className="grow stack-sm">
          <h1 style={{ fontSize: 26 }}>{e.name_pt}</h1>
          {e.name_en && <p className="small muted">{e.name_en}</p>}
        </div>
      </div>
      <div className="row-sm wrap">
        <span className="chip on">{PATTERN_LABEL[e.pattern]}</span>
        <span className="chip">{LEVEL_LABEL[e.level]}</span>
        {e.primary_muscles.map((m) => <span key={m} className="chip">{m}</span>)}
        {!e.reviewed && <span className="chip warn">Tradução por rever</span>}
      </div>
      {c.length > 0 && (
        <div className="card warn row"><Warning size={24} weight="fill" color="var(--warn)" /><p className="small grow">Atenção à tua restrição: <strong>{c.join(', ')}</strong>. Fala com o admin ou escolhe outro exercício.</p></div>
      )}
      <section className="stack-sm">
        <h2>Material</h2>
        {eq.length ? (
          <div className="list">
            {eq.map((x) => (
              <div key={x!.id} className="list-item">
                <PixelIcon name={x!.icon} size={30} />
                <span className="grow strong">{x!.name}</span>
                {x!.status !== 'ok' && <span className="chip warn">{x!.status === 'arriving' ? 'A chegar' : 'Avariado'}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="card soft row"><PixelIcon name="body" size={28} /><span>Só o peso do corpo</span></div>
        )}
      </section>
      <section className="stack-sm">
        <h2>Como se faz</h2>
        {e.instructions_pt.length ? (
          <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {e.instructions_pt.map((t, i) => (
              <li key={i} className="row" style={{ alignItems: 'flex-start' }}>
                <span className="num strong" style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{i + 1}</span>
                <p style={{ maxWidth: '65ch' }}>{t}</p>
              </li>
            ))}
          </ol>
        ) : <p className="muted">Ainda sem instruções.</p>}
      </section>
      <a href={yt} target="_blank" rel="noreferrer" className="btn secondary big block"><YoutubeLogo size={24} weight="fill" color="#E64553" /> Ver vídeos no YouTube</a>
    </main>
  )
}
