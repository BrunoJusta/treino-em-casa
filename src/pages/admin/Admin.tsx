import { useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Check, DownloadSimple, X } from '@phosphor-icons/react'
import { useApp } from '../../data/store'
import { api } from '../../lib/config'
import { Avatar } from '../../components/Avatar'
import { BackHeader, ConfirmSheet, Empty, Sheet, Switch } from '../../components/ui'
import { EXCUSE_LABEL } from '../../components/DayActions'
import { euros, jarTotals } from '../../lib/rules/jar'
import { longDate, monthLabel, timeAgo, todayLisbon } from '../../lib/dates'
import { AdminPeople } from './AdminPeople'
import { AdminEquipment } from './AdminEquipment'
import { AdminExercises } from './AdminExercises'
import type { JarEntry } from '../../data/types'

const TABS = [
  ['', 'Resumo'],
  ['desculpas', 'Desculpas'],
  ['pessoas', 'Pessoas'],
  ['material', 'Material'],
  ['exercicios', 'Exercícios'],
  ['jarro', 'Jarro'],
  ['regras', 'Regras'],
  ['auditoria', 'Registo'],
  ['exportar', 'Exportar'],
  ['repor', 'Repor'],
] as const

export function Admin() {
  const { isAdmin, snap } = useApp()
  if (!isAdmin) return <Navigate to="/" replace />
  const pending = snap.excuses.filter((e) => e.status === 'pending').length
  return (
    <main className="page no-nav">
      <BackHeader title="Backoffice" to="/" />
      <nav className="admin-nav" aria-label="Secções do backoffice">
        {TABS.map(([to, label]) => (
          <NavLink key={to} to={`/admin/${to}`} end={to === ''} className={({ isActive }) => `chip ${isActive ? 'on' : ''}`} style={{ textDecoration: 'none', minHeight: 40 }}>
            {label}{to === 'desculpas' && pending > 0 ? ` (${pending})` : ''}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Resumo />} />
        <Route path="desculpas" element={<Desculpas />} />
        <Route path="pessoas" element={<AdminPeople />} />
        <Route path="material" element={<AdminEquipment />} />
        <Route path="exercicios" element={<AdminExercises />} />
        <Route path="jarro" element={<JarAdmin />} />
        <Route path="regras" element={<Regras />} />
        <Route path="auditoria" element={<Auditoria />} />
        <Route path="exportar" element={<Exportar />} />
        <Route path="repor" element={<Repor />} />
      </Routes>
    </main>
  )
}

function Resumo() {
  const { snap, exercises } = useApp()
  const t = jarTotals(snap.jar)
  const pending = snap.excuses.filter((e) => e.status === 'pending')
  const unreviewed = exercises.filter((e) => !e.reviewed && !e.hidden).length
  return (
    <section className="stack">
      <div className="grid-2">
        <div className="stat"><b className="num">{snap.profiles.filter((p) => p.active).length}</b><span>pessoas ativas</span></div>
        <div className="stat"><b className="num">{pending.length}</b><span>desculpas por decidir</span></div>
        <div className="stat"><b className="num">{euros(t.balance)}</b><span>no jarro</span></div>
        <div className="stat"><b className="num">{euros(t.owed)}</b><span>por pagar</span></div>
        <div className="stat"><b className="num">{snap.equipment.filter((e) => e.status === 'arriving').length}</b><span>equipamentos a chegar</span></div>
        <div className="stat"><b className="num">{unreviewed}</b><span>exercícios por rever</span></div>
      </div>
      <div className="card soft stack-sm">
        <h3>Como funciona a manutenção</h3>
        <p className="small" style={{ color: 'var(--ink-2)' }}>De hora a hora o servidor confirma: aceita as desculpas pendentes do mês anterior a partir do dia {snap.settings.excuse_auto_day + 1}, fecha os meses anteriores (falhas e multas), e a partir do dia {snap.settings.plan_window_end_day + 1} completa as semanas de quem não planeou. Correr várias vezes não duplica nada.</p>
      </div>
    </section>
  )
}

function Desculpas() {
  const { snap, me, run } = useApp()
  const byId = new Map(snap.profiles.map((p) => [p.id, p]))
  const pending = snap.excuses.filter((e) => e.status === 'pending').sort((a, b) => (a.date < b.date ? -1 : 1))
  const decided = snap.excuses.filter((e) => e.status !== 'pending').sort((a, b) => ((a.decided_at ?? '') < (b.decided_at ?? '') ? 1 : -1)).slice(0, 30)
  return (
    <section className="stack">
      <h2>Por decidir</h2>
      {pending.length ? pending.map((e) => {
        const p = byId.get(e.profile_id)!
        const own = e.profile_id === me.id
        return (
          <div key={e.id} className="card stack">
            <div className="row">
              <Avatar avatar={p.avatar} color={p.color} name={p.display_name} size={44} />
              <div className="grow"><p className="strong">{p.display_name}: {EXCUSE_LABEL[e.type]}</p><p className="small muted">{longDate(e.date)}</p></div>
            </div>
            {e.note && <p className="card soft small">{e.note}</p>}
            {own && <p className="small" style={{ color: 'var(--warn)' }}>É uma desculpa tua. Se a aprovares, fica registado no histórico e no feed.</p>}
            <div className="row">
              <button className="btn danger grow" onClick={() => run(() => api.decideExcuse(e.id, false), 'Desculpa recusada')}><X size={20} weight="bold" /> Recusar</button>
              <button className="btn primary grow" onClick={() => run(() => api.decideExcuse(e.id, true), 'Desculpa aprovada')}><Check size={20} weight="bold" /> Aprovar</button>
            </div>
          </div>
        )
      }) : <Empty title="Nada para decidir" mood="happy" />}
      {decided.length > 0 && (
        <>
          <h2>Decididas</h2>
          <div className="list">
            {decided.map((e) => (
              <div key={e.id} className="list-item">
                <div className="grow"><p className="small strong">{byId.get(e.profile_id)?.display_name}: {EXCUSE_LABEL[e.type]}, {longDate(e.date)}</p><p className="tiny muted">{e.auto ? 'Aceite automaticamente no prazo' : `Por ${byId.get(e.decided_by ?? '')?.display_name ?? 'admin'}`}</p></div>
                <span className={`chip ${e.status === 'approved' ? 'ok' : 'danger'}`}>{e.status === 'approved' ? 'Aprovada' : 'Recusada'}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function JarAdmin() {
  const { snap, run, toast } = useApp()
  const [kind, setKind] = useState<'spend' | 'adjust'>('spend')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [voiding, setVoiding] = useState<JarEntry | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const byId = new Map(snap.profiles.map((p) => [p.id, p]))
  const add = async () => {
    const cents = Math.round(Number(amount.replace(',', '.')) * 100)
    if (!Number.isFinite(cents) || cents <= 0) return toast('Escreve um valor em euros, por exemplo 12,50.', 'error')
    if (!reason.trim()) return toast('Escreve o motivo.', 'error')
    await run(() => api.addJarEntry({ kind, amount_cents: cents, reason: reason.trim(), profile_id: null }), kind === 'spend' ? 'Gasto registado' : 'Ajuste registado')
    setAmount('')
    setReason('')
  }
  return (
    <section className="stack">
      <div className="card stack">
        <h3>Registar movimento</h3>
        <div className="seg"><button aria-pressed={kind === 'spend'} onClick={() => setKind('spend')}>Gasto</button><button aria-pressed={kind === 'adjust'} onClick={() => setKind('adjust')}>Ajuste (entrada)</button></div>
        <div className="row-sm">
          <label className="field" style={{ width: 120 }}><span>Valor (€)</span><input className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <label className="field grow"><span>Motivo</span><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={kind === 'spend' ? 'Jantar de Natal' : 'Moedas que já lá estavam'} /></label>
        </div>
        <button className="btn primary block" onClick={add}>Registar</button>
      </div>
      <h2>Multas</h2>
      <div className="list">
        {snap.jar.filter((j) => j.kind === 'penalty').sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).map((j) => (
          <div key={j.id} className="list-item">
            <div className="grow">
              <p className="small strong">{byId.get(j.profile_id ?? '')?.display_name}: {euros(j.amount_cents)}{j.month_key ? ` (${monthLabel(j.month_key)})` : ''}</p>
              <p className="tiny muted">{j.reason}</p>
            </div>
            <span className={`chip ${j.status === 'paid' ? 'ok' : j.status === 'void' ? '' : 'warn'}`}>{j.status === 'paid' ? 'Paga' : j.status === 'void' ? 'Anulada' : 'Por pagar'}</span>
            {j.status === 'unpaid' && <button className="btn sm secondary" onClick={() => run(() => api.setJarEntryStatus(j.id, 'paid'), 'Marcada como paga')}>Paga</button>}
            {j.status !== 'void' && <button className="btn sm ghost" onClick={() => setVoiding(j)}>Anular</button>}
          </div>
        ))}
      </div>
      <Sheet open={!!voiding} onClose={() => setVoiding(null)} title="Anular multa">
        <p className="muted">Fica registado no histórico com o motivo. Usa só quando houve um erro.</p>
        <label className="field"><span>Motivo</span><input className="input" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} /></label>
        <button className="btn danger big block" disabled={!voidReason.trim()} onClick={() => run(() => api.setJarEntryStatus(voiding!.id, 'void', voidReason.trim()), 'Multa anulada').then(() => { setVoiding(null); setVoidReason('') })}>Anular</button>
      </Sheet>
    </section>
  )
}

function Regras() {
  const { snap, run, toast } = useApp()
  const s = snap.settings
  const [form, setForm] = useState({ ...s })
  const num = (k: keyof typeof form, v: string, cents = false) => setForm((f) => ({ ...f, [k]: cents ? Math.round(Number(v.replace(',', '.')) * 100) : Number(v) }))
  return (
    <section className="stack">
      <div className="card stack">
        <h3>Jarro</h3>
        <div className="grid-2">
          <label className="field"><span>Multa (€)</span><input className="input num" inputMode="decimal" defaultValue={s.penalty_cents / 100} onChange={(e) => num('penalty_cents', e.target.value, true)} /></label>
          <label className="field"><span>A partir da falha n.º</span><input className="input num" inputMode="numeric" defaultValue={s.consecutive_misses} onChange={(e) => num('consecutive_misses', e.target.value)} /><span className="help">2 = cada falha a partir da segunda seguida</span></label>
          <label className="field"><span>Teto por mês (€)</span><input className="input num" inputMode="decimal" defaultValue={s.monthly_cap_cents / 100} onChange={(e) => num('monthly_cap_cents', e.target.value, true)} /></label>
          <label className="field"><span>Planear até ao dia</span><input className="input num" inputMode="numeric" defaultValue={s.plan_window_end_day} onChange={(e) => num('plan_window_end_day', e.target.value)} /></label>
          <label className="field"><span>Desculpas aceites no dia</span><input className="input num" inputMode="numeric" defaultValue={s.excuse_auto_day} onChange={(e) => num('excuse_auto_day', e.target.value)} /><span className="help">do mês seguinte, às 23h59</span></label>
        </div>
      </div>
      <div className="card stack">
        <h3>Metas</h3>
        <label className="field"><span>Meta do jarro</span><input className="input" defaultValue={s.goal_name} onChange={(e) => setForm((f) => ({ ...f, goal_name: e.target.value }))} /></label>
        <label className="field"><span>Valor da meta (€)</span><input className="input num" inputMode="decimal" defaultValue={s.goal_cents / 100} onChange={(e) => num('goal_cents', e.target.value, true)} /></label>
        <label className="field"><span>Meta mensal da família (treinos)</span><input className="input num" inputMode="numeric" defaultValue={s.family_goal_sessions} onChange={(e) => num('family_goal_sessions', e.target.value)} /></label>
        <label className="field"><span>Prémio da meta</span><input className="input" defaultValue={s.family_goal_reward} onChange={(e) => setForm((f) => ({ ...f, family_goal_reward: e.target.value }))} /></label>
      </div>
      <button className="btn primary big block" onClick={() => {
        const bad = Object.entries(form).some(([, v]) => typeof v === 'number' && (!Number.isFinite(v) || v < 0))
        if (bad || form.consecutive_misses < 1 || form.plan_window_end_day < 1 || form.plan_window_end_day > 28 || form.excuse_auto_day < 1 || form.excuse_auto_day > 28) return toast('Há um valor inválido. Confirma os números (dias entre 1 e 28).', 'error')
        void run(() => api.updateSettings(form), 'Regras guardadas')
      }}>Guardar regras</button>
      <p className="small muted">As mudanças valem para os fechos de mês que ainda não aconteceram. Tudo fica no registo.</p>
    </section>
  )
}

function Auditoria() {
  const { snap } = useApp()
  const byId = new Map(snap.profiles.map((p) => [p.id, p]))
  const rows = [...snap.audit].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 200)
  return (
    <section className="stack">
      <p className="small muted">Quem mudou o quê. Há dinheiro envolvido, por isso fica tudo registado.</p>
      {rows.length ? (
        <div className="list">
          {rows.map((a) => (
            <div key={a.id} className="list-item" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <p className="small"><strong>{a.actor_id ? byId.get(a.actor_id)?.display_name ?? 'Alguém' : 'Sistema'}</strong> {a.detail}</p>
                <p className="tiny muted">{a.action}, {timeAgo(a.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : <Empty title="Ainda sem registos" />}
    </section>
  )
}

function csv(rows: (string | number | null)[][]) {
  return rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
}
function download(name: string, content: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function Exportar() {
  const { snap } = useApp()
  const byId = new Map(snap.profiles.map((p) => [p.id, p.display_name]))
  const stamp = todayLisbon()
  return (
    <section className="stack">
      <p className="small muted">Ficheiros CSV com ponto e vírgula, prontos para abrir no Excel.</p>
      <button className="btn secondary big block" onClick={() => download(`treinos-${stamp}.csv`, csv([['Pessoa', 'Dia', 'Início', 'Fim', 'Minutos', 'Tipo', 'Plano', 'Completo'], ...snap.sessions.map((s) => [byId.get(s.profile_id) ?? '', s.date, s.started_at, s.ended_at, s.minutes, s.kind === 'guided' ? 'Guiado' : 'Rápido', snap.plans.find((p) => p.id === s.plan_id)?.name ?? '', s.completed_all ? 'Sim' : 'Não'])]))}>
        <DownloadSimple size={22} weight="bold" /> Treinos
      </button>
      <button className="btn secondary big block" onClick={() => download(`jarro-${stamp}.csv`, csv([['Data', 'Pessoa', 'Tipo', 'Valor (€)', 'Estado', 'Motivo', 'Dias'], ...snap.jar.map((j) => [j.created_at, byId.get(j.profile_id ?? '') ?? '', j.kind, (j.amount_cents / 100).toFixed(2).replace('.', ','), j.status, j.reason, j.related_days.join(' ')])]))}>
        <DownloadSimple size={22} weight="bold" /> Jarro
      </button>
      <button className="btn secondary big block" onClick={() => download(`dias-marcados-${stamp}.csv`, csv([['Pessoa', 'Dia', 'Estado', 'Automático', 'Mudado de'], ...snap.plannedDays.map((d) => [byId.get(d.profile_id) ?? '', d.date, d.status, d.auto_filled ? 'Sim' : 'Não', d.moved_from ?? ''])]))}>
        <DownloadSimple size={22} weight="bold" /> Dias marcados
      </button>
    </section>
  )
}

function Repor() {
  const { snap, run } = useApp()
  const [body, setBody] = useState(false)
  const [word, setWord] = useState('')
  const [done, setDone] = useState(false)
  const n = { sessions: snap.sessions.length, days: snap.plannedDays.length, jar: snap.jar.length, excuses: snap.excuses.length }
  const go = async () => {
    const ok = await run(() => api.resetActivity(body).then(() => true), 'Dados repostos')
    if (ok) { setDone(true); setWord('') }
  }
  return (
    <section className="stack">
      <div className="card danger stack-sm">
        <h3>Repor os dados da família</h3>
        <p className="small" style={{ color: 'var(--ink-2)' }}>Para depois de testares ou mostrares a app. Apaga a atividade de toda a gente e deixa a app como nova.</p>
      </div>
      <div className="grid-2">
        <div className="stat"><b className="num">{n.sessions}</b><span>treinos e fotos</span></div>
        <div className="stat"><b className="num">{n.days}</b><span>dias marcados</span></div>
        <div className="stat"><b className="num">{n.jar}</b><span>movimentos do jarro</span></div>
        <div className="stat"><b className="num">{n.excuses}</b><span>desculpas</span></div>
      </div>
      <div className="card soft stack-sm">
        <p className="strong">O que é apagado</p>
        <p className="small" style={{ color: 'var(--ink-2)' }}>Treinos e as respetivas fotos, caminhadas, dias marcados, desculpas, multas, pagamentos e gastos do jarro, reações, fechos de mês e o registo de atividade. O XP, os níveis, os streaks e as conquistas voltam a zero, porque são calculados a partir dos treinos.</p>
        <p className="strong" style={{ marginTop: 6 }}>O que fica</p>
        <p className="small" style={{ color: 'var(--ink-2)' }}>As pessoas e os códigos de acesso, as fotos de perfil, as restrições, o material, os planos, as regras do jarro e as correções aos exercícios.</p>
      </div>
      <label className="row between">
        <span><span className="strong">Apagar também o peso e o IMC</span><br /><span className="small muted">São dados privados de cada pessoa. Por omissão ficam.</span></span>
        <Switch checked={body} onChange={setBody} label="Apagar também o peso e o IMC" />
      </label>
      <label className="field">
        <span>Para confirmar, escreve REPOR</span>
        <input className="input" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
        <span className="help">Não dá para desfazer. Se quiseres guardar alguma coisa, exporta antes em Exportar.</span>
      </label>
      <button className="btn danger big block" disabled={word.trim().toUpperCase() !== 'REPOR'} onClick={go}>Repor tudo</button>
      {done && <p role="status" className="card accent small">Feito. A app está como nova. Os dias de cada pessoa começam a ser marcados outra vez em Planear.</p>}

      <WalksReset />
    </section>
  )
}

// Só as caminhadas: para testar o módulo e limpar depois, sem mexer no resto.
function WalksReset() {
  const { snap, run } = useApp()
  const [open, setOpen] = useState(false)
  const n = (snap.walks ?? []).length
  return (
    <div className="card walk stack-sm" style={{ marginTop: 12 }}>
      <h3>Apagar todas as caminhadas</h3>
      <p className="small" style={{ color: 'var(--ink-2)' }}>Apaga as caminhadas de toda a gente ({n} {n === 1 ? 'registada' : 'registadas'}), que saem do feed, e as conquistas das caminhadas voltam a zero. Os treinos e o resto ficam como estão.</p>
      <button className="btn danger block" disabled={!n} onClick={() => setOpen(true)}>Apagar as caminhadas</button>
      <ConfirmSheet open={open} onClose={() => setOpen(false)} title="Apagar todas as caminhadas?" danger
        text={`Vão ser apagadas ${n} ${n === 1 ? 'caminhada' : 'caminhadas'} de toda a família. Não dá para desfazer.`}
        confirm="Sim, apagar" onConfirm={() => { setOpen(false); void run(() => api.deleteAllWalks(), 'Caminhadas apagadas') }} />
    </div>
  )
}
