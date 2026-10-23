import { motion, AnimatePresence } from 'motion/react'
import { useEffect, useState } from 'react'
import { ArrowLeft, Backspace } from '@phosphor-icons/react'
import { useStore } from '../data/store'
import { api, isDemo } from '../lib/config'
import { Avatar } from '../components/Avatar'
import { JarMascot } from '../components/pixel/JarMascot'
import { sfx, vibrate } from '../lib/fx'
import { resetDemo } from '../data/demoApi'
import type { LoginProfile } from '../data/types'
import { PERSON_COLORS } from '../data/seed'

export function Login() {
  const { signIn } = useStore()
  const [people, setPeople] = useState<LoginProfile[] | null>(null)
  const [who, setWho] = useState<LoginProfile | null>(null)
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  useEffect(() => {
    api.listLoginProfiles().then(setPeople).catch((e) => setLoadErr((e as Error).message))
  }, [])

  useEffect(() => {
    if (code.length !== 6 || !who) return
    setBusy(true)
    signIn(who.username, code)
      .catch((e) => {
        setErr((e as Error).message)
        vibrate([40, 40, 40])
        sfx.sad()
        setCode('')
      })
      .finally(() => setBusy(false))
  }, [code, who, signIn])

  useEffect(() => {
    if (!who) return
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') setCode((c) => c.slice(0, -1))
      else if (e.key === 'Escape') { setWho(null); setCode('') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const press = (d: string) => {
    sfx.unlock()
    sfx.tap()
    setErr(null)
    setCode((c) => (c.length < 6 ? c + d : c))
  }

  if (loadErr) {
    return (
      <main className="page no-nav" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
        <div className="empty"><JarMascot mood="sad" size={90} /><h2>Não consegui ligar</h2><p className="muted">{loadErr}</p><button className="btn primary" onClick={() => location.reload()}>Tentar outra vez</button></div>
      </main>
    )
  }

  if (people && people.length === 0 && api.bootstrapAdmin) return <Bootstrap />

  return (
    <main className="page no-nav" style={{ minHeight: '100dvh' }}>
      <AnimatePresence mode="wait">
        {!who ? (
          <motion.section key="who" className="stack" style={{ gap: 24 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <div className="row" style={{ gap: 16, marginTop: 24 }}>
              <JarMascot mood="happy" level={0.4} size={70} />
              <div>
                <h1>Treino em Casa</h1>
                <p className="muted">Quem vai treinar?</p>
              </div>
            </div>
            {isDemo && (
              <div className="demo-banner">
                <strong>Modo demo.</strong> Os dados ficam só neste browser. O código de todos é <strong className="num">123456</strong>.
              </div>
            )}
            <div className="grid-2">
              {(people ?? Array.from({ length: 4 }, () => null)).map((p, i) =>
                p ? (
                  <button key={p.id} className="card tap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 20 }} onClick={() => { sfx.unlock(); setWho(p) }}>
                    <Avatar avatar={p.avatar} color={p.color} name={p.display_name} size={76} />
                    <span className="strong" style={{ fontSize: 18 }}>{p.display_name}</span>
                  </button>
                ) : (
                  <div key={i} className="skeleton" style={{ height: 150 }} />
                ),
              )}
            </div>
            {isDemo && (
              <button className="btn ghost sm" style={{ alignSelf: 'center' }} onClick={() => { resetDemo(); location.reload() }}>Repor dados de demonstração</button>
            )}
          </motion.section>
        ) : (
          <motion.section key="code" className="stack" style={{ gap: 20, alignItems: 'center' }} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}>
            <div className="topbar" style={{ width: '100%' }}>
              <button className="icon-btn" aria-label="Voltar" onClick={() => { setWho(null); setCode(''); setErr(null) }}><ArrowLeft size={22} weight="bold" /></button>
            </div>
            <Avatar avatar={who.avatar} color={who.color} name={who.display_name} size={88} ring />
            <h1>Olá, {who.display_name}</h1>
            <p className="muted">Escreve o teu código de 6 dígitos.</p>
            <motion.div className="row" style={{ gap: 10 }} animate={err ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }} aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} style={{ width: 18, height: 18, borderRadius: 5, background: i < code.length ? 'var(--ink)' : 'var(--surface-2)', transition: 'background .15s' }} />
              ))}
            </motion.div>
            <p className="sr-only" aria-live="polite">{code.length} de 6 dígitos</p>
            <p role="alert" style={{ minHeight: 22, color: 'var(--danger)', fontWeight: 600 }}>{busy ? 'A entrar…' : err}</p>
            <div className="grid-3" style={{ width: '100%', maxWidth: 340, gap: 12 }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button key={d} className="btn huge secondary num" onClick={() => press(d)} disabled={busy}>{d}</button>
              ))}
              <span />
              <button className="btn huge secondary num" onClick={() => press('0')} disabled={busy}>0</button>
              <button className="btn huge ghost" aria-label="Apagar" onClick={() => setCode((c) => c.slice(0, -1))} disabled={busy}><Backspace size={28} /></button>
            </div>
            <p className="small muted center">Esqueceste o código? Pede ao admin para gerar um novo.</p>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  )
}

function Bootstrap() {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setErr(null)
    if (!/^[a-z0-9._-]{2,20}$/.test(username)) return setErr('O nome de utilizador só pode ter letras minúsculas, números, ponto e hífen.')
    if (!/^\d{6}$/.test(code)) return setErr('O código tem de ter 6 dígitos.')
    setBusy(true)
    try {
      await api.bootstrapAdmin!({ username, display_name: name || username, code, avatar: '', color: PERSON_COLORS[0], role: 'admin', min_days_week: 2 })
      location.reload()
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <main className="page no-nav">
      <div className="row" style={{ gap: 16, marginTop: 24 }}>
        <JarMascot mood="wow" level={0} size={70} />
        <div><h1>Primeira vez</h1><p className="muted">Cria a conta de admin. Depois crias as outras pessoas no backoffice.</p></div>
      </div>
      <label className="field"><span>O teu nome</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
      <label className="field"><span>Nome de utilizador</span><input className="input" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoCapitalize="none" autoComplete="username" autoCorrect="off" spellCheck={false} /><span className="help">Por exemplo: bruno</span></label>
      <label className="field"><span>Código de 6 dígitos</span><input className="input num" inputMode="numeric" maxLength={6} autoComplete="new-password" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></label>
      {err && <p role="alert" style={{ color: 'var(--danger)', fontWeight: 600 }}>{err}</p>}
      <button className="btn primary big" onClick={submit} disabled={busy}>{busy ? 'A criar…' : 'Criar conta de admin'}</button>
    </main>
  )
}
