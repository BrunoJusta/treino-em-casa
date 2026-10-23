const nf1 = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 })
const list = new Intl.ListFormat('pt-PT', { style: 'long', type: 'conjunction' })
export const kg = (v: number) => `${nf1.format(v)}\u00a0kg`
export const num1 = (v: number) => nf1.format(v)
export const names = (xs: string[]) => list.format(xs)

/** Duração curta: até 59 s em segundos, a partir daí em minutos (45 s, 10 min, 1 min 30 s). */
export function dur(s: number): string {
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m} min ${r} s` : `${m} min`
}

/** A mesma duração por extenso, para a voz do player. */
export function durSpoken(s: number): string {
  const sec = (n: number) => `${n} ${n === 1 ? 'segundo' : 'segundos'}`
  if (s < 60) return sec(s)
  const m = Math.floor(s / 60)
  const r = s % 60
  const min = `${m} ${m === 1 ? 'minuto' : 'minutos'}`
  return r ? `${min} e ${sec(r)}` : min
}
