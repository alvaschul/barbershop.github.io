import { describe, it, expect } from 'vitest'
import { validateItem, validateRekapan } from '../src/lib/validate'

describe('validateItem', () => {
  it('rejects a blank or too-short name', () => {
    expect(validateItem('', 1000, 'service')).toMatch(/nama/i)
    expect(validateItem('A', 1000, 'service')).toMatch(/nama/i)
    expect(validateItem('   ', 1000, 'service')).toMatch(/nama/i)
  })

  it('rejects a negative or non-numeric price', () => {
    expect(validateItem('Haircut', -5, 'service')).toMatch(/harga/i)
    expect(validateItem('Haircut', Number.NaN, 'service')).toMatch(/harga/i)
  })

  it('rejects an absurdly large price', () => {
    expect(validateItem('Haircut', 100_000_000, 'service')).toMatch(/harga/i)
  })

  it('accepts a valid item', () => {
    expect(validateItem('Haircut', 25000, 'service')).toBeNull()
    expect(validateItem('Pomade', 0, 'product')).toBeNull()
  })
})

describe('validateRekapan', () => {
  it('accepts a complete and consistent report', () => {
    const r = validateRekapan({ cabang: 'Playen', awal: 225000, free: 0, barbers: ['Andi'] })
    expect(r.ok).toBe(true)
    expect(r.cabangError).toBe(false)
    expect(r.awalError).toBe(false)
    expect(r.freeError).toBe(false)
    expect(r.barberError).toBe(false)
  })

  it('rejects a negative or non-numeric discount (free)', () => {
    expect(validateRekapan({ cabang: 'P', awal: 1, free: -1000, barbers: ['A'] }).ok).toBe(false)
    expect(validateRekapan({ cabang: 'P', awal: 1, free: Number.NaN, barbers: ['A'] }).freeError).toBe(true)
    expect(validateRekapan({ cabang: 'P', awal: 1, free: 1000, barbers: ['A'] }).freeError).toBe(false)
  })

  it('rejects a negative or non-numeric awal', () => {
    expect(validateRekapan({ cabang: 'P', awal: -1, free: 0, barbers: ['A'] }).awalError).toBe(true)
    expect(validateRekapan({ cabang: 'P', awal: Number.NaN, free: 0, barbers: ['A'] }).awalError).toBe(true)
  })

  it('requires a branch and at least one barber', () => {
    expect(validateRekapan({ cabang: '  ', awal: 0, free: 0, barbers: ['A'] }).cabangError).toBe(true)
    expect(validateRekapan({ cabang: 'P', awal: 0, free: 0, barbers: [] }).barberError).toBe(true)
    expect(validateRekapan({ cabang: 'P', awal: 0, free: 0, barbers: [] }).ok).toBe(false)
  })
})

describe('validateItem messages', () => {
  it('speaks the language of the UI (Indonesian)', () => {
    expect(validateItem('', 1000, 'service')).toMatch(/nama/i)
    expect(validateItem('Haircut', -1, 'service')).toMatch(/harga/i)
    expect(validateItem('Haircut', 1000, 'lifestyle')).toMatch(/kategori/i)
  })
})
