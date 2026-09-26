import { describe, it, expect } from 'vitest'
import { decideSync, type SyncState } from '../src/lib/syncDecision'

const T = {
  old: '2026-09-20T10:00:00.000Z',
  sync: '2026-09-22T10:00:00.000Z',
  new: '2026-09-24T10:00:00.000Z',
}

function state(patch: Partial<SyncState>): SyncState {
  return {
    remoteUpdatedAt: T.sync,
    localUpdatedAt: T.sync,
    lastSyncedAt: T.sync,
    localHasData: true,
    remoteHasData: true,
    ...patch,
  }
}

describe('decideSync', () => {
  it('pushes when the remote has no data yet', () => {
    expect(decideSync(state({ remoteHasData: false, remoteUpdatedAt: null }))).toBe('push')
  })

  it('pulls into an empty device', () => {
    expect(decideSync(state({ localHasData: false }))).toBe('pull')
  })

  it('refuses to guess when two devices both have data and were never synced', () => {
    expect(decideSync(state({ lastSyncedAt: null }))).toBe('conflict')
  })

  it('pulls when only the remote changed since last sync', () => {
    expect(decideSync(state({ remoteUpdatedAt: T.new, localUpdatedAt: T.sync }))).toBe('pull')
  })

  it('pushes when only the local data changed since last sync', () => {
    expect(decideSync(state({ remoteUpdatedAt: T.sync, localUpdatedAt: T.new }))).toBe('push')
  })

  it('does nothing when neither side changed', () => {
    expect(decideSync(state({ remoteUpdatedAt: T.sync, localUpdatedAt: T.sync }))).toBe('noop')
  })

  it('reports a conflict when both sides changed since last sync', () => {
    expect(decideSync(state({ remoteUpdatedAt: T.new, localUpdatedAt: T.new }))).toBe('conflict')
  })
})
