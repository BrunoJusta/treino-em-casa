import { describe, expect, it, vi } from 'vitest'
import { acceptPoint, createHold, elapsedMs, fmtKm, getKeepAwake, haversine, pathLength, setKeepAwake, simplify, type LiveWalk } from './walk'
import { createScreenAwake } from './screenAwake'
import { walkTotals, walksOf } from './rules/game'
import type { Walk } from '../data/types'

describe('caminhadas', () => {
  it('mede distâncias com a fórmula de haversine', () => {
    // 0,001 graus de latitude são cerca de 111 m
    expect(Math.round(haversine([41.38, -8.76], [41.381, -8.76]))).toBe(111)
    expect(Math.round(pathLength([[41.38, -8.76], [41.381, -8.76], [41.382, -8.76]]))).toBe(222)
  })

  it('ignora pontos imprecisos, ruído parado e saltos do GPS', () => {
    const a = { lat: 41.38, lng: -8.76, t: 0, acc: 8 }
    expect(acceptPoint(undefined, a)).toBe(true)
    expect(acceptPoint(undefined, { ...a, acc: 80 })).toBe(false)
    expect(acceptPoint(a, { ...a, lat: 41.38001, t: 5000 })).toBe(false) // ~1 m
    expect(acceptPoint(a, { ...a, lat: 41.3801, t: 8000 })).toBe(true) // ~11 m em 8 s
    expect(acceptPoint(a, { ...a, lat: 41.39, t: 5000 })).toBe(false) // 1,1 km em 5 s
    expect(acceptPoint(a, { ...a, lat: 41.39, t: 600000 })).toBe(true) // depois do ecrã bloqueado, liga em reta
  })

  it('o tempo desconta as pausas e continua com o ecrã bloqueado', () => {
    const w: LiveWalk = { startedAt: 0, companions: [], points: [], pausedMs: 60000, pausedAt: null, gaps: 0 }
    expect(elapsedMs(w, 600000)).toBe(540000)
    expect(elapsedMs({ ...w, pausedAt: 500000 }, 600000)).toBe(440000)
  })

  it('simplifica uma linha reta para os dois extremos', () => {
    const line = Array.from({ length: 20 }, (_, i) => [41.38 + i * 0.0001, -8.76] as [number, number])
    expect(simplify(line)).toHaveLength(2)
  })

  it('formata km', () => {
    expect(fmtKm(3456)).toBe('3,46 km')
  })

  it('manter o ecrã ligado vem ligado por omissão e guarda a escolha', () => {
    const mem = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v) })
    expect(getKeepAwake()).toBe(true)
    setKeepAwake(false)
    expect(getKeepAwake()).toBe(false)
    vi.unstubAllGlobals()
  })

  it('usa o Wake Lock quando há, o plano B quando não há, e avisa quando nenhum dá', async () => {
    const doc = { visibilityState: 'visible' as const, addEventListener: () => {}, removeEventListener: () => {} }
    const ok = createScreenAwake({ wakeLock: { request: async () => ({ release: async () => {} }) }, doc: doc as never })
    expect(await ok.enable()).toBe('native')
    ok.disable()
    expect(ok.status()).toBe('off')
    const fb = createScreenAwake({ wakeLock: { request: async () => { throw new Error('não') } }, makeNoSleep: () => ({ isEnabled: true, enable: async () => {}, disable: () => {} }), doc: doc as never })
    expect(await fb.enable()).toBe('fallback')
    const bad = createScreenAwake({ wakeLock: null, makeNoSleep: () => ({ isEnabled: false, enable: async () => { throw new Error('não') }, disable: () => {} }), doc: doc as never })
    expect(await bad.enable()).toBe('failed')
  })

  it('modo bolso: largar antes dos 2 s não sai, aguentar 2 s sai', () => {
    vi.useFakeTimers()
    const done = vi.fn()
    const h = createHold(done)
    h.start(); vi.advanceTimersByTime(1500); h.cancel(); vi.advanceTimersByTime(1000)
    expect(done).not.toHaveBeenCalled()
    h.start(); vi.advanceTimersByTime(2000)
    expect(done).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('a caminhada conta para quem registou e para quem foi', () => {
    const w = (id: string, by: string, comp: string[], m: number): Walk => ({ id, profile_id: by, companions: comp, date: '2026-10-25', started_at: `2026-10-25T10:0${id}:00Z`, ended_at: `2026-10-25T11:0${id}:00Z`, duration_s: 3600, distance_m: m, route: null, source: 'manual', notes: '', photo_path: null, photo_taken_at: null, created_at: '' })
    const walks = [w('1', 'a', ['b'], 4000), w('2', 'b', [], 2000), w('3', 'c', [], 1000)]
    expect(walksOf('b', walks).map((x) => x.id)).toEqual(['1', '2'])
    expect(walkTotals('b', walks).meters).toBe(6000)
    expect(walkTotals('a', walks).count).toBe(1)
  })
})
