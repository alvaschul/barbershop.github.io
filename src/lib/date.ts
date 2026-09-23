export function todayStr(): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export function yesterdayStr(): string {
  const d = fromDay(todayStr())
  d.setDate(d.getDate() - 1)
  return toDayStr(d)
}

export function fromDay(s: string): Date {
  return new Date(s + 'T00:00:00')
}

export function toDayStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(s: string, delta: number): string {
  const d = fromDay(s)
  d.setDate(d.getDate() + delta)
  return toDayStr(d)
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export function fmtDayLong(s: string): string {
  const d = fromDay(s)
  return `${DAY_NAMES[d.getDay()]}, ${d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}`
}

export function fmtDayShort(s: string): string {
  const d = fromDay(s)
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function fmtDmy(s: string): string {
  return s.split('-').reverse().join('-')
}

export function isoTime(iso: string): string {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export function lastNDates(n: number, from?: string): string[] {
  const end = from ?? todayStr()
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i))
  return out
}

export function monthKey(s: string): string {
  return s.slice(0, 7)
}

export function fmtMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}