import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { DB_NAME, DB_VERSION } from '../types'
import type { User, Branch, Item, Transaction, TxnItem, Settings } from '../types'

export interface BBDBSchema extends DBSchema {
  users: { key: number; value: User; autoIncrement: true }
  branches: { key: number; value: Branch; autoIncrement: true }
  items: {
    key: number
    value: Item
    autoIncrement: true
    indexes: { byBranch: number }
  }
  transactions: {
    key: number
    value: Transaction
    autoIncrement: true
    indexes: { byDate: string }
  }
  transactionItems: {
    key: number
    value: TxnItem
    autoIncrement: true
    indexes: { byTxn: number }
  }
  settings: { key: string; value: { key: string; value: unknown } }
}

let dbp: Promise<IDBPDatabase<BBDBSchema>> | null = null

const LOCAL_CHANGE_KEY = 'bb_local_change_at'

export function markLocalChange(): void {
  try {
    localStorage.setItem(LOCAL_CHANGE_KEY, new Date().toISOString())
  } catch {
    /* localStorage unavailable (e.g. tests) — ignore */
  }
}

export function lastLocalChangeAt(): string | null {
  try {
    return localStorage.getItem(LOCAL_CHANGE_KEY)
  } catch {
    return null
  }
}

function markStoreChange(store: string): void {
  if (store !== 'settings') markLocalChange()
}

export function getDb(): Promise<IDBPDatabase<BBDBSchema>> {
  if (!dbp) {
    dbp = openDB<BBDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'id', autoIncrement: true })
        }
        if (!db.objectStoreNames.contains('branches')) {
          db.createObjectStore('branches', { keyPath: 'id', autoIncrement: true })
        }
        if (!db.objectStoreNames.contains('items')) {
          const s = db.createObjectStore('items', { keyPath: 'id', autoIncrement: true })
          s.createIndex('byBranch', 'branchId')
        }
        if (!db.objectStoreNames.contains('transactions')) {
          const s = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true })
          s.createIndex('byDate', 'date')
        }
        if (!db.objectStoreNames.contains('transactionItems')) {
          const s = db.createObjectStore('transactionItems', { keyPath: 'id', autoIncrement: true })
          s.createIndex('byTxn', 'transactionId')
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
        }
      },
    })
  }
  return dbp
}

export async function resetDbConnection(): Promise<void> {
  if (dbp) {
    try {
      const db = await dbp
      db.close()
    } catch {
      /* connection already failed; nothing to close */
    }
  }
  dbp = null
}

export function deleteDatabase(): Promise<void> {
  return resetDbConnection().then(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(DB_NAME)
        req.onsuccess = () => {
          dbp = null
          resolve()
        }
        req.onerror = () => reject(req.error ?? new Error('Failed to delete database'))
        req.onblocked = () =>
          reject(new Error('Database is still open in another tab; close it and try again.'))
      })
  )
}

export async function getAll<T>(store: IDBValidKey extends never ? never : 'users' | 'branches' | 'items' | 'transactions' | 'transactionItems'): Promise<T[]> {
  const db = await getDb()
  return (await db.getAll(store as never)) as T[]
}

export async function getByKey<T>(
  store: 'users' | 'branches' | 'items' | 'transactions' | 'transactionItems',
  key: number
): Promise<T | undefined> {
  const db = await getDb()
  return (await db.get(store as never, key)) as T | undefined
}

export async function putRow(store: 'users' | 'branches' | 'items' | 'transactions' | 'transactionItems', value: Record<string, unknown>): Promise<number> {
  const db = await getDb()
  const id = (await db.put(store as never, value as never)) as number
  markStoreChange(store)
  return id
}

export async function addRow(store: 'users' | 'branches' | 'items' | 'transactions' | 'transactionItems', value: Record<string, unknown>): Promise<number> {
  const db = await getDb()
  const id = (await db.add(store as never, value as never)) as number
  markStoreChange(store)
  return id
}

export async function deleteRow(store: 'users' | 'branches' | 'items' | 'transactions' | 'transactionItems', key: number): Promise<void> {
  const db = await getDb()
  await db.delete(store as never, key)
  markStoreChange(store)
}

export async function bulkPut(store: string, values: Record<string, unknown>[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(store as never, 'readwrite')
  await Promise.all([...values.map((v) => tx.store.put(v as never)), tx.done])
  markStoreChange(store)
}

export async function clearStore(store: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(store as never, 'readwrite')
  await tx.store.clear()
  await tx.done
  markStoreChange(store)
}

export async function getAllByIndex<T>(
  store: 'transactions',
  index: 'byDate',
  date: string
): Promise<T[]>
export async function getAllByIndex<T>(
  store: 'transactionItems',
  index: 'byTxn',
  txnId: number
): Promise<T[]>
export async function getAllByIndex<T>(
  store: string,
  index: string,
  value: string | number
): Promise<T[]> {
  const db = await getDb()
  return (await db.getAllFromIndex(store as never, index as never, value as never)) as T[]
}

export async function getSetting<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDb()
  const row = await db.get('settings', key)
  return row?.value as T | undefined
}

export async function setSetting<T = unknown>(key: string, value: T): Promise<void> {
  const db = await getDb()
  await db.put('settings', { key, value })
}

export async function allSettings(): Promise<Settings> {
  const [savedBarbers, syncEndpoint, syncToken, shopName, sheetUrl, autoSheet, autoSync] = await Promise.all([
    getSetting<string[]>('savedBarbers'),
    getSetting<string>('syncEndpoint'),
    getSetting<string>('syncToken'),
    getSetting<string>('shopName'),
    getSetting<string>('sheetUrl'),
    getSetting<boolean>('autoSheet'),
    getSetting<boolean>('autoSync'),
  ])
  return {
    savedBarbers: Array.isArray(savedBarbers) ? savedBarbers : [],
    syncEndpoint: syncEndpoint ?? '',
    syncToken: syncToken ?? '',
    shopName: shopName ?? 'Badboy Barber',
    sheetUrl: sheetUrl ?? '',
    autoSheet: autoSheet ?? false,
    autoSync: autoSync ?? false,
  }
}