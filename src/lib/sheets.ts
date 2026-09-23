import type { Category } from '../types'

export interface TxnSheetLine {
  name: string
  category: Category
  qty: number
  price: number
  total: number
}

export interface TxnSheetPayload {
  source: string
  type: 'txn'
  meta: { shopName: string; branch: string }
  txn: {
    id: number
    date: string
    createdAt: string
    method: string
    total: number
    cash: number
    qris: number
    change: number
    notes: string
    lines: TxnSheetLine[]
  }
}

export interface ReportSheetPayload {
  source: string
  type: 'report'
  meta: { shopName: string }
  date: string
  cabang: string
  barbers: string[]
  awal: number
  free: number
  text: string
  summary: {
    totalTransactions: number
    totalRevenue: number
    totalCash: number
    totalQris: number
    totalChange: number
    totalSales: number
    totalProducts: number
  }
}

/**
 * Google Apps Script web apps respond to simple (no preflight) requests. Sending
 * Content-Type: text/plain with a JSON body avoids the CORS preflight entirely,
 * which matters from a static GitHub Pages host.
 */
async function postToScript(url: string, payload: unknown): Promise<void> {
  const r = await fetch(url.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) throw new Error(`Sheet web app responded HTTP ${r.status}.`)
}

export async function sendTransactionToSheet(url: string, payload: TxnSheetPayload): Promise<void> {
  await postToScript(url, payload)
}

export async function sendReportToSheet(url: string, payload: ReportSheetPayload): Promise<void> {
  await postToScript(url, payload)
}

export async function testSheet(url: string): Promise<{ ok: boolean; message: string }> {
  const target = (url || '').trim()
  if (!target) return { ok: false, message: 'URL Google Apps Script belum diisi.' }
  try {
    const r = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ source: 'badboy-barber-pages', type: 'test' }),
    })
    await r.text()
    return { ok: r.ok, message: r.ok ? 'Terhubung (ok)' : `Respons HTTP ${r.status}.` }
  } catch {
    return { ok: false, message: 'Tidak dapat menghubungi URL sheet.' }
  }
}