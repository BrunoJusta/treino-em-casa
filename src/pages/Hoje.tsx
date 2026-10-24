import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CaretRight, Camera, GearSix, Play, CalendarPlus, Warning } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { useFamily, usePerson } from '../data/derived'
import { Avatar } from '../components/Avatar'
import { JarMascot } from '../components/pixel/JarMascot'
import { PixelIcon } from '../components/pixel/Pixel'
import { Bar, Photo, ProfileLink } from '../components/ui'
import { InstallCard } from '../components/InstallCard'
import { dayOfMonth, longDate, monthKey, monthName, hourLisbon, daysInMonth } from '../lib/dates'
import { checkMonthWeeks } from '../lib/rules/planning'
import { euros } from '../lib/rules/jar'
import { api, isDemo } from '../lib/config'
import { names } from '../lib/format'
import { addDays } from '../lib/dates'

function greeting() {
  const h = hourLisbon()
  if (h < 6) return 'Boa noite'
  if (h < 13) return 'Bom dia'
  if (h < 20) return 'Boa tarde'
  return 'Boa noite'
}

export function Hoje() {
  const { me, snap, today, isAdmin } = useApp()
  const p = usePerson(me)!
  const fam = useFamily()
  const nav = useNavigate()
  const mk = monthKey(today)
  const plan = p.todayDay?.plan_id ? snap.plans.find((x) => x.id === p.todayDay!.plan_id) : null
  const weeks = checkMonthWeeks(mk, p.monthDays.map((d) => d.date), me.min_days_week)
  const needsPlanning = weeks.some((w) => !w.ok && w.days.some((d) => d >= today))
  const inWindow = dayOfMonth(today) <= snap.settings.plan_window_end_day
  const pendingExcuses = isAdmin ? snap.excuses.filter((e) => e.status === 'pending') : []
  const trainedToday = snap.profiles.filter((x) => snap.sessions.some((s) => s.profile_id === x.id && s.date === today))
  const risk = p.risk.atRisk.reduce((s, x) => s + x.amount_cents, 0)
  const firstRecover = p.recover[0]
  const mood = p.todaySession ? 'party' : risk ? 'sad' : 'happy'
  const [weighIn, setWeighIn] = useState(false)
  useEffect(() => {
    api.getBody().then(({ profile, metrics }) => {
      const last = metrics.map((m) => m.date).sort().at(-1)
      setWeighIn(profile.weekly_reminder && (!last || last <= addDays(today, -7)))
    }).catch(() => {})
  }, [today])

  let hero
  if (p.todaySession) {
    hero = (
      <div className="hero-today done">
        <div className="row">
          <div className="grow stack-sm">
            <span className="chip ok" style={{ alignSelf: 'flex-start' }}>Feito hoje</span>
            <h2>Treino feito. Boa!</h2>
            <p className="small" style={{ color: 'var(--ok)' }}>{p.todaySession.minutes} min{plan ? ` de ${plan.name}` : ''}. Já está no feed da família.</p>
          </div>
          <div style={{ width: 84, flexShrink: 0 }}><Photo path={p.todaySession.photo_path} alt="A tua foto de hoje" className="post-photo" /></div>
        </div>
        <Link to="/familia" className="btn secondary block">Ver o feed</Link>
      </div>
    )
  } else if (p.todayDay) {
    hero = (
      <div className="hero-today">
        <div className="stack-sm">
          <span className="chip on" style={{ alignSelf: 'flex-start' }}>Hoje está marcado</span>
          <h2 style={{ fontSize: 26 }}>{plan ? plan.name : 'Treino livre'}</h2>
          {plan && <p className="small" style={{ color: 'var(--ink-2)' }}>{plan.items.length} exercícios. {plan.description}</p>}
        </div>
        {plan ? (
          <button className="btn primary huge block" onClick={() => nav(`/player/${plan.id}`)}><Play size={24} weight="fill" /> Começar treino</button>
        ) : (
          <button className="btn primary huge block" onClick={() => nav('/treinos')}><Play size={24} weight="fill" /> Escolher treino</button>
        )}
        <button className="btn secondary big block" onClick={() => nav('/treinar')}><Camera size={22} weight="bold" /> Já treinei</button>
      </div>
    )
  } else if (firstRecover) {
    hero = (
      <div className="hero-today recover">
        <div className="stack-sm">
          <span className="chip warn" style={{ alignSelf: 'flex-start' }}>Por recuperar</span>
          <h2>Tens {p.recover.length === 1 ? `o dia ${dayOfMonth(firstRecover.date)}` : `${p.recover.length} dias`} por recuperar</h2>
          <p className="small" style={{ color: 'var(--ink-2)' }}>Hoje é dia livre. Se treinares hoje, o dia {dayOfMonth(firstRecover.date)} passa para hoje e deixa de contar como falha.</p>
        </div>
        <button className="btn primary huge block" onClick={() => nav(`/treinar?recuperar=${firstRecover.id}`)}><Camera size={24} weight="bold" /> Recuperar hoje</button>
      </div>
    )
  } else {
    hero = (
      <div className="hero-today free">
        <div className="stack-sm">
          <span className="chip" style={{ alignSelf: 'flex-start' }}>Dia livre</span>
          <h2>Hoje não tens treino marcado</h2>
          <p className="small muted">Descansar também conta. Se te apetecer, um treino extra vale 30 XP.</p>
        </div>
        <button className="btn secondary big block" onClick={() => nav('/treinar')}><Camera size={22} weight="bold" /> Treinar na mesma</button>
      </div>
    )
  }

  return (
    <main className="page">
      <header className="row">
        <div className="grow">
          <h1 style={{ fontSize: 24 }}>{greeting()}, {me.display_name}</h1>
          <p className="small muted">{longDate(today)}</p>
        </div>
        {isAdmin && <Link to="/admin" className="icon-btn" aria-label="Backoffice"><GearSix size={22} weight="bold" /></Link>}
        <ProfileLink />
      </header>

      <InstallCard />

      {isDemo && <div className="demo-banner">Modo demo: ainda sem Supabase ligado. Experimenta à vontade.</div>}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>{hero}</motion.div>

      {pendingExcuses.length > 0 && (
        <Link to="/admin/desculpas" className="card warn tap row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Warning size={26} weight="fill" color="var(--warn)" />
          <div className="grow"><p className="strong">{pendingExcuses.length === 1 ? 'Tens 1 desculpa para decidir' : `Tens ${pendingExcuses.length} desculpas para decidir`}</p><p className="small muted">Ficam pendentes até decidires.</p></div>
          <CaretRight size={20} />
        </Link>
      )}

      {risk > 0 && (
        <div className="card danger row">
          <JarMascot mood="wow" level={0.3} size={46} bounce={false} />
          <div className="grow">
            <p className="strong">Se o mês fechasse hoje, ias pôr {euros(risk)} no jarro</p>
            <p className="small" style={{ color: 'var(--ink-2)' }}>Muda um dos dias falhados para um dia livre até {daysInMonth(mk)} de {monthName(mk)} e treina.</p>
          </div>
        </div>
      )}

      {needsPlanning && (
        <Link to="/calendario" className="card accent tap row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <CalendarPlus size={28} weight="bold" color="var(--accent-text)" />
          <div className="grow">
            <p className="strong">Planeia {monthName(mk)}</p>
            <p className="small" style={{ color: 'var(--ink-2)' }}>{inWindow ? `Até dia ${snap.settings.plan_window_end_day}. Depois a app completa sozinha as semanas que faltam.` : 'Há semanas com menos de 2 dias marcados.'}</p>
          </div>
          <CaretRight size={20} />
        </Link>
      )}

      {weighIn && (
        <Link to="/corpo" className="card soft tap row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <PixelIcon name="heart" size={28} />
          <div className="grow"><p className="strong">Registar o peso da semana</p><p className="small muted">Lembrete privado. Só tu vês.</p></div>
          <CaretRight size={20} />
        </Link>
      )}

      <section className="grid-3" aria-label="Os meus números">
        <div className="kpi">
          <span className="kpi-ico"><PixelIcon name="flame" size={22} /></span>
          <b className="num">{p.streak.weeks}</b>
          <span>{p.streak.weeks === 1 ? 'semana seguida' : 'semanas seguidas'}{p.streak.shield ? ', com escudo' : ''}</span>
        </div>
        <Link to="/perfil" className="kpi">
          <span className="kpi-ico"><PixelIcon name="star" size={22} /></span>
          <b>{p.level.name}</b>
          <span className="num">{p.xp} XP</span>
        </Link>
        <Link to="/calendario" className="kpi">
          <span className="kpi-ico"><PixelIcon name="dumbbell" size={22} /></span>
          <b className="num">{p.monthDone}/{p.monthDays.length}</b>
          <span>treinos em {monthName(mk)}</span>
        </Link>
      </section>

      <Link to="/jarro" className="card tap" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: 14, alignItems: 'center' }}>
        <JarMascot mood={mood} level={Math.min(1, fam.jar.potential / Math.max(1, snap.settings.goal_cents))} size={62} />
        <div className="grow stack-sm">
          <div className="row between"><span className="strong">Meta da família</span><span className="small num muted">{fam.goal.done}/{fam.goal.target} treinos</span></div>
          <Bar value={fam.goal.done / Math.max(1, fam.goal.target)} tone="pixel" label="Meta da família" />
          <p className="tiny muted">Jarro: {euros(fam.jar.balance)} {fam.jar.owed ? `(+ ${euros(fam.jar.owed)} por pagar)` : ''} para {snap.settings.goal_name}</p>
        </div>
      </Link>

      <section className="stack">
        <div className="section-title"><h2>Hoje lá em baixo</h2><Link to="/familia" className="small strong">Ver tudo</Link></div>
        {trainedToday.length ? (
          <div className="card soft row">
            <div className="avatar-stack">{trainedToday.map((x) => <Avatar key={x.id} avatar={x.avatar} color={x.color} name={x.display_name} size={40} />)}</div>
            <p className="small grow">{names(trainedToday.map((x) => x.display_name))} {trainedToday.length === 1 ? 'já treinou' : 'já treinaram'}.</p>
          </div>
        ) : (
          <div className="card soft"><p className="small muted">Ainda ninguém treinou hoje. Sê o primeiro e ganha o "treino a dois" se alguém for a seguir.</p></div>
        )}
      </section>
    </main>
  )
}
