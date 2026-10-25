import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DotsThree, HandsClapping, Fire, Barbell } from '@phosphor-icons/react'
import { RouteSvg } from '../components/walk/RouteSvg'
import { useApp } from '../data/store'
import { buildFeed, useFamily } from '../data/derived'
import { api } from '../lib/config'
import { Avatar } from '../components/Avatar'
import { PixelIcon } from '../components/pixel/Pixel'
import { Bar, Empty, Photo, Sheet, TopBar } from '../components/ui'
import { monthKey, monthLabel, timeAgo } from '../lib/dates'
import { BADGES, collectiveBadges, levelFor, rankingFor, xpFor } from '../lib/rules/game'
import { sfx } from '../lib/fx'
import type { Reaction } from '../data/types'

const REACTIONS: { kind: Reaction['kind']; label: string; icon: JSX.Element }[] = [
  { kind: 'palmas', label: 'Palmas', icon: <HandsClapping size={18} weight="fill" color="#DF8E1D" /> },
  { kind: 'fogo', label: 'Fogo', icon: <Fire size={18} weight="fill" color="#E64553" /> },
  { kind: 'musculo', label: 'Força', icon: <Barbell size={18} weight="fill" color="#39C2EF" /> },
]

export function Familia() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as 'feed' | 'ranking' | 'conquistas') ?? 'feed'
  return (
    <main className="page">
      <TopBar title="Família" />
      <div className="seg">
        <button aria-pressed={tab === 'feed'} onClick={() => setParams({})}>Feed</button>
        <button aria-pressed={tab === 'ranking'} onClick={() => setParams({ tab: 'ranking' })}>Ranking</button>
        <button aria-pressed={tab === 'conquistas'} onClick={() => setParams({ tab: 'conquistas' })}>Conquistas</button>
      </div>
      {tab === 'feed' && <Feed />}
      {tab === 'ranking' && <Ranking />}
      {tab === 'conquistas' && <Conquistas />}
    </main>
  )
}

function Feed() {
  const { snap, me, run } = useApp()
  const [limit, setLimit] = useState(15)
  const [menu, setMenu] = useState<string | null>(null)
  const [walkMenu, setWalkMenu] = useState<string | null>(null)
  const items = buildFeed(snap)
  if (!items.length) return <Empty title="Ainda não há nada no feed" text="O primeiro treino da família aparece aqui, com foto." mood="happy" />
  return (
    <section className="stack" style={{ gap: 16 }}>
      {items.slice(0, limit).map((it) => {
        const p = it.profile
        if (it.kind === 'walk' && it.walk) {
          const w = it.walk
          const canDelete = w.profile_id === me.id
          return (
            <article key={it.id} className="post card walk-post">
              <div className="row">
                <div className="avatar-stack">
                  {p && <Link to={`/perfil/${p.id}`} aria-label={p.display_name}><Avatar avatar={p.avatar} color={p.color} name={p.display_name} size={42} /></Link>}
                  {(it.companions ?? []).map((c) => <Avatar key={c.id} avatar={c.avatar} color={c.color} name={c.display_name} size={32} />)}
                </div>
                <div className="grow"><p><strong>{p?.display_name}</strong> {it.text}</p><p className="tiny muted">{it.sub}, {timeAgo(it.at)}</p></div>
                {canDelete && <button className="icon-btn plain" aria-label="Opções da caminhada" onClick={() => setWalkMenu(w.id)}><DotsThree size={24} weight="bold" /></button>}
              </div>
              {w.photo_path && <Photo path={w.photo_path} alt={`Foto da caminhada de ${p?.display_name ?? ''}`} className="post-photo" />}
              {w.route && w.route.length > 1 && <RouteSvg route={w.route} height={w.photo_path ? 100 : 140} label={`Percurso da caminhada de ${p?.display_name ?? ''}`} />}
              <div className="row between">
                <span className="walk-tag"><PixelIcon name="walk" size={18} /> Caminhada</span>
                {w.notes && <span className="small muted" style={{ textAlign: 'right' }}>{w.notes}</span>}
              </div>
            </article>
          )
        }
        if (it.kind !== 'session' || !it.session) {
          return (
            <div key={it.id} className={`card ${it.kind === 'penalty' ? 'warn' : it.kind === 'spend' ? 'accent' : 'soft'} row`}>
              {p ? <Avatar avatar={p.avatar} color={p.color} name={p.display_name} size={36} /> : <PixelIcon name="jar" size={32} />}
              <div className="grow"><p className="small"><strong>{p?.display_name}</strong> {it.text}</p>{it.sub && <p className="tiny muted">{it.sub}</p>}</div>
              <span className="tiny muted">{timeAgo(it.at)}</span>
            </div>
          )
        }
        const s = it.session
        const reacts = snap.reactions.filter((r) => r.session_id === s.id)
        return (
          <article key={it.id} className="post card">
            <div className="row">
              {p && <Link to={`/perfil/${p.id}`} aria-label={p.display_name}><Avatar avatar={p.avatar} color={p.color} name={p.display_name} size={42} /></Link>}
              <div className="grow"><p><strong>{p?.display_name}</strong> {it.text}</p><p className="tiny muted">{it.sub}, {timeAgo(it.at)}</p></div>
              {p?.id === me.id && s.photo_path && <button className="icon-btn plain" aria-label="Opções" onClick={() => setMenu(s.id)}><DotsThree size={24} weight="bold" /></button>}
            </div>
            {s.in_feed && s.photo_path && <Photo path={s.photo_path} alt={`Foto do treino de ${p?.display_name}`} className="post-photo" />}
            <div className="react-row">
              {REACTIONS.map((r) => {
                const n = reacts.filter((x) => x.kind === r.kind).length
                const on = reacts.some((x) => x.kind === r.kind && x.profile_id === me.id)
                return (
                  <button key={r.kind} className={`react ${on ? 'on' : ''}`} aria-pressed={on} aria-label={`${r.label}${n ? `, ${n}` : ''}`} onClick={() => { sfx.tap(); void run(() => api.toggleReaction(s.id, r.kind)) }}>
                    {r.icon}{n > 0 && <span className="num">{n}</span>}
                  </button>
                )
              })}
            </div>
          </article>
        )
      })}
      {items.length > limit && <button className="btn secondary block" onClick={() => setLimit((l) => l + 15)}>Ver mais</button>}
      <Sheet open={!!walkMenu} onClose={() => setWalkMenu(null)} title="A tua caminhada">
        {snap.walks?.find((x) => x.id === walkMenu)?.photo_path && (
          <>
            <p className="muted">Se apagares só a foto, a caminhada continua no feed, sem a foto.</p>
            <button className="btn secondary big block" onClick={() => run(() => api.hideWalkPhoto(walkMenu!), 'Foto apagada').then(() => setWalkMenu(null))}>Apagar a foto</button>
          </>
        )}
        <p className="muted">Se apagares a caminhada, sai do feed e deixa de contar para as conquistas, tuas e de quem foi contigo.</p>
        <button className="btn danger big block" onClick={() => run(() => api.deleteWalk(walkMenu!), 'Caminhada apagada').then(() => setWalkMenu(null))}>Apagar a caminhada</button>
      </Sheet>
      <Sheet open={!!menu} onClose={() => setMenu(null)} title="A tua foto">
        <p className="muted">Se apagares a foto, sai do feed. O treino continua a contar, porque a prova ficou registada com a data e a hora.</p>
        <button className="btn danger big block" onClick={() => run(() => api.hideSessionPhoto(menu!), 'Foto apagada').then(() => setMenu(null))}>Apagar a foto</button>
      </Sheet>
    </section>
  )
}

