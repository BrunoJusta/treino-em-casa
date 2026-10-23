// Datas de calendário como strings 'YYYY-MM-DD', sempre no fuso Europe/Lisbon.
// A aritmética é feita em UTC ao meio-dia para não haver surpresas com a mudança de hora.

export const TZ = 'Europe/Lisbon'

export function todayLisbon(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function hourLisbon(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(now))
}

export function parse(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day, 12))
}

export function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(d: string, n: number): string {
  const x = parse(d)
  x.setUTCDate(x.getUTCDate() + n)
  return fmt(x)
}

export function monthKey(d: string): string {
  return d.slice(0, 7)
}

export function monthOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function daysInMonth(mk: string): number {
  const [y, m] = mk.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function monthDays(mk: string): string[] {
  const n = daysInMonth(mk)
  return Array.from({ length: n }, (_, i) => `${mk}-${String(i + 1).padStart(2, '0')}`)
}

export function prevMonth(mk: string): string {
  const [y, m] = mk.split('-').map(Number)
  return m === 1 ? monthOf(y - 1, 12) : monthOf(y, m - 1)
}

export function nextMonth(mk: string): string {
  const [y, m] = mk.split('-').map(Number)
  return m === 12 ? monthOf(y + 1, 1) : monthOf(y, m + 1)
}

/** 0 = segunda ... 6 = domingo */
export function weekday(d: string): number {
  return (parse(d).getUTCDay() + 6) % 7
}

export function weekStart(d: string): string {
  return addDays(d, -weekday(d))
}

export function dayOfMonth(d: string): number {
  return Number(d.slice(8, 10))
}

export function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const WEEKDAYS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']
export const WEEKDAY_SHORT = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
export const WEEKDAY_ABBR = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

export function monthName(mk: string): string {
  return MONTHS[Number(mk.slice(5, 7)) - 1]
}

export function monthLabel(mk: string): string {
  const n = monthName(mk)
  return `${n[0].toUpperCase()}${n.slice(1)} ${mk.slice(0, 4)}`
}

export function weekdayName(d: string): string {
  return WEEKDAYS[weekday(d)]
}

export function longDate(d: string): string {
  return `${weekdayName(d)}, ${dayOfMonth(d)} de ${MONTHS[Number(d.slice(5, 7)) - 1]}`
}

export function shortDate(d: string): string {
  return `${dayOfMonth(d)} ${MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3)}`
}

export function relativeDay(d: string, today: string): string {
  if (d === today) return 'hoje'
  if (d === addDays(today, -1)) return 'ontem'
  if (d === addDays(today, 1)) return 'amanhã'
  return shortDate(d)
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'agora mesmo'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  const d = Math.floor(s / 86400)
  return d === 1 ? 'ontem' : `há ${d} dias`
}

export function timeHM(iso: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

/** Semanas (segunda a domingo) que tocam o mês, com os dias que caem dentro do mês. */
export function monthWeeks(mk: string): { start: string; days: string[] }[] {
  const days = monthDays(mk)
  const map = new Map<string, string[]>()
  for (const d of days) {
    const ws = weekStart(d)
    if (!map.has(ws)) map.set(ws, [])
    map.get(ws)!.push(d)
  }
  return [...map.entries()].map(([start, ds]) => ({ start, days: ds }))
}
