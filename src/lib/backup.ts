import { allSettings, bulkPut, deleteDatabase, getAll, getSetting, setSetting } from './db'
import type { BackupFile, Branch, Item, Settings, Transaction, TxnItem, User } from '../types'
import { APP_KEY } from '../types'

export async function buildBackup(): Promise<BackupFile> {
  const [users, branches, items, transactions, transactionItems, settings] = await Promise.all([
    getAll<User>('users'),
    getAll<Branch>('branches'),
    getAll<Item>('items'),
    getAll<Transaction>('transactions'),
    getAll<TxnItem>('transactionItems'),
    loadSettingsForBackup(),
  ])
  return {
    app: APP_KEY,
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      users,
      branches,
      items,
      transactions,
      transactionItems,
      settings,
    },
  }
}

async function loadSettingsForBackup(): Promise<Settings> {
  const [savedBarbers, shopName, sheetUrl, autoSheet, autoSync] = await Promise.all([
    getSetting<string[]>('savedBarbers'),
    getSetting<string>('shopName'),
    getSetting<string>('sheetUrl'),
    getSetting<boolean>('autoSheet'),
    getSetting<boolean>('autoSync'),
  ])
  return {
    savedBarbers: Array.isArray(savedBarbers) ? savedBarbers : [],
    syncEndpoint: '',
    syncToken: '',
    shopName: shopName ?? 'Badboy Barber',
    sheetUrl: sheetUrl ?? '',
    autoSheet: autoSheet ?? false,
    autoSync: autoSync ?? false,
  }
}

export function downloadBackup(file: BackupFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `badboy-barber-backup-${file.exportedAt.slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function backupHasData(file: BackupFile): boolean {
  const d = file?.data
  if (!d) return false
  return (
    (d.users?.length ?? 0) > 0 ||
    (d.branches?.length ?? 0) > 0 ||
    (d.items?.length ?? 0) > 0 ||
    (d.transactions?.length ?? 0) > 0 ||
    (d.transactionItems?.length ?? 0) > 0
  )
}

const TABLES = ['users', 'branches', 'items', 'transactions', 'transactionItems'] as const

export function isBackupFile(json: unknown): json is BackupFile {
  if (!json || typeof json !== 'object') return false
  const f = json as Record<string, unknown>
  if (f.app !== APP_KEY) return false
  if (f.version !== 1) return false
  if (typeof f.exportedAt !== 'string') return false
  if (!f.data || typeof f.data !== 'object') return false
  const data = f.data as Record<string, unknown>
  return TABLES.every((table) => Array.isArray(data[table]))
}

export async function restoreBackup(file: BackupFile): Promise<void> {
  if (!isBackupFile(file)) throw new Error('Invalid backup file.')
  const d = file.data

  // Device-local settings (sync credentials are intentionally excluded from a
  // backup) must survive a wipe, otherwise this device loses its sync config.
  const local = await allSettings()

  // Collect and validate every table BEFORE touching the database, so a
  // malformed file can never leave the device with its data already deleted.
  for (const table of TABLES) {
    if (!Array.isArray(d[table])) throw new Error('Invalid backup data.')
  }
  const tables: Array<[string, Record<string, unknown>[]]> = TABLES.map((table) => [
    table,
    d[table] as unknown as Record<string, unknown>[],
  ])

  // Wipe clean so ids stay authoritative (delete + recreate keeps fresh sequences).
  await deleteDatabase()

  for (const [store, rows] of tables) {
    if (!rows.length) continue
    await bulkPut(store, rows)
  }

  const s = d.settings ?? ({} as Settings)
  await setSetting('savedBarbers', Array.isArray(s.savedBarbers) ? s.savedBarbers : local.savedBarbers)
  await setSetting('shopName', s.shopName ?? local.shopName)
  await setSetting('sheetUrl', s.sheetUrl ?? local.sheetUrl)
  await setSetting('autoSheet', s.autoSheet ?? local.autoSheet)
  await setSetting('autoSync', s.autoSync ?? local.autoSync)
  await setSetting('syncEndpoint', local.syncEndpoint)
  await setSetting('syncToken', local.syncToken)
}