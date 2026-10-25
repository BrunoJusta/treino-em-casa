// Manter o ecrã ligado durante a caminhada.
// 1.º tenta o Wake Lock do browser; se não der (algumas versões do iOS nas apps instaladas),
// usa o plano B do NoSleep.js: um vídeo minúsculo, invisível e sem som, a repetir em fundo.
import NoSleep from 'nosleep.js'

export type AwakeStatus = 'off' | 'native' | 'fallback' | 'failed'

interface Sentinel { release: () => Promise<void>; addEventListener?: (t: 'release', cb: () => void) => void }
interface WakeLockApi { request: (t: 'screen') => Promise<Sentinel> }

export interface ScreenAwake {
  enable(): Promise<AwakeStatus> // chamar dentro de um toque (Começar, Continuar, ligar a opção)
  disable(): void
  status(): AwakeStatus
  onChange(cb: (s: AwakeStatus) => void): () => void
  destroy(): void // ao sair do ecrã
}

export interface AwakeDeps {
  wakeLock?: WakeLockApi | null
  makeNoSleep?: () => { enable: () => Promise<void>; disable: () => void; isEnabled: boolean }
  doc?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>
}

export function createScreenAwake(deps: AwakeDeps = {}): ScreenAwake {
  const wl: WakeLockApi | null = deps.wakeLock !== undefined
    ? deps.wakeLock
    : ((typeof navigator !== 'undefined' && (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock) || null)
  const doc = deps.doc ?? (typeof document !== 'undefined' ? document : undefined)
  let state: AwakeStatus = 'off'
  let wanted = false
  let sentinel: Sentinel | null = null
  let noSleep: ReturnType<NonNullable<AwakeDeps['makeNoSleep']>> | null = null
  let retried = false
  const listeners = new Set<(s: AwakeStatus) => void>()
  const set = (s: AwakeStatus) => { if (s !== state) { state = s; listeners.forEach((l) => l(s)) } }

  const tryNative = async (): Promise<boolean> => {
    if (!wl) return false
    try {
      sentinel = await wl.request('screen')
      sentinel.addEventListener?.('release', () => {
        sentinel = null
        // o sistema soltou o pedido com a app à vista: tenta outra vez uma vez
        if (wanted && doc?.visibilityState === 'visible' && !retried) {
          retried = true
          void tryNative().then((ok) => { if (!ok && state === 'native') set('failed') })
        }
      })
      return true
    } catch { return false }
  }

  const tryFallback = async (): Promise<boolean> => {
    try {
      noSleep ??= deps.makeNoSleep ? deps.makeNoSleep() : (new NoSleep() as unknown as NonNullable<typeof noSleep>)
      await noSleep.enable()
      return noSleep.isEnabled
    } catch { return false }
  }

  // ao voltar à app, o pedido foi solto pelo sistema: pede outra vez
  const onVisible = () => {
    if (!wanted || doc?.visibilityState !== 'visible' || state !== 'native' || sentinel) return
    retried = false
    void tryNative().then((ok) => { if (!ok) set('failed') })
  }
  doc?.addEventListener('visibilitychange', onVisible)

  return {
    async enable() {
      wanted = true
      retried = false
      if (state === 'native' && sentinel) return state
      if (state === 'fallback' && noSleep?.isEnabled) return state
      if (await tryNative()) set('native')
      else if (await tryFallback()) set('fallback')
      else set('failed')
      return state
    },
    disable() {
      wanted = false
      void sentinel?.release().catch(() => {})
      sentinel = null
      try { noSleep?.disable() } catch { /* nada */ }
      set('off')
    },
    status: () => state,
    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb) },
    destroy() { this.disable(); doc?.removeEventListener('visibilitychange', onVisible); listeners.clear() },
  }
}
