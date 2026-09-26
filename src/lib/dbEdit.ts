export function coerceEditValue(orig: unknown, raw: string): unknown {
  if (orig === null) return null
  if (orig === undefined) return undefined
  if (typeof orig === 'number') {
    const n = Number(raw)
    return Number.isNaN(n) ? 0 : n
  }
  if (typeof orig === 'boolean') return raw === 'true' || raw === '1'
  if (typeof orig === 'object') {
    try {
      const parsed: unknown = JSON.parse(raw)
      return typeof parsed === 'object' ? parsed : orig
    } catch {
      return orig
    }
  }
  return raw
}

export const STORE_NAMES = [
  'users',
  'branches',
  'items',
  'transactions',
  'transactionItems',
] as const

export type StoreName = (typeof STORE_NAMES)[number]

export function toStoreName(table: string): StoreName {
  if (!(STORE_NAMES as readonly string[]).includes(table)) {
    throw new Error('Unknown table: ' + table)
  }
  return table as StoreName
}
