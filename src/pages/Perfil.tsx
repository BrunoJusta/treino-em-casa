import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CaretRight, GearSix, Key, LockSimple, SignOut } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { usePerson } from '../data/derived'
import { api } from '../lib/config'
import { AvatarUpload } from '../components/AvatarUpload'
import { PixelIcon } from '../components/pixel/Pixel'
import { BackHeader, Bar, Sheet, Switch } from '../components/ui'
import { BADGES, badgesFor, LEVELS, totalMinutes, walkTotals } from '../lib/rules/game'
import { fmtKm } from '../lib/walk'
import { RESTRICTION_TAGS } from '../lib/rules/restrictions'
import { shortDate } from '../lib/dates'

export function Perfil() {
  const { id } = useParams()
  const { snap, me, today, exercises, isAdmin, signOut, run } = useApp()
  const profile = id ? snap.profiles.find((p) => p.id === id) ?? me : me
  const self = profile.id === me.id
  const p = usePerson(profile)!
  const equipMap = useMemo(() => new Map(exercises.map((e) => [e.id, e.equipment_ids])), [exercises])
  const earned = badgesFor(profile, today, snap, equipMap)
  const [codeOpen, setCodeOpen] = useState(false)
  const [badge, setBadge] = useState<string | null>(null)
  const [newRestr, setNewRestr] = useState('')
  const [code, setCode] = useState('')
  const canSeePrivate = self || isAdmin
  const b = BADGES.find((x) => x.code === badge)

  const setRestrictions = (r: string[]) => run(() => api.updateProfile(profile.id, { restrictions: r }))

  return (
    <main className="page">
      {id && !self ? <BackHeader title={profile.display_name} /> : (
        <header className="topbar">
          <h1>O meu perfil</h1>
          {isAdmin && <Link to="/admin" className="icon-btn" aria-label="Backoffice"><GearSix size={22} weight="bold" /></Link>}
        </header>
      )}

      <section className="row" style={{ gap: 16 }}>
        <AvatarUpload profile={profile} editable={self || isAdmin} />
        <div className="grow stack-sm">
          <h2 style={{ fontSize: 24 }}>{profile.display_name}</h2>
          <span className="pixel-frame pixel-type" style={{ alignSelf: 'flex-start', fontSize: 13, padding: '3px 10px', borderWidth: 3, boxShadow: '3px 3px 0 var(--ink)' }}>{p.level.name}</span>
        </div>
      </section>

      {self && (
        <Link to="/corpo" className="card accent tap row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span aria-hidden style={{ width: 44, height: 44, display: "grid", placeItems: "center", flexShrink: 0 }}><PixelIcon name="heart" size={32} /></span>
          <div className="grow"><p className="strong">Peso e IMC</p><p className="small" style={{ color: 'var(--ink-2)' }}>Evolução do peso. Privado, só tu vês.</p></div>
          <CaretRight size={20} />
        </Link>
      )}

      <section className="card stack-sm">
        <div className="row between"><span className="strong num">{p.xp} XP</span><span className="small muted">{p.level.next ? `faltam ${p.level.toNext} para ${p.level.next}` : 'Nível máximo!'}</span></div>
        <Bar value={p.level.progress} tone="pixel" label="Progresso de nível" />
        <div className="row-sm wrap" style={{ marginTop: 4 }}>
          {LEVELS.map((l, i) => <span key={l.name} className={`chip ${i <= p.level.index ? 'on' : ''}`} style={{ fontSize: 12.5, padding: '3px 9px' }}>{l.name}</span>)}
        </div>
      </section>

      <section className="grid-3">
        <div className="stat"><b className="num">{p.sessions.length}</b><span>treinos</span></div>
        <div className="stat"><b className="num">{Math.round(totalMinutes(profile.id, snap.sessions) / 60)}h</b><span>a treinar</span></div>
        <div className="stat"><b className="num">{p.streak.weeks}</b><span>semanas seguidas</span></div>
      </section>

      {[
        { title: 'Conquistas', list: BADGES.filter((x) => !x.walk) },
        { title: 'Caminhadas', list: BADGES.filter((x) => x.walk) },
      ].map((grp) => (
        <section key={grp.title} className="stack-sm">
          <div className="section-title"><h2>{grp.title}</h2><span className="small muted num">{grp.list.filter((x) => earned.some((e) => e.code === x.code)).length}/{grp.list.length}</span></div>
          {grp.title === 'Caminhadas' && (() => {
            const t = walkTotals(profile.id, snap.walks)
            return <p className="small" style={{ color: 'var(--walk-text)' }}>{t.count ? `${t.count} ${t.count === 1 ? 'caminhada' : 'caminhadas'}${t.meters ? `, ${fmtKm(t.meters)} no total` : ''}. Não dão XP.` : 'Ainda sem caminhadas. Não dão XP, mas têm conquistas próprias.'}</p>
          })()}
          <div className="grid-3">
            {grp.list.map((x) => {
              const has = earned.some((e) => e.code === x.code)
              return (
                <button key={x.code} className={`badge-tile ${has ? '' : 'locked'}`} onClick={() => setBadge(x.code)} aria-label={`${x.name}${has ? '' : ', por desbloquear'}`}>
                  <span className={`medal tier-${x.tier}`}><PixelIcon name={has ? x.icon : 'lock'} size={34} /></span>
                  <span>{x.name}</span>
                </button>
              )
            })}
          </div>
        </section>
      ))}

      {canSeePrivate && (
        <section className="stack-sm">
          <h2>Restrições</h2>
          <p className="small muted row-sm"><LockSimple size={16} /> Só tu e os admins veem isto. Os planos avisam quando um exercício choca com uma restrição.</p>
          <div className="row-sm wrap">
            {RESTRICTION_TAGS.map((t) => {
              const on = profile.restrictions.includes(t.tag)
              return <button key={t.tag} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setRestrictions(on ? profile.restrictions.filter((r) => r !== t.tag) : [...profile.restrictions, t.tag])}>{t.tag}</button>
            })}
            {profile.restrictions.filter((r) => !RESTRICTION_TAGS.some((t) => t.tag === r)).map((r) => (
              <button key={r} className="chip on" onClick={() => setRestrictions(profile.restrictions.filter((x) => x !== r))} aria-label={`Tirar ${r}`}>{r} ×</button>
            ))}
          </div>
          <form className="row-sm" onSubmit={(e) => { e.preventDefault(); if (newRestr.trim()) { void setRestrictions([...profile.restrictions, newRestr.trim().toLowerCase()]); setNewRestr('') } }}>
            <input className="input" placeholder="Outra (por exemplo: Aquiles)" value={newRestr} onChange={(e) => setNewRestr(e.target.value)} aria-label="Nova restrição" />
            <button className="btn secondary">Juntar</button>
          </form>
        </section>
      )}

      {self && (
        <section className="list">
          <label className="list-item">
            <PixelIcon name="star" size={28} />
            <div className="grow"><p className="strong">Voz no treino</p><p className="small muted">Conta as séries e o descanso em voz alta.</p></div>
            <Switch checked={profile.voice_enabled} onChange={(v) => run(() => api.updateProfile(profile.id, { voice_enabled: v }))} label="Voz no treino" />
          </label>
          <button className="list-item" onClick={() => setCodeOpen(true)}>
            <Key size={26} />
            <span className="grow strong">Mudar o meu código</span>
            <CaretRight size={20} />
          </button>
          <button className="list-item" onClick={signOut} style={{ color: 'var(--danger)' }}>
            <SignOut size={26} />
            <span className="grow strong">Sair</span>
          </button>
        </section>
      )}


      <Sheet open={codeOpen} onClose={() => setCodeOpen(false)} title="Mudar o código">
        <label className="field"><span>Código novo (6 dígitos)</span><input className="input num" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoComplete="new-password" /></label>
        <button className="btn primary big block" disabled={code.length !== 6} onClick={() => run(() => api.changeOwnCode(code), 'Código mudado').then(() => { setCode(''); setCodeOpen(false) })}>Guardar código</button>
      </Sheet>

      <Sheet open={!!b} onClose={() => setBadge(null)} title={b?.name}>
        {b && (
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
            <span className={`medal tier-${b.tier}`} style={{ width: 96, height: 96, borderRadius: 24, display: 'grid', placeItems: 'center' }}><PixelIcon name={b.icon} size={60} /></span>
            <p>{b.description}</p>
            {(() => { const e = earned.find((x) => x.code === b.code); return e ? <span className="chip ok">Desbloqueada{/^\d{4}-\d{2}-\d{2}/.test(e.at) ? ` a ${shortDate(e.at.slice(0, 10))}` : ''}</span> : <span className="chip">Por desbloquear</span> })()}
            {b.collective && <p className="small muted">Conquista da família: todos a ganham juntos.</p>}
          </div>
        )}
      </Sheet>
    </main>
  )
}
