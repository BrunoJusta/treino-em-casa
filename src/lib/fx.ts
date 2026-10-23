import confetti from 'canvas-confetti'

// Sons chiptune gerados com Web Audio (onda quadrada), sem ficheiros.
let ctx: AudioContext | null = null
function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.06) {
  const a = ac()
  if (!a) return
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(vol, a.currentTime + start)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur)
  o.connect(g).connect(a.destination)
  o.start(a.currentTime + start)
  o.stop(a.currentTime + start + dur + 0.02)
}

export const sfx = {
  tap: () => tone(880, 0, 0.04, 'square', 0.03),
  beep: () => tone(660, 0, 0.12),
  go: () => { tone(988, 0, 0.12); tone(1319, 0.12, 0.25) },
  coin: () => { tone(988, 0, 0.08); tone(1319, 0.08, 0.3) },
  done: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.14)),
  levelUp: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.08, 0.12)),
  sad: () => { tone(392, 0, 0.18, 'triangle'); tone(330, 0.18, 0.3, 'triangle') },
  unlock: () => ac(),
}

export function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch { /* sem vibração */ }
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function pixelConfetti(colors: string[] = ['#39C2EF', '#F9C74F', '#EA76CB', '#40A02B', '#FE8019']) {
  if (reduced()) return
  const base = { shapes: ['square'] as confetti.Shape[], colors, scalar: 1.1, ticks: 220, gravity: 1.1, disableForReducedMotion: true }
  confetti({ ...base, particleCount: 70, spread: 70, origin: { y: 0.65 }, startVelocity: 45 })
  setTimeout(() => confetti({ ...base, particleCount: 40, spread: 110, origin: { y: 0.6 }, startVelocity: 35 }), 180)
}

// Voz em pt-PT com a voz do sistema.
let voice: SpeechSynthesisVoice | null = null
function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices()
    voice = vs.find((v) => v.lang === 'pt-PT') ?? vs.find((v) => v.lang.startsWith('pt-PT')) ?? vs.find((v) => v.lang.startsWith('pt')) ?? null
  } catch { voice = null }
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice()
  speechSynthesis.onvoiceschanged = pickVoice
}
export function say(text: string) {
  try {
    if (!('speechSynthesis' in window)) return
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'pt-PT'
    if (voice) u.voice = voice
    u.rate = 1.02
    speechSynthesis.speak(u)
  } catch { /* sem voz */ }
}

// Ecrã sempre ligado durante o treino.
export async function keepAwake(): Promise<() => void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    if (!nav.wakeLock) return () => {}
    let lock = await nav.wakeLock.request('screen')
    const onVis = async () => { if (document.visibilityState === 'visible') lock = await nav.wakeLock!.request('screen') }
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); void lock.release() }
  } catch {
    return () => {}
  }
}
