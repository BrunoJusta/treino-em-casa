import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '../lib/config'
import { todayLisbon } from '../lib/dates'
import { dayState, type DayState } from '../lib/rules/planning'
import { levelFor, xpFor } from '../lib/rules/game'
import baseExercises from './exercises.json'
import type { Exercise, PlannedDay, Profile, Snapshot } from './types'

export interface Toast {
  id: number
  text: string
  tone?: 'ok' | 'error' | 'info'
}

export interface Celebration {
  kind: 'workout' | 'levelup' | 'coin' | 'badge'
  title: string
  subtitle?: string
  xp?: number
  level?: string
}

interface Store {
  snap: Snapshot | null
  me: Profile | null
  today: string
  loading: boolean
  error: string | null
  exercises: Exercise[]
  exerciseById: Map<string, Exercise>
  closedMonths: Set<string>
  stateOf: (pd: PlannedDay) => DayState
  run: <T>(fn: () => Promise<T>, ok?: string) => Promise<T | undefined>
  reload: () => Promise<void>
  signIn: (username: string, code: string) => Promise<void>
  signOut: () => Promise<void>
  toasts: Toast[]
  toast: (text: string, tone?: Toast['tone']) => void
  celebration: Celebration | null
  celebrate: (c: Celebration | null) => void
  isAdmin: boolean
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [meId, setMeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [celebration, setCelebration] = useState<Celebration | null>(null)
  const [today, setToday] = useState(todayLisbon())
  const tid = useRef(0)

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++tid.current
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3200)
  }, [])

  const reload = useCallback(async () => {
    try {
      const s = await api.loadSnapshot()
      setSnap(s)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    let unsub = () => {}
    ;(async () => {
      const id = await api.restore()
      setMeId(id)
      if (id) {
        await api.runMaintenance(todayLisbon()).catch(() => {})
        await reload()
        unsub = api.subscribe(() => void reload())
      }
      setLoading(false)
    })()
    // muda de dia à meia-noite (e quando a app volta a primeiro plano)
    const tick = () => setToday(todayLisbon())
    const iv = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => { unsub(); clearInterval(iv); document.removeEventListener('visibilitychange', tick) }
  }, [reload])

  const signIn = useCallback(async (username: string, code: string) => {
    const id = await api.signIn(username, code)
    setMeId(id)
    setLoading(true)
    await api.runMaintenance(todayLisbon()).catch(() => {})
    await reload()
    api.subscribe(() => void reload())
    setLoading(false)
  }, [reload])

  const signOut = useCallback(async () => {
    await api.signOut()
    setMeId(null)
    setSnap(null)
  }, [])

  const me = useMemo(() => snap?.profiles.find((p) => p.id === meId) ?? null, [snap, meId])

  const exercises = useMemo(() => {
    const base = (baseExercises as Exercise[]).map((e) => ({ ...e, ...(snap?.exerciseOverrides[e.id] ?? {}) }))
    return [...base, ...(snap?.customExercises ?? [])]
  }, [snap])
  const exerciseById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  const closedMonths = useMemo(() => new Set((snap?.closures ?? []).map((c) => `${c.profile_id}:${c.month_key}`)), [snap])

  const stateOf = useCallback((pd: PlannedDay) => dayState(pd, today, snap?.sessions ?? [], snap?.excuses ?? [], closedMonths), [today, snap, closedMonths])

  const run = useCallback(async <T,>(fn: () => Promise<T>, ok?: string) => {
    try {
      const prevXp = me && snap ? xpFor(me, today, snap) : 0
      const r = await fn()
      const s = await api.loadSnapshot()
      setSnap(s)
      if (ok) toast(ok)
      if (me) {
        const meNow = s.profiles.find((p) => p.id === me.id)
        if (meNow) {
          const before = levelFor(prevXp)
          const after = levelFor(xpFor(meNow, today, s))
          if (after.index > before.index) setTimeout(() => setCelebration({ kind: 'levelup', title: 'Subiste de nível!', level: after.name, subtitle: `Agora és ${after.name}.` }), 2600)
        }
      }
      return r
    } catch (e) {
      toast((e as Error).message, 'error')
      return undefined
    }
  }, [toast, me, snap, today])

  const value: Store = {
    snap, me, today, loading, error, exercises, exerciseById, closedMonths, stateOf, run, reload, signIn, signOut,
    toasts, toast, celebration, celebrate: setCelebration, isAdmin: me?.role === 'admin',
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const c = useContext(Ctx)
  if (!c) throw new Error('StoreProvider em falta')
  return c
}

/** Para ecrãs que só aparecem com sessão iniciada. */
export function useApp() {
  const s = useStore()
  return s as Store & { snap: Snapshot; me: Profile }
}
