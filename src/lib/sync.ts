import { buildBackup, isBackupFile, restoreBackup } from './backup'
import type { BackupFile, SyncResult } from '../types'

interface RemotePayload {
  updatedAt: string
  backup: BackupFile
}

/**
 * Optional sync hook. Points at any tiny HTTP JSON store (e.g. a Cloudflare
 * Worker backed by KV, or a gist-like endpoint) that supports:
 *   GET  {endpoint}  ->  { updatedAt, backup }
 *   PUT  {endpoint}  ->  body { updatedAt, backup }, returns { ok: true }
 */
export async function syncNow(endpoint: string, token: string): Promise<SyncResult> {
  const url = (endpoint || '').trim()
  if (!url) return { ok: false, message: 'No sync endpoint configured.' }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let remote: RemotePayload | null = null
  try {
    const r = await fetch(url, { method: 'GET', headers })
    if (r.ok) {
      const j = await r.json()
      if (j && typeof j === 'object' && j.backup && isBackupFile(j.backup)) {
        remote = j as RemotePayload
      }
    }
  } catch {
    return { ok: false, message: 'Could not reach sync endpoint.' }
  }

  const local = await buildBackup()

  if (remote && new Date(remote.updatedAt) > new Date(local.exportedAt)) {
    try {
      await restoreBackup(remote.backup)
      return { ok: true, pulled: 1, message: 'Loaded newer data from sync endpoint.' }
    } catch {
      return { ok: false, message: 'Remote data was invalid; nothing was changed.' }
    }
  }

  try {
    const body: RemotePayload = { updatedAt: local.exportedAt, backup: local }
    const r = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    })
    if (!r.ok) return { ok: false, message: `Sync endpoint returned HTTP ${r.status}.` }
    return { ok: true, pushed: true, message: 'Local data pushed to sync endpoint.' }
  } catch {
    return { ok: false, message: 'Could not reach sync endpoint.' }
  }
}

export function describeSync(mode: 'never' | 'local' | 'synced'): string {
  switch (mode) {
    case 'never':
      return 'Data only on this device'
    case 'local':
      return 'Backed up to file'
    case 'synced':
      return 'Synced to endpoint'
  }
}