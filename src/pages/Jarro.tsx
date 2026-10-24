import { useEffect, useState } from 'react'
import { BookOpen, CheckCircle, Coins, ForkKnife } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { useFamily, usePerson } from '../data/derived'
import { api } from '../lib/config'
import { JarMascot, FallingCoin } from '../components/pixel/JarMascot'
import { Avatar } from '../components/Avatar'
import { Bar, ConfirmSheet, Empty, Sheet, TopBar } from '../components/ui'
import { euros, owedBy } from '../lib/rules/jar'
import { shortDate, timeAgo, monthName } from '../lib/dates'
import { sfx } from '../lib/fx'

const SEEN_KEY = 'tec-jar-seen'

export function Jarro() {
  const { snap, me, isAdmin, run } = useApp()
  const fam = useFamily()
  const mine = usePerson(me)!
  const [drops, setDrops] = useState(0)
  const [payFor, setPayFor] = useState<string | null>(null)
  const [rules, setRules] = useState(false)
  const s = snap.settings
  const level = Math.min(1, fam.jar.potential / Math.max(1, s.goal_cents))
  const owed = owedBy(snap.jar, snap.profiles)
  const myRisk = mine.risk.atRisk.reduce((a, x) => a + x.amount_cents, 0)
  const history = [...snap.jar].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const byId = new Map(snap.profiles.map((p) => [p.id, p]))

  // moedas novas desde a última visita caem para dentro do jarro
  useEffect(() => {
    let seen = 0
    try { seen = Number(localStorage.getItem(SEEN_KEY) ?? 0) } catch { /* nada */ }
    const n = snap.jar.filter((j) => j.kind === 'penalty' && j.status !== 'void').length
    if (n > seen) {
      setDrops(Math.min(5, n - seen))
      sfx.coin()
    }
    try { localStorage.setItem(SEEN_KEY, String(n)) } catch { /* nada */ }
  }, [snap.jar])

  const markPaid = async (profileId: string) => {
    const entries = snap.jar.filter((j) => j.profile_id === profileId && j.kind === 'penalty' && j.status === 'unpaid')
    await run(async () => { for (const e of entries) await api.setJarEntryStatus(e.id, 'paid') }, 'Pagamento registado')
    setDrops(entries.length)
    sfx.coin()
  }

  return (
    <main className="page">
      <TopBar title="O Jarro">
        <button className="btn secondary sm" onClick={() => setRules(true)}><BookOpen size={18} weight="bold" /> Regras</button>
      </TopBar>

      <section className="card soft" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 28, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          {Array.from({ length: drops }, (_, i) => <FallingCoin key={`${drops}-${i}`} delay={i * 0.25} />)}
          <JarMascot level={level} mood={drops ? 'wow' : fam.jar.potential === 0 ? 'party' : 'happy'} size={150} label={`O Jarro tem ${euros(fam.jar.balance)}`} />
        </div>
        <div className="center">
          <p className="num" style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{euros(fam.jar.balance)}</p>
          <p className="small muted">no jarro{fam.jar.owed ? `, mais ${euros(fam.jar.owed)} por pagar` : ''}</p>
        </div>
        <div style={{ width: '100%' }} className="stack-sm">
          <div className="row between small"><span className="strong row-sm"><ForkKnife size={18} /> {s.goal_name}</span><span className="num muted">{euros(fam.jar.potential)} de {euros(s.goal_cents)}</span></div>
          <Bar value={level} tone="gold" label="Meta do jarro" />
        </div>
      </section>

      {myRisk > 0 ? (
        <div className="card danger"><p className="strong">Atenção: tens {euros(myRisk)} em risco este mês</p><p className="small" style={{ color: 'var(--ink-2)' }}>Recupera um dos dias falhados antes do fim do mês e o risco desaparece.</p></div>
      ) : (
        <div className="card accent row"><CheckCircle size={26} weight="fill" color="var(--accent-text)" /><p className="small grow">Este mês estás livre de multas. Continua assim.</p></div>
      )}

      <section className="stack">
        <h2>Por pagar</h2>
        {owed.length ? (
          <div className="list">
            {owed.map(({ profile, cents }) => (
              <div key={profile.id} className="list-item">
                <Avatar avatar={profile.avatar} color={profile.color} name={profile.display_name} size={40} />
                <div className="grow"><p className="strong">{profile.display_name}</p><p className="small muted num">{euros(cents)}</p></div>
                {isAdmin && <button className="btn secondary sm" onClick={() => setPayFor(profile.id)}><Coins size={18} weight="bold" /> Pagou</button>}
              </div>
            ))}
          </div>
        ) : (
          <div className="card soft"><p className="small muted">Ninguém deve nada. O jarro está em dia.</p></div>
        )}
        {!isAdmin && owed.some((o) => o.profile.id === me.id) && <p className="small muted">Mete a moeda no jarro (ou MB Way a quem o guarda) e avisa o admin para marcar como pago.</p>}
      </section>

      <ConfirmSheet open={!!payFor} onClose={() => setPayFor(null)} title="Registar pagamento?"
        text={payFor ? `${byId.get(payFor)?.display_name} meteu ${euros(owed.find((o) => o.profile.id === payFor)?.cents ?? 0)} no jarro. Todas as multas por pagar ficam como pagas.` : ''}
        confirm="Sim, pagou" onConfirm={() => { if (payFor) void markPaid(payFor) }} />

      <Sheet open={rules} onClose={() => setRules(false)} title="Regras do jarro">
        <ul className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>Cada pessoa marca pelo menos {me.min_days_week} dias por semana (1 nas semanas cortadas do mês). Planeia-se de dia 1 a {s.plan_window_end_day}.</li>
          <li>Os dias mudam-se quando quiseres, dentro do mesmo mês. Um dia que passou sem treino fica "por recuperar".</li>
          <li>No dia 1 fecha-se o mês anterior. Cada falha a partir da segunda seguida custa {euros(s.penalty_cents)}.</li>
          <li>Um treino feito, ou uma desculpa aprovada, põe o contador a zero. O contador não passa de um mês para o outro.</li>
          <li>Máximo de {euros(s.monthly_cap_cents)} por pessoa por mês.</li>
          <li>Desculpas (doente, lesão, viagem) são aprovadas pelo admin. Se ninguém decidir até dia {s.excuse_auto_day}, ficam aceites.</li>
          <li>Para contar, o treino precisa de uma foto tirada no fim. Só contam treinos lá em baixo.</li>
          <li>O dinheiro é gasto em conjunto: {s.goal_name}.</li>
        </ul>
      </Sheet>

      <section className="stack">
        <h2>Histórico</h2>
        {history.length ? (
          <div className="list">
            {history.slice(0, 50).map((j) => {
              const p = j.profile_id ? byId.get(j.profile_id) : null
              return (
                <div key={j.id} className="list-item" style={{ opacity: j.status === 'void' ? 0.5 : 1 }}>
                  {p ? <Avatar avatar={p.avatar} color={p.color} name={p.display_name} size={36} /> : <JarMascot size={30} level={0.3} bounce={false} />}
                  <div className="grow">
                    <p className="strong small">{j.kind === 'penalty' ? `${p?.display_name ?? ''}: multa${j.month_key ? ` de ${monthName(j.month_key)}` : ''}` : j.kind === 'spend' ? `Gasto: ${j.reason}` : j.reason}</p>
                    <p className="tiny muted">{j.kind === 'penalty' ? j.related_days.map(shortDate).join(' e ') : ''} {timeAgo(j.created_at)}</p>
                  </div>
                  <div className="center">
                    <p className={`num strong ${j.kind === 'spend' ? '' : ''}`} style={{ color: j.kind === 'spend' ? 'var(--ok)' : undefined, textDecoration: j.status === 'void' ? 'line-through' : undefined }}>{j.kind === 'spend' ? '-' : '+'}{euros(j.amount_cents)}</p>
                    <p className="tiny muted">{j.status === 'unpaid' ? 'por pagar' : j.status === 'void' ? 'anulada' : j.kind === 'penalty' ? 'paga' : ''}</p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <Empty title="O jarro ainda está vazio" text="Boa! Quando alguém falhar dois dias seguidos, a moeda aparece aqui." mood="happy" />
        )}
      </section>
    </main>
  )
}
