import { describe, it, expect } from 'vitest'
import { buildDailyReport } from '../src/lib/report'

const base = {
  date: '2026-09-26',
  cabang: 'Playen',
  barbers: ['Andi'],
  awal: 225000,
  um: 150000,
  qr: 75000,
  free: 0,
  lines: [{ name: 'Haircut', category: 'service' as const, quantity: 3 }],
}

function akhirLine(text: string): string {
  return text.split('\n').find((l) => l.includes('TOTAL AKHIR')) ?? ''
}

describe('buildDailyReport', () => {
  it('TOTAL AKHIR = TOTAL AWAL - (UM + QR + Free Haircut)', () => {
    const text = buildDailyReport({ ...base, awal: 500000, free: 25000 })
    expect(akhirLine(text)).toContain('250K')
  })

  it('groups UM, QR and Free Haircut under PENGELUARAN', () => {
    const text = buildDailyReport({ ...base, free: 25000 })
    expect(text).toContain('*PENGELUARAN*')
    expect(text).not.toContain('*PEMBAYARAN*')
    const section = text.slice(text.indexOf('*PENGELUARAN*'), text.indexOf('*TOTAL AKHIR*'))
    expect(section).toContain('UM =')
    expect(section).toContain('QR =')
    expect(section).toContain('Free Haircut =')
  })

  it('prints a zero total when pengeluaran exactly matches the awal', () => {
    expect(akhirLine(buildDailyReport(base))).toContain('0')
  })

  it('shows a negative total instead of clamping it to 0', () => {
    const text = buildDailyReport({ ...base, awal: 100000 })
    expect(akhirLine(text)).toContain('-125.000')
  })
})
