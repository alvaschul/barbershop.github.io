import { describe, it, expect, beforeEach } from 'vitest'
import { addRow, deleteDatabase, getAll, getSetting, setSetting } from '../src/lib/db'
import { backupHasData, isBackupFile, restoreBackup } from '../src/lib/backup'
import { APP_KEY, type BackupFile, type Settings } from '../src/types'

const emptyData = {
  users: [],
  branches: [],
  items: [],
  transactions: [],
  transactionItems: [],
  settings: {
    savedBarbers: [],
    syncEndpoint: '',
    syncToken: '',
    shopName: 'Badboy Barber',
    sheetUrl: '',
    autoSheet: false,
    autoSync: false,
  } satisfies Settings,
}

function backup(patch: Partial<BackupFile['data']> = {}, version = 1): BackupFile {
  return { app: APP_KEY, version, exportedAt: '2026-09-26T00:00:00.000Z', data: { ...emptyData, ...patch } }
}

beforeEach(async () => {
  await deleteDatabase()
})

describe('isBackupFile', () => {
  it('accepts a well-formed backup', () => {
    expect(isBackupFile(backup())).toBe(true)
  })

  it('rejects when a table is not an array', () => {
    expect(isBackupFile({ ...backup(), data: { ...emptyData, users: 5 } })).toBe(false)
  })

  it('rejects a missing table', () => {
    const data: Record<string, unknown> = { ...emptyData }
    delete data.items
    expect(isBackupFile({ ...backup(), data })).toBe(false)
  })

  it('rejects an unsupported version', () => {
    expect(isBackupFile(backup({}, 99))).toBe(false)
  })
})

describe('backupHasData', () => {
  it('is false for an empty dataset and true when rows exist', () => {
    expect(backupHasData(backup())).toBe(false)
    expect(backupHasData(backup({ branches: [{ id: 1, name: 'x', isActive: true, createdAt: 'now' }] }))).toBe(true)
  })
})

describe('restoreBackup', () => {
  it('does not wipe the database when given a malformed backup', async () => {
    await addRow('branches', { name: 'Playen', isActive: true, createdAt: 'now' })
    const malformed = { ...backup(), data: { ...emptyData, users: 5 } } as unknown as BackupFile

    await expect(restoreBackup(malformed)).rejects.toThrow()
    expect((await getAll('branches')).length).toBe(1)
  })

  it('restores settings even without savedBarbers and preserves local sync credentials', async () => {
    await setSetting('syncEndpoint', 'https://sync.example/api')
    await setSetting('syncToken', 'secret-token')
    const file = backup({
      settings: { ...emptyData.settings, shopName: 'Cabang A', sheetUrl: 'https://sheet', autoSheet: true, autoSync: true },
    })

    await restoreBackup(file)

    expect(await getSetting('shopName')).toBe('Cabang A')
    expect(await getSetting('sheetUrl')).toBe('https://sheet')
    expect(await getSetting('autoSheet')).toBe(true)
    expect(await getSetting('autoSync')).toBe(true)
    expect(await getSetting('syncEndpoint')).toBe('https://sync.example/api')
    expect(await getSetting('syncToken')).toBe('secret-token')
  })
})
