export type SyncDecision = 'pull' | 'push' | 'noop' | 'conflict'

export interface SyncState {
  remoteUpdatedAt: string | null
  localUpdatedAt: string | null
  lastSyncedAt: string | null
  localHasData: boolean
  remoteHasData: boolean
}

export function decideSync(s: SyncState): SyncDecision {
  if (!s.remoteHasData || s.remoteUpdatedAt === null) return 'push'
  if (!s.localHasData) return 'pull'
  if (s.lastSyncedAt === null) return 'conflict'
  const remoteNewer = s.remoteUpdatedAt > s.lastSyncedAt
  const localNewer = (s.localUpdatedAt ?? '') > s.lastSyncedAt
  if (remoteNewer && localNewer) return 'conflict'
  if (remoteNewer) return 'pull'
  if (localNewer) return 'push'
  return 'noop'
}