function Ranking() {
  const { snap, today } = useApp()
  const mk = monthKey(today)
  const rows = rankingFor(mk, today, snap)
  const medals = ['crown', 'trophy', 'star']
  return (
    <section className="stack">
      <p className="small muted">{monthLabel(mk)}. Ordenado pela percentagem de dias marcados que foram cumpridos. Em caso de empate, ganha quem fez mais treinos.</p>
      <div className="list">
        {rows.map((r, i) => (
          <Link key={r.profile.id} to={`/perfil/${r.profile.id}`} className="list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="num strong" style={{ width: 22, textAlign: 'center' }}>{i + 1}</span>
            <Avatar avatar={r.profile.avatar} color={r.profile.color} name={r.profile.display_name} size={44} />
            <div className="grow stack-sm">
              <div className="row between"><span className="strong">{r.profile.display_name}</span><span className="num strong">{Math.round(r.consistency * 100)}%</span></div>
              <Bar value={r.consistency} label={`Consistência de ${r.profile.display_name}`} />
              <span className="tiny muted num">{r.done} de {r.planned} dias cumpridos, {r.extra} treinos no mês</span>
            </div>
            {i < 3 && r.planned > 0 && <PixelIcon name={medals[i]} size={26} title={`${i + 1}.º lugar`} />}
          </Link>
        ))}
      </div>
      <p className="tiny muted">Quem treina 2 vezes por semana e cumpre vale tanto como quem treina 4. Os dias de hoje ainda sem treino não contam.</p>
    </section>
  )
}

function Conquistas() {
  const { snap, today, toast } = useApp()
  const fam = useFamily()
  const got = collectiveBadges(today, snap)
  const collective = BADGES.filter((b) => b.collective)
  return (
    <section className="stack" style={{ gap: 20 }}>
      <div className="card accent stack-sm">
        <div className="row between"><h3>Meta de {monthLabel(fam.mk)}</h3><span className="num strong">{fam.goal.done}/{fam.goal.target}</span></div>
        <Bar value={fam.goal.done / Math.max(1, fam.goal.target)} tone="pixel" label="Meta da família" />
        <p className="small" style={{ color: 'var(--ink-2)' }}>Prémio: {fam.goal.reward}</p>
      </div>
      <div className="stack-sm">
        <h2>Conquistas da família</h2>
        <div className="grid-3">
          {collective.map((b) => {
            const has = got.some((g) => g.code === b.code)
            return (
              <button key={b.code} className={`badge-tile ${has ? '' : 'locked'}`} onClick={() => toast(`${b.name}: ${b.description}${has ? '' : ' (por desbloquear)'}`, 'info')}>
                <span className={`medal tier-${b.tier}`}><PixelIcon name={b.icon} size={34} /></span>
                <span>{b.name}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="stack-sm">
        <h2>Níveis</h2>
        <div className="list">
          {snap.profiles.filter((p) => p.active).map((p) => {
            const xp = xpFor(p, today, snap)
            const lv = levelFor(xp)
            return (
              <Link key={p.id} to={`/perfil/${p.id}`} className="list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                <Avatar avatar={p.avatar} color={p.color} name={p.display_name} size={40} />
                <div className="grow stack-sm">
                  <div className="row between"><span className="strong">{p.display_name}</span><span className="small strong">{lv.name}</span></div>
                  <Bar value={lv.progress} tone="pixel" label={`Progresso de nível de ${p.display_name}`} />
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
