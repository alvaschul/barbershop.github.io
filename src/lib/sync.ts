import { buildBackup, backupHasData, isBackupFile, restoreBackup } from './backup'
import { getSetting, lastLocalChangeAt, setSetting } from './db'
import { decideSync } from './syncDecision'
import type { BackupFile, SyncResult } from '../types'

const LAST_SYNCED_KEY = 'lastSyncedAt'

interface RemotePayload {
  updatedAt: string
  backup: BackupFile
}

/**
 * Optional sync hook. Points at any tiny HTTP JSON store (e.g. a Cloudflare
 * Worker backed by D1/KV) that supports:
 *   GET  {endpoint}  ->  { updatedAt, backup }
 *   PUT  {endpoint}  ->  body { updatedAt, backup }, returns { ok: true }
 *
 * Conflict policy: never overwrite one side blindly. If both the local data and
 * the remote changed since the last successful sync, sync aborts and asks the
 * user to resolve it manually instead of silently losing a device's sales.
 */
export async function syncNow(endpoint: string, token: string): Promise<SyncResult> {
  const url = (endpoint || '').trim()
  if (!url) return { ok: false, message: 'No sync endpoint configured.' }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let remote: RemotePayload
  try {
    const r = await fetch(url, { method: 'GET', headers })
    if (!r.ok) return { ok: false, message: `Sync endpoint returned HTTP ${r.status}.` }
    const j = (await r.json()) as Partial<RemotePayload> | null
    if (!j || typeof j !== 'object' || !isBackupFile(j.backup)) {
      return { ok: false, message: 'Sync endpoint returned an unexpected payload; nothing was changed.' }
    }
    remote = { updatedAt: typeof j.updatedAt === 'string' ? j.updatedAt : '', backup: j.backup }
  } catch {
    return { ok: false, message: 'Could not reach sync endpoint.' }
  }

  const local = await buildBackup()
  const lastSyncedAt = (await getSetting<string>(LAST_SYNCED_KEY)) ?? null

  const decision = decideSync({
    remoteUpdatedAt: remote.updatedAt || null,
    localUpdatedAt: lastLocalChangeAt(),
    lastSyncedAt,
    localHasData: backupHasData(local),
    remoteHasData: backupHasData(remote.backup),
  })

  if (decision === 'noop') {
    return { ok: true, message: 'Data is already in sync.' }
  }
  if (decision === 'conflict') {
    return {
      ok: false,
      message:
        'Local and cloud data both changed since the last sync. Export a backup and restore one side before syncing again.',
    }
  }

  if (decision === 'pull') {
    try {
      await restoreBackup(remote.backup)
    } catch {
      return { ok: false, message: 'Remote data was invalid; nothing was changed.' }
    }
    await setSetting(LAST_SYNCED_KEY, new Date().toISOString())
    return { ok: true, pulled: 1, message: 'Loaded newer data from sync endpoint.' }
  }

  try {
    const body: RemotePayload = { updatedAt: local.exportedAt, backup: local }
    const r = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) })
    if (!r.ok) return { ok: false, message: `Sync endpoint returned HTTP ${r.status}.` }
    await setSetting(LAST_SYNCED_KEY, local.exportedAt)
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
