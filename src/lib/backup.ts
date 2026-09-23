import { bulkPut, deleteDatabase, getAll, getSetting, resetDbConnection, setSetting } from './db'
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
  const [savedBarbers, shopName] = await Promise.all([
    getSetting<string[]>('savedBarbers'),
    getSetting<string>('shopName'),
  ])
  return {
    savedBarbers: Array.isArray(savedBarbers) ? savedBarbers : [],
    syncEndpoint: '',
    syncToken: '',
    shopName: shopName ?? 'Badboy Barber',
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

export function isBackupFile(json: unknown): json is BackupFile {
  if (!json || typeof json !== 'object') return false
  const f = json as Record<string, unknown>
  return (
    f.app === APP_KEY &&
    typeof f.exportedAt === 'string' &&
    !!f.data &&
    typeof f.data === 'object'
  )
}

export async function restoreBackup(file: BackupFile): Promise<void> {
  const d = file.data
  // Wipe clean so ids stay authoritative (delete + recreate keeps fresh sequences).
  await deleteDatabase()
  await resetDbConnection()
  const tables: Array<[string, Record<string, unknown>[]]> = [
    ['users', (d.users ?? []).map((u) => ({ ...u, id: u.id }))],
    ['branches', (d.branches ?? []).map((b) => ({ ...b, id: b.id }))],
    ['items', (d.items ?? []).map((i) => ({ ...i, id: i.id }))],
    ['transactions', (d.transactions ?? []).map((t) => ({ ...t, id: t.id }))],
    ['transactionItems', (d.transactionItems ?? []).map((ti) => ({ ...ti, id: ti.id }))],
  ]
  for (const [store, rows] of tables) {
    if (!rows.length) continue
    await bulkPut(store, rows)
  }
  if (d.settings) {
    if (d.settings.savedBarbers) {
      await setSetting('savedBarbers', d.settings.savedBarbers)
      await setSetting('shopName', d.settings.shopName || 'Badboy Barber')
    }
  }
}