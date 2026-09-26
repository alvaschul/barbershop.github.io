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
  // The Apps Script answers HTTP 200 even when it rejects the payload, so the
  // body has to be inspected as well or failures look like successes.
  const body = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null
  if (body && typeof body === 'object' && body.ok === false) {
    throw new Error(`Sheet web app rejected the payload: ${body.error ?? 'unknown error'}.`)
  }
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
    const text = await r.text()
    if (!r.ok) return { ok: false, message: `Respons HTTP ${r.status}.` }
    let body: { ok?: boolean; error?: string } | null = null
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
    if (!body || typeof body !== 'object') {
      return { ok: false, message: 'Respons web app tidak dikenali (bukan JSON).' }
    }
    if (body.ok === false) return { ok: false, message: `Script gagal: ${body.error ?? 'unknown error'}.` }
    return { ok: true, message: 'Terhubung (ok)' }
  } catch {
    return { ok: false, message: 'Tidak dapat menghubungi URL sheet.' }
  }
}