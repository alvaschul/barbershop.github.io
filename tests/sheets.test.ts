import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendReportToSheet, testSheet, type ReportSheetPayload } from '../src/lib/sheets'

const payload: ReportSheetPayload = {
  source: 'badboy-barber-pages',
  type: 'report',
  meta: { shopName: 'Badboy' },
  date: '2026-09-26',
  cabang: 'Playen',
  barbers: ['Andi'],
  awal: 225000,
  free: 0,
  text: 'laporan',
  summary: {
    totalTransactions: 1,
    totalRevenue: 225000,
    totalCash: 225000,
    totalQris: 0,
    totalChange: 0,
    totalSales: 1,
    totalProducts: 0,
  },
}

function stubFetch(body: string, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status, headers: { 'Content-Type': 'application/json' } }))
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sendReportToSheet', () => {
  it('treats an HTTP 200 with ok:false as a failure', async () => {
    stubFetch(JSON.stringify({ ok: false, error: 'unknown type' }))
    await expect(sendReportToSheet('https://script.example/exec', payload)).rejects.toThrow()
  })

  it('succeeds when the script answers ok:true', async () => {
    stubFetch(JSON.stringify({ ok: true }))
    await expect(sendReportToSheet('https://script.example/exec', payload)).resolves.toBeUndefined()
  })
})

describe('testSheet', () => {
  it('reports failure when the script answers ok:false', async () => {
    stubFetch(JSON.stringify({ ok: false, error: 'unknown source' }))
    const r = await testSheet('https://script.example/exec')
    expect(r.ok).toBe(false)
    expect(r.message).toBeTruthy()
  })

  it('reports success when the script answers ok:true', async () => {
    stubFetch(JSON.stringify({ ok: true }))
    const r = await testSheet('https://script.example/exec')
    expect(r.ok).toBe(true)
  })
})
