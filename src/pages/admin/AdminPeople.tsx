import { useState } from 'react'
import { Plus, Key, PencilSimple } from '@phosphor-icons/react'
import { useApp } from '../../data/store'
import { api } from '../../lib/config'
import { Avatar } from '../../components/Avatar'
import { AvatarUpload } from '../../components/AvatarUpload'
import { ConfirmSheet, Sheet, Switch } from '../../components/ui'
import { COLOR_NAMES, PERSON_COLORS } from '../../data/seed'
import type { Profile } from '../../data/types'

const genCode = () => String(Math.floor(100000 + Math.random() * 900000))

export function AdminPeople() {
  const { snap, me, run } = useApp()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [shownCode, setShownCode] = useState<{ name: string; username: string; code: string } | null>(null)
  const [form, setForm] = useState({ display_name: '', username: '', avatar: '', color: PERSON_COLORS[1], role: 'member' as 'member' | 'admin', min_days_week: 2 })

  const [formErr, setFormErr] = useState<string | null>(null)
  const create = async () => {
    const code = genCode()
    const username = form.username.trim().toLowerCase()
    if (!form.display_name.trim()) return setFormErr('Falta o nome.')
    if (!/^[a-z0-9._-]{2,20}$/.test(username)) return setFormErr('O nome de utilizador só pode ter letras minúsculas, números, ponto e hífen (2 a 20).')
    setFormErr(null)
    const ok = await run(() => api.createMember({ ...form, username, display_name: form.display_name.trim(), code }).then(() => true), 'Pessoa criada')
    if (ok) {
      setCreating(false)
      setShownCode({ name: form.display_name, username, code })
      setForm({ ...form, display_name: '', username: '' })
    }
  }

  return (
    <section className="stack">
      <div className="list">
        {snap.profiles.map((p) => (
          <div key={p.id} className="list-item" style={{ opacity: p.active ? 1 : 0.5 }}>
            <Avatar avatar={p.avatar} color={p.color} name={p.display_name} size={44} />
            <div className="grow">
              <p className="strong">{p.display_name} {p.role === 'admin' && <span className="chip on" style={{ fontSize: 12, padding: '2px 8px' }}>admin</span>}</p>
              <p className="small muted">@{p.username}, {p.min_days_week} dias por semana{p.active ? '' : ', inativa'}</p>
            </div>
            <button className="icon-btn" aria-label={`Editar ${p.display_name}`} onClick={() => setEditing(p)}><PencilSimple size={20} /></button>
          </div>
        ))}
      </div>
      <button className="btn primary big block" onClick={() => setCreating(true)}><Plus size={22} weight="bold" /> Juntar pessoa</button>

      <Sheet open={creating} onClose={() => setCreating(false)} title="Juntar pessoa">
        <label className="field"><span>Nome</span><input className="input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value, username: form.username || '' })} placeholder="Mãe" autoComplete="off" /></label>
        <label className="field"><span>Nome de utilizador</span><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })} autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="mae" /><span className="help">Letras minúsculas e números. Usado só por dentro da app.</span></label>
        <div className="field"><span>Cor no calendário</span>
          <div className="row-sm wrap">{PERSON_COLORS.map((c) => <button key={c} onClick={() => setForm({ ...form, color: c })} aria-label={COLOR_NAMES[c] ?? c} aria-pressed={form.color === c} style={{ width: 36, height: 36, borderRadius: 10, background: c, border: form.color === c ? '3px solid var(--ink)' : '3px solid #fff', boxShadow: '0 0 0 1px var(--line)' }} />)}</div>
        </div>
        <div className="grid-2">
          <label className="field"><span>Papel</span><select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'member' | 'admin' })}><option value="member">Membro</option><option value="admin">Admin</option></select></label>
          <label className="field"><span>Mínimo por semana</span><input className="input num" type="number" min={1} max={7} value={form.min_days_week} onChange={(e) => setForm({ ...form, min_days_week: Number(e.target.value) || 2 })} /></label>
        </div>
        {formErr && <p role="alert" style={{ color: 'var(--danger)', fontWeight: 600 }}>{formErr}</p>}
        <button className="btn primary big block" onClick={create}>Criar e gerar código</button>
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing ? `Editar ${editing.display_name}` : ''}>
        {editing && <EditPerson p={editing} self={editing.id === me.id} onDone={() => setEditing(null)} onCode={(code) => { setShownCode({ name: editing.display_name, username: editing.username, code }); setEditing(null) }} />}
      </Sheet>

      <Sheet open={!!shownCode} onClose={() => setShownCode(null)} title="Código de acesso">
        {shownCode && (
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
            <p>Dá este código a <strong>{shownCode.name}</strong>. Só aparece agora.</p>
            <p className="num" style={{ fontSize: 48, fontWeight: 800, letterSpacing: '0.12em' }}>{shownCode.code}</p>
            <p className="small muted">No ecrã de entrada toca no avatar e escreve o código. Depois pode mudá-lo no perfil.</p>
            <button className="btn primary big block" onClick={() => setShownCode(null)}>Já anotei</button>
          </div>
        )}
      </Sheet>
    </section>
  )
}

function EditPerson({ p, self, onDone, onCode }: { p: Profile; self: boolean; onDone: () => void; onCode: (c: string) => void }) {
  const { run } = useApp()
  const [ask, setAsk] = useState(false)
  const [f, setF] = useState({ display_name: p.display_name, color: p.color, role: p.role, min_days_week: p.min_days_week, active: p.active })
  return (
    <div className="stack">
      <div className="row"><AvatarUpload profile={p} size={72} /><p className="small muted grow">Toca na foto para carregar uma nova.</p></div>
      <label className="field"><span>Nome</span><input className="input" value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></label>
      <div className="field"><span>Cor</span>
        <div className="row-sm wrap">{PERSON_COLORS.map((c) => <button key={c} onClick={() => setF({ ...f, color: c })} aria-label={COLOR_NAMES[c] ?? c} aria-pressed={f.color === c} style={{ width: 36, height: 36, borderRadius: 10, background: c, border: f.color === c ? '3px solid var(--ink)' : '3px solid #fff', boxShadow: '0 0 0 1px var(--line)' }} />)}</div>
      </div>
      <div className="grid-2">
        <label className="field"><span>Papel</span><select className="select" value={f.role} disabled={self} onChange={(e) => setF({ ...f, role: e.target.value as Profile['role'] })}><option value="member">Membro</option><option value="admin">Admin</option></select></label>
        <label className="field"><span>Mínimo por semana</span><input className="input num" type="number" min={1} max={7} value={f.min_days_week} onChange={(e) => setF({ ...f, min_days_week: Number(e.target.value) || 2 })} /></label>
      </div>
      {!self && <label className="row between"><span className="strong">Ativa</span><Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Ativa" /></label>}
      {p.restrictions.length > 0 && <p className="small muted">Restrições: {p.restrictions.join(', ')}</p>}
      <button className="btn primary big block" onClick={() => run(() => api.updateProfile(p.id, f), 'Guardado').then(onDone)}>Guardar</button>
      <button className="btn secondary block" onClick={() => setAsk(true)}><Key size={20} /> Gerar código novo</button>
      <ConfirmSheet open={ask} onClose={() => setAsk(false)} title="Gerar código novo?" text={`O código atual de ${p.display_name} deixa de funcionar. Vais ver o novo a seguir, para lhe dar.`} confirm="Gerar código novo"
        onConfirm={() => { const c = genCode(); void run(() => api.resetCode(p.id, c).then(() => true), 'Código novo gerado').then((ok) => { if (ok) onCode(c) }) }} />
    </div>
  )
}
