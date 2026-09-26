import { describe, it, expect } from 'vitest'
import { coerceEditValue, toStoreName } from '../src/lib/dbEdit'

describe('coerceEditValue', () => {
  it('never turns a stored null/undefined into an empty string', () => {
    expect(coerceEditValue(null, 'isi')).toBeNull()
    expect(coerceEditValue(undefined, 'isi')).toBeUndefined()
  })

  it('parses numbers back from the input text', () => {
    expect(coerceEditValue(42, '7')).toBe(7)
    expect(coerceEditValue(42, 'bukan-angka')).toBe(0)
  })

  it('parses booleans back from the input text', () => {
    expect(coerceEditValue(true, 'true')).toBe(true)
    expect(coerceEditValue(true, '1')).toBe(true)
    expect(coerceEditValue(false, 'false')).toBe(false)
    expect(coerceEditValue(true, '')).toBe(false)
  })

  it('keeps plain strings editable', () => {
    expect(coerceEditValue('lama', 'baru')).toBe('baru')
  })

  it('round-trips object cells as JSON and falls back when unparseable', () => {
    expect(coerceEditValue({ a: 1 }, '{"b":2}')).toEqual({ b: 2 })
    expect(coerceEditValue({ a: 1 }, 'bukan json')).toEqual({ a: 1 })
  })
})

describe('toStoreName', () => {
  it('accepts every real object store', () => {
    for (const t of ['users', 'branches', 'items', 'transactions', 'transactionItems']) {
      expect(toStoreName(t)).toBe(t)
    }
  })

  it('rejects unknown tables instead of casting them blindly', () => {
    expect(() => toStoreName('settings')).toThrow()
    expect(() => toStoreName('users; DROP TABLE users')).toThrow()
    expect(() => toStoreName('')).toThrow()
  })
})
