import { describe, expect, it } from 'vitest'
import { dur, durSpoken } from './format'

describe('durações', () => {
  it('até 59 s fica em segundos, a partir daí em minutos', () => {
    expect(dur(45)).toBe('45 s')
    expect(dur(600)).toBe('10 min')
    expect(dur(90)).toBe('1 min 30 s')
    expect(durSpoken(600)).toBe('10 minutos')
    expect(durSpoken(60)).toBe('1 minuto')
    expect(durSpoken(75)).toBe('1 minuto e 15 segundos')
  })
})
