// Instalação como app (PWA). O Android/Chrome dá um evento para instalar; o iPhone só aceita pelo Safari (Partilhar > Adicionar ao ecrã principal).
interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: BIPEvent | null = null
const subs = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIPEvent; subs.forEach((f) => f()) })
  window.addEventListener('appinstalled', () => { deferred = null; subs.forEach((f) => f()) })
}

export const onInstallChange = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const canPrompt = () => !!deferred
export async function promptInstall() {
  if (!deferred) return false
  await deferred.prompt()
  const r = await deferred.userChoice
  deferred = null
  subs.forEach((f) => f())
  return r.outcome === 'accepted'
}

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}
export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
export function isIOSSafari() {
  return isIOS() && !/crios|fxios|edgios/i.test(navigator.userAgent)
}
