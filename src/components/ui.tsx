import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ArrowLeft, Barbell, CalendarDots, House, UsersThree, X } from '@phosphor-icons/react'
import { useStore } from '../data/store'
import { PixelIcon } from './pixel/Pixel'
import { JarMascot } from './pixel/JarMascot'
import { PATTERN_ICON } from './pixel/sprites'
import { pixelConfetti, sfx } from '../lib/fx'
import type { Exercise } from '../data/types'
import { api } from '../lib/config'

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const focusables = () => [...(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])]
    const t = setTimeout(() => (focusables()[0] ?? ref.current)?.focus(), 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
      if (e.key === 'Tab') {
        const f = focusables()
        if (!f.length) return
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1)!.focus() }
        else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; opener?.focus?.() }
  }, [open])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            ref={ref}
            tabIndex={-1}
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grab" aria-hidden />
            {title && (
              <div className="sheet-head">
                <h2>{title}</h2>
                <button className="icon-btn plain" onClick={onClose} aria-label="Fechar"><X size={22} weight="bold" /></button>
              </div>
            )}
            {children}
            {footer}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function BottomNav() {
  const { snap, me, isAdmin } = useStore()
  const pending = isAdmin ? snap?.excuses.filter((e) => e.status === 'pending').length ?? 0 : 0
  const owed = snap && me ? snap.jar.filter((j) => j.profile_id === me.id && j.kind === 'penalty' && j.status === 'unpaid').length : 0
  const items = [
    { to: '/', label: 'Hoje', icon: <House size={22} weight="bold" />, end: true },
    { to: '/calendario', label: 'Calendário', icon: <CalendarDots size={22} weight="bold" /> },
    { to: '/treinos', label: 'Treinos', icon: <Barbell size={22} weight="bold" /> },
    { to: '/jarro', label: 'Jarro', icon: <PixelIcon name="jar" size={22} />, badge: owed },
    { to: '/familia', label: 'Família', icon: <UsersThree size={22} weight="bold" />, badge: pending },
  ]
  return (
    <nav className="nav" aria-label="Navegação principal">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-ico">{i.icon}</span>
          {i.label}
          {!!i.badge && <span className="dot"><span aria-hidden>{i.badge}</span><span className="sr-only">, {i.badge} por ver</span></span>}
        </NavLink>
      ))}
    </nav>
  )
}

export function BackHeader({ title, right, to }: { title: string; right?: ReactNode; to?: string }) {
  const nav = useNavigate()
  return (
    <header className="topbar">
      <button className="icon-btn" onClick={() => (to ? nav(to) : nav(-1))} aria-label="Voltar"><ArrowLeft size={22} weight="bold" /></button>
      {title ? <h1 style={{ fontSize: 22 }}>{title}</h1> : <span className="grow" />}
      {right}
    </header>
  )
}

export function Toasts() {
  const { toasts } = useStore()
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className={`toast ${t.tone ?? ''}`} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}>
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function CelebrationOverlay() {
  const { celebration, celebrate } = useStore()
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!celebration) return
    const t = setTimeout(() => btn.current?.focus(), 50)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && celebrate(null)
    window.addEventListener('keydown', onKey)
    const cleanup = () => { clearTimeout(t); window.removeEventListener('keydown', onKey) }
    if (celebration.kind === 'levelup') sfx.levelUp()
    else if (celebration.kind === 'coin') sfx.coin()
    else sfx.done()
    pixelConfetti()
    return cleanup
  }, [celebration, celebrate])
  return (
    <AnimatePresence>
      {celebration && (
        <motion.div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="celebrate-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => celebrate(null)}>
          <motion.div className="celebrate-card" initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
            <JarMascot mood={celebration.kind === 'coin' ? 'wow' : 'party'} level={0.5} size={130} />
            {celebration.kind === 'levelup' && <div className="pixel-frame pixel-type">Nível {celebration.level}</div>}
            <h1 id="celebrate-title">{celebration.title}</h1>
            {celebration.subtitle && <p className="muted">{celebration.subtitle}</p>}
            {!!celebration.xp && <div className="xp-pop num">+{celebration.xp} XP</div>}
            <button ref={btn} className="btn primary big block" onClick={() => celebrate(null)}>Continuar</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Bar({ value, tone, label }: { value: number; tone?: 'gold' | 'pixel'; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className={`bar ${tone ?? ''}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <i style={{ width: `${pct}%` }} />
    </div>
  )
}

export function ExerciseIcon({ ex, size = 44 }: { ex: Pick<Exercise, 'pattern' | 'equipment_ids'>; size?: number }) {
  const { snap } = useStore()
  const eq = ex.equipment_ids[0] ? snap?.equipment.find((e) => e.id === ex.equipment_ids[0]) : null
  return (
    <span style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'inline-block' }} aria-hidden>
      <span style={{ width: size, height: size, borderRadius: size * 0.3, background: 'var(--surface)', display: 'grid', placeItems: 'center' }}>
        <PixelIcon name={PATTERN_ICON[ex.pattern] ?? 'star'} size={size * 0.6} />
      </span>
      <span style={{ position: 'absolute', right: -4, bottom: -4, width: size * 0.48, height: size * 0.48, borderRadius: 8, background: '#fff', border: '1px solid var(--line)', display: 'grid', placeItems: 'center' }}>
        <PixelIcon name={eq?.icon ?? 'body'} size={size * 0.34} />
      </span>
    </span>
  )
}

export function Empty({ title, text, action, mood = 'sleepy' }: { title: string; text?: string; action?: ReactNode; mood?: 'sleepy' | 'happy' | 'sad' }) {
  return (
    <div className="empty">
      <JarMascot mood={mood} level={0.1} size={84} bounce={false} />
      <h3>{title}</h3>
      {text && <p className="small muted" style={{ maxWidth: '34ch' }}>{text}</p>}
      {action}
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  )
}

export function Photo({ path, alt, className }: { path: string | null; alt: string; className?: string }) {
  const { snap } = useStore()
  const [url, setUrl] = useState<string>('')
  useEffect(() => {
    let alive = true
    if (!path) return
    api.photoUrl(path).then((u) => alive && setUrl(u))
    return () => { alive = false }
  }, [path, snap])
  if (!path) return null
  return url ? <img src={url} alt={alt} className={`${className ?? ''} ${path.startsWith('demo:') ? 'pixelated' : ''}`} loading="lazy" /> : <div className={`${className ?? ''} skeleton`} />
}

/** Confirmação para ações que não têm volta (dinheiro, códigos, apagar). */
export function ConfirmSheet({ open, title, text, confirm, danger, onConfirm, onClose }: { open: boolean; title: string; text: string; confirm: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p style={{ color: 'var(--ink-2)' }}>{text}</p>
      <div className="stack-sm">
        <button className={`btn ${danger ? 'danger' : 'primary'} big block`} onClick={() => { onConfirm(); onClose() }}>{confirm}</button>
        <button className="btn ghost block" onClick={onClose}>Cancelar</button>
      </div>
    </Sheet>
  )
}
