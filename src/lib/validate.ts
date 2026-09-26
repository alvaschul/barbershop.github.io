export function validateItem(name: string, price: number, category: string): string | null {
  if (!name || name.trim().length < 2) return 'Nama barang terlalu pendek (min. 2 karakter).'
  if (!Number.isFinite(price) || price < 0) return 'Harga harus angka tidak negatif.'
  if (price > 99_999_999) return 'Harga terlalu besar.'
  if (category !== 'service' && category !== 'product') return 'Kategori harus service atau product.'
  return null
}

export interface RekapanInput {
  cabang: string
  awal: number
  free: number
  barbers: string[]
}

export interface RekapanCheck {
  ok: boolean
  cabangError: boolean
  awalError: boolean
  freeError: boolean
  barberError: boolean
}

export function validateRekapan(input: RekapanInput): RekapanCheck {
  const cabangError = input.cabang.trim() === ''
  const awalError = !Number.isFinite(input.awal) || input.awal < 0
  const freeError = !Number.isFinite(input.free) || input.free < 0
  const barberError = input.barbers.length === 0
  return {
    ok: !(cabangError || awalError || freeError || barberError),
    cabangError,
    awalError,
    freeError,
    barberError,
  }
}
