import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react'
import {
  addRow,
  allSettings,
  deleteRow,
  getAll,
  getDb,
  putRow,
  setSetting,
} from './lib/db'
import { hashPin, randomSalt, verifyPin } from './lib/crypto'
import { downloadBackup, buildBackup, isBackupFile, restoreBackup } from './lib/backup'
import { syncNow } from './lib/sync'
import { sendTransactionToSheet } from './lib/sheets'
import { todayStr, addDays, lastNDates, monthKey } from './lib/date'
import type {
  Branch,
  CartLine,
  Category,
  DailySummary,
  Item,
  Role,
  SessionUser,
  Settings,
  SyncResult,
  Transaction,
  TxnItem,
  User,
} from './types'
import { APP_KEY } from './types'

const SESSION_KEY = 'bb_session_v2'

async function afterSale(args: {
  input: { lines: CartLine[]; method: 'cash' | 'qris'; notes: string; branchId: number | null }
  txnId: number
  date: string
  createdAt: string
  totalAmount: number
  cashAmount: number
  qrisAmount: number
  settings: Settings
  branches: Branch[]
}): Promise<void> {
  const { input, txnId, date, createdAt, totalAmount, cashAmount, qrisAmount, settings, branches } = args

  if (settings.sheetUrl && settings.autoSheet) {
    const branch = input.branchId ? (branches.find((b) => b.id === input.branchId)?.name ?? '') : ''
    const payload = {
      source: APP_KEY,
      type: 'txn' as const,
      meta: { shopName: settings.shopName, branch },
      txn: {
        id: txnId,
        date,
        createdAt,
        method: input.method === 'qris' ? 'qris' : 'cash',
        total: totalAmount,
        cash: cashAmount,
        qris: qrisAmount,
        change: 0,
        notes: input.notes,
        lines: input.lines.map((l) => ({ name: l.name, category: l.category, qty: l.qty, price: l.price, total: l.price * l.qty })),
      },
    }
    void sendTransactionToSheet(settings.sheetUrl, payload).catch(() => {})
  }

  if (settings.syncEndpoint && settings.autoSync) {
    void syncNow(settings.syncEndpoint, settings.syncToken).catch(() => {})
  }
}

interface Session {
  userId: number
  username: string
  role: Role
  exp: number
}

export interface DbView {
  table: string
  rows: DbScanRow[]
  columns: string[]
  editable: string[]
  total: number
}

export interface DbScanRow {
  [key: string]: unknown
  id: number
}

interface AppState {
  ready: boolean
  needsSetup: boolean
  session: SessionUser | null
  users: User[]
  branches: Branch[]
  items: Item[]
  transactions: Transaction[]
  txnItems: TxnItem[]
  settings: Settings
  refresh: () => Promise<void>
  // auth
  registerAdmin: (username: string, pin: string) => Promise<string | null>
  login: (username: string, pin: string) => Promise<string | null>
  logout: () => void
  // users
  addUser: (username: string, pin: string, role: Role) => Promise<string | null>
  resetPin: (id: number, pin: string) => Promise<string | null>
  toggleUserActive: (id: number) => Promise<void>
  deleteUser: (id: number) => Promise<void>
  // branches
  addBranch: (name: string) => Promise<string | null>
  deleteBranch: (id: number) => Promise<void>
  renameBranch: (id: number, name: string) => Promise<void>
  // items
  addItem: (input: { name: string; price: number; category: Category; branchId: number; hidden: boolean }) => Promise<string | null>
  updateItem: (id: number, patch: Partial<Pick<Item, 'name' | 'price' | 'category' | 'isActive' | 'isHidden'>>) => Promise<void>
  deleteItem: (id: number) => Promise<void>
  // transactions + payments
  checkouts: CartLine[]
  setCheckouts: Dispatch<SetStateAction<CartLine[]>>
  createTransaction: (input: { lines: CartLine[]; method: 'cash' | 'qris'; notes: string; branchId: number | null }) => Promise<Transaction>
  // analytics
  dailySummary: (date: string) => DailySummary
  dailyBreakdown: (date: string) => Array<{ itemId: number; name: string; category: Category; quantity: number; total: number }>
  dailyLines: (date: string) => Array<{ name: string; category: Category; quantity: number }>
  revenueSeries: (days: number) => Array<{ date: string; revenue: number; count: number }>
  topItems: (since: string, limit?: number) => Array<{ name: string; category: Category; quantity: number; revenue: number }>
  monthlySeries: (months?: number) => Array<{ month: string; revenue: number; count: number }>
  // settings + data
  saveBarber: (name: string) => Promise<void>
  removeBarber: (name: string) => Promise<void>
  saveSettings: (patch: Partial<Settings>) => Promise<void>
  exportBackup: () => Promise<void>
  importBackupFile: (file: File) => Promise<{ ok: boolean; message: string }>
  syncNowAction: () => Promise<SyncResult>
  // db admin
  dbList: () => Promise<Array<{ table: string; rows: number }>>
  dbScan: (table: string, limit: number, offset: number) => Promise<DbView>
  dbSaveRow: (table: string, id: number, values: Record<string, unknown>) => Promise<void>
  dbDeleteRow: (table: string, id: number) => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

const TABLES = ['users', 'branches', 'items', 'transactions', 'transactionItems']

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [session, setSession] = useState<SessionUser | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [txnItems, setTxnItems] = useState<TxnItem[]>([])
  const [settings, setSettings] = useState<Settings>({
    savedBarbers: [],
    syncEndpoint: '',
    syncToken: '',
    shopName: 'Badboy Barber',
    sheetUrl: '',
    autoSheet: false,
    autoSync: false,
  })
  const [checkouts, setCheckouts] = useState<CartLine[]>([])

  const refresh = useCallback(async () => {
    const [us, br, it, tr, ti, st] = await Promise.all([
      getAll<User>('users'),
      getAll<Branch>('branches'),
      getAll<Item>('items'),
      getAll<Transaction>('transactions'),
      getAll<TxnItem>('transactionItems'),
      allSettings(),
    ])
    setUsers(us)
    setBranches(br)
    setItems(it)
    setTransactions(tr)
    setTxnItems(ti)
    setSettings(st)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        await refresh()
        const admins = await getAll<User>('users')
        setNeedsSetup(admins.filter((u) => u.role === 'admin' && u.isActive).length === 0)
      } catch {
        setNeedsSetup(false)
      } finally {
        setReady(true)
      }

      try {
        const raw = localStorage.getItem(SESSION_KEY)
        if (raw) {
          const s = JSON.parse(raw) as Session
          if (s.exp > Date.now()) {
            const u = await getAll<User>('users')
            const found = u.find((x) => x.id === s.userId)
            if (found && found.isActive) {
              setSession({ id: found.id, username: found.username, role: found.role })
            } else {
              localStorage.removeItem(SESSION_KEY)
            }
          } else {
            localStorage.removeItem(SESSION_KEY)
          }
        }
      } catch {
        /* ignore */
      }
    })()
  }, [refresh])

  const persistSession = useCallback((s: SessionUser) => {
    setSession(s)
    const rec: Session = { userId: s.id, username: s.username, role: s.role, exp: Date.now() + 1000 * 60 * 60 * 12 }
    localStorage.setItem(SESSION_KEY, JSON.stringify(rec))
  }, [])

  const registerAdmin = useCallback(
    async (username: string, pin: string): Promise<string | null> => {
      const name = username.trim()
      if (name.length < 2) return 'Username is too short (min. 2 characters).'
      if (pin.length < 4) return 'PIN must be at least 4 characters.'
      const salt = randomSalt()
      const pinHash = await hashPin(pin, salt)
      await addRow('users', {
        username: name,
        pinSalt: salt,
        pinHash,
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString(),
      })
      await refresh()
      setNeedsSetup(false)
      const all = await getAll<User>('users')
      const u = all.find((x) => x.username === name && x.role === 'admin')
      if (u) persistSession({ id: u.id, username: u.username, role: u.role })
      return null
    },
    [refresh, persistSession]
  )

  const login = useCallback(
    async (username: string, pin: string): Promise<string | null> => {
      const u = users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase())
      if (!u || !u.isActive) return 'Unknown username or inactive account.'
      if (pin.length < 4) return 'PIN must be at least 4 characters.'
      if (!(await verifyPin(pin, u.pinSalt, u.pinHash))) return 'Incorrect PIN.'
      persistSession({ id: u.id, username: u.username, role: u.role })
      return null
    },
    [users, persistSession]
  )

  const logout = useCallback(() => {
    setSession(null)
    setCheckouts([])
    localStorage.removeItem(SESSION_KEY)
  }, [])

  const addUser = useCallback(
    async (username: string, pin: string, role: Role): Promise<string | null> => {
      const name = username.trim()
      if (name.length < 2) return 'Username is too short.'
      if (pin.length < 4) return 'PIN must be at least 4 characters.'
      if (users.some((u) => u.username.toLowerCase() === name.toLowerCase())) return 'Username already exists.'
      const salt = randomSalt()
      const pinHash = await hashPin(pin, salt)
      await addRow('users', {
        username: name,
        pinSalt: salt,
        pinHash,
        role,
        isActive: true,
        createdAt: new Date().toISOString(),
      })
      await refresh()
      return null
    },
    [users, refresh]
  )

  const resetPin = useCallback(
    async (id: number, pin: string): Promise<string | null> => {
      if (pin.length < 4) return 'PIN must be at least 4 characters.'
      const salt = randomSalt()
      const pinHash = await hashPin(pin, salt)
      const u = users.find((x) => x.id === id)
      if (!u) return 'User not found.'
      await putRow('users', { ...u, pinSalt: salt, pinHash })
      await refresh()
      return null
    },
    [users, refresh]
  )

  const toggleUserActive = useCallback(
    async (id: number) => {
      const u = users.find((x) => x.id === id)
      if (!u) return
      await putRow('users', { ...u, isActive: !u.isActive })
      await refresh()
      if (session?.id === id && !u.isActive) logout()
    },
    [users, session, refresh, logout]
  )

  const deleteUser = useCallback(
    async (id: number) => {
      await deleteRow('users', id)
      await refresh()
    },
    [refresh]
  )

  const addBranch = useCallback(
    async (name: string): Promise<string | null> => {
      const n = name.trim()
      if (n.length < 2) return 'Branch name too short.'
      if (branches.some((b) => b.name.toLowerCase() === n.toLowerCase())) return 'Branch already exists.'
      await addRow('branches', {
        name: n,
        isActive: true,
        createdAt: new Date().toISOString(),
      })
      await refresh()
      return null
    },
    [branches, refresh]
  )

  const renameBranch = useCallback(
    async (id: number, name: string) => {
      const b = branches.find((x) => x.id === id)
      if (!b) return
      await putRow('branches', { ...b, name: name.trim() })
      await refresh()
    },
    [branches, refresh]
  )

  const deleteBranch = useCallback(
    async (id: number) => {
      await deleteRow('branches', id)
      await refresh()
    },
    [refresh]
  )

  const addItem = useCallback(
    async (input: { name: string; price: number; category: Category; branchId: number; hidden: boolean }): Promise<string | null> => {
      const n = input.name.trim()
      if (n.length < 2) return 'Name is too short (min. 2 characters).'
      if (!Number.isFinite(input.price) || input.price < 0) return 'Price must be a non-negative number.'
      if (input.price > 99_999_999) return 'Price is too large.'
      if (!input.branchId) return 'Select a branch.'
      await addRow('items', {
        name: n,
        price: input.price,
        category: input.category,
        branchId: input.branchId,
        isActive: true,
        isHidden: !!input.hidden,
        createdAt: new Date().toISOString(),
      })
      await refresh()
      return null
    },
    [refresh]
  )

  const updateItem = useCallback(
    async (id: number, patch: Partial<Pick<Item, 'name' | 'price' | 'category' | 'isActive' | 'isHidden'>>) => {
      const it = items.find((x) => x.id === id)
      if (!it) return
      await putRow('items', { ...it, ...patch })
      await refresh()
    },
    [items, refresh]
  )

  const deleteItem = useCallback(
    async (id: number) => {
      await deleteRow('items', id)
      await refresh()
    },
    [refresh]
  )

  const createTransaction = useCallback(
    async (input: { lines: CartLine[]; method: 'cash' | 'qris'; notes: string; branchId: number | null }): Promise<Transaction> => {
      if (!session) throw new Error('Not signed in')
      const totalAmount = input.lines.reduce((s, l) => s + l.price * l.qty, 0)
      const cashAmount = input.method === 'cash' ? totalAmount : 0
      const qrisAmount = input.method === 'qris' ? totalAmount : 0
      const date = todayStr()
      const createdAt = new Date().toISOString()
      const txnId = await addRow('transactions', {
        userId: session.id,
        branchId: input.branchId,
        totalAmount,
        cashAmount,
        qrisAmount,
        changeAmount: 0,
        notes: input.notes,
        date,
        createdAt,
      })
      for (const line of input.lines) {
        await addRow('transactionItems', {
          transactionId: txnId,
          itemId: line.itemId,
          name: line.name,
          category: line.category,
          unitPrice: line.price,
          quantity: line.qty,
        })
      }
      afterSale({ input, txnId, date, createdAt, totalAmount, cashAmount, qrisAmount, settings, branches })
      await refresh()
      const t = transactions.find((x) => x.id === txnId) ?? {
        id: txnId,
        userId: session.id,
        branchId: input.branchId,
        totalAmount,
        cashAmount,
        qrisAmount,
        changeAmount: 0,
        notes: input.notes,
        date,
        createdAt,
      }
      return t
    },
    [session, transactions, refresh, settings, branches]
  )

  const txnItemsForDate = useCallback(
    (date: string): TxnItem[] => {
      const ids = new Set(transactions.filter((t) => t.date === date).map((t) => t.id))
      return txnItems.filter((ti) => ids.has(ti.transactionId))
    },
    [transactions, txnItems]
  )

  const dailySummary = useCallback(
    (date: string): DailySummary => {
      const txns = transactions.filter((t) => t.date === date)
      const lines = txnItemsForDate(date)
      const totalRevenue = txns.reduce((s, t) => s + (t.totalAmount || 0), 0)
      const totalSales = lines.reduce((s, l) => s + l.quantity, 0)
      const products = lines.filter((l) => l.category === 'product').reduce((s, l) => s + l.unitPrice * l.quantity, 0)
      return {
        date,
        totalTransactions: txns.length,
        totalRevenue,
        totalCash: txns.reduce((s, t) => s + (t.cashAmount || 0), 0),
        totalQris: txns.reduce((s, t) => s + (t.qrisAmount || 0), 0),
        totalChange: txns.reduce((s, t) => s + (t.changeAmount || 0), 0),
        totalSales,
        totalProducts: products,
      }
    },
    [transactions, txnItemsForDate]
  )

  const dailyBreakdown = useCallback(
    (date: string) => {
      const map = new Map<number, { itemId: number; name: string; category: Category; quantity: number; total: number }>()
      for (const l of txnItemsForDate(date)) {
        const g = map.get(l.itemId)
        if (g) {
          g.quantity += l.quantity
          g.total += l.unitPrice * l.quantity
        } else {
          map.set(l.itemId, {
            itemId: l.itemId,
            name: l.name,
            category: l.category,
            quantity: l.quantity,
            total: l.unitPrice * l.quantity,
          })
        }
      }
      return Array.from(map.values())
    },
    [txnItemsForDate]
  )

  const dailyLines = useCallback(
    (date: string) =>
      dailyBreakdown(date).map((b) => ({ name: b.name, category: b.category, quantity: b.quantity })),
    [dailyBreakdown]
  )

  const revenueSeries = useCallback(
    (days: number) => {
      const dates = lastNDates(days)
      return dates.map((date) => {
        const s = dailySummary(date)
        return { date, revenue: s.totalRevenue, count: s.totalTransactions }
      })
    },
    [dailySummary]
  )

  const topItems = useCallback(
    (since: string, limit = 6) => {
      const ids = new Set(transactions.filter((t) => t.date >= since).map((t) => t.id))
      const map = new Map<number, { name: string; category: Category; quantity: number; revenue: number }>()
      for (const l of txnItems) {
        if (!ids.has(l.transactionId)) continue
        const g = map.get(l.itemId)
        const revenue = l.unitPrice * l.quantity
        if (g) {
          g.quantity += l.quantity
          g.revenue += revenue
        } else map.set(l.itemId, { name: l.name, category: l.category, quantity: l.quantity, revenue })
      }
      return Array.from(map.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit)
    },
    [transactions, txnItems]
  )

  const monthlySeries = useCallback(
    (months = 6) => {
      const out: Array<{ month: string; revenue: number; count: number }> = []
      const today = todayStr()
      for (let i = months - 1; i >= 0; i--) {
        const d = addDays(today, -i * 30)
        const m = monthKey(d)
        out.push({ month: m, revenue: 0, count: 0 })
      }
      for (const t of transactions) {
        const m = monthKey(t.date)
        const slot = out.find((o) => o.month === m)
        if (!slot) continue
        slot.revenue += t.totalAmount || 0
        slot.count += 1
      }
      return out
    },
    [transactions]
  )

  const saveBarber = useCallback(
    async (name: string) => {
      const n = name.trim()
      if (!n || settings.savedBarbers.includes(n)) return
      const next = [...settings.savedBarbers, n]
      await setSetting('savedBarbers', next)
      setSettings((s) => ({ ...s, savedBarbers: next }))
    },
    [settings.savedBarbers]
  )

  const removeBarber = useCallback(
    async (name: string) => {
      const next = settings.savedBarbers.filter((b) => b !== name)
      await setSetting('savedBarbers', next)
      setSettings((s) => ({ ...s, savedBarbers: next }))
    },
    [settings.savedBarbers]
  )

  const saveSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch }
      if (patch.syncEndpoint !== undefined) await setSetting('syncEndpoint', patch.syncEndpoint)
      if (patch.syncToken !== undefined) await setSetting('syncToken', patch.syncToken)
      if (patch.shopName !== undefined) await setSetting('shopName', patch.shopName)
      if (patch.savedBarbers !== undefined) await setSetting('savedBarbers', patch.savedBarbers)
      if (patch.sheetUrl !== undefined) await setSetting('sheetUrl', patch.sheetUrl)
      if (patch.autoSheet !== undefined) await setSetting('autoSheet', patch.autoSheet)
      if (patch.autoSync !== undefined) await setSetting('autoSync', patch.autoSync)
      setSettings(next)
    },
    [settings]
  )

  const exportBackup = useCallback(async () => {
    const backup = await buildBackup()
    downloadBackup(backup)
  }, [])

  const importBackupFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        let json: unknown
        try {
          json = JSON.parse(text)
        } catch {
          return { ok: false, message: 'File is not valid JSON.' }
        }
        if (!isBackupFile(json)) return { ok: false, message: 'Not a Badboy Barber backup file.' }
        await restoreBackup(json)
        await refresh()
        return { ok: true, message: 'Data restored successfully.' }
      } catch {
        return { ok: false, message: 'Could not restore backup.' }
      }
    },
    [refresh]
  )

  const syncNowAction = useCallback(async (): Promise<SyncResult> => {
    const result = await syncNow(settings.syncEndpoint, settings.syncToken)
    if (result.ok && (result.pulled || result.pushed)) await refresh()
    return result
  }, [settings.syncEndpoint, settings.syncToken, refresh])

  const dbList = useCallback(async () => {
    const db = await getDb()
    const out: Array<{ table: string; rows: number }> = []
    for (const table of TABLES) {
      out.push({ table, rows: (await db.count(table as never)) as number })
    }
    return out
  }, [])

  const dbScan = useCallback(
    async (table: string, limit: number, offset: number): Promise<DbView> => {
      const db = await getDb()
      const store = db.transaction(table as never, 'readonly').store
      const allRows = (await store.getAll()) as DbScanRow[]
      const total = allRows.length
      const rows = allRows.slice(offset, offset + limit)
      const cols = Array.from(new Set([...rows.flatMap((r) => Object.keys(r)), 'id']))
      const editable = cols.filter((c) => c !== 'id')
      return { table, rows, columns: cols, editable, total }
    },
    []
  )

  const dbSaveRow = useCallback(
    async (table: string, id: number, values: Record<string, unknown>) => {
      const store = `${table}` as 'users' | 'branches' | 'items' | 'transactions' | 'transactionItems'
      const db = await getDb()
      const existing = (await db.get(store, id)) as Record<string, unknown> | undefined
      if (!existing) return
      await putRow(store, { ...existing, ...values, id: existing.id as number })
      await refresh()
    },
    [refresh]
  )

  const dbDeleteRow = useCallback(
    async (table: string, id: number) => {
      const store = `${table}` as 'users' | 'branches' | 'items' | 'transactions' | 'transactionItems'
      await deleteRow(store, id)
      if (table === 'transactions') {
        const items = txnItems.filter((t) => t.transactionId === id)
        for (const it of items) await deleteRow('transactionItems', it.id)
      }
      if (table === 'items') {
        await deleteRow('items', id)
      }
      await refresh()
    },
    [txnItems, refresh]
  )

  const value = useMemo<AppState>(
    () => ({
      ready,
      needsSetup,
      session,
      users,
      branches,
      items,
      transactions,
      txnItems,
      settings,
      refresh,
      registerAdmin,
      login,
      logout,
      addUser,
      resetPin,
      toggleUserActive,
      deleteUser,
      addBranch,
      deleteBranch,
      renameBranch,
      addItem,
      updateItem,
      deleteItem,
      checkouts,
      setCheckouts,
      createTransaction,
      dailySummary,
      dailyBreakdown,
      dailyLines,
      revenueSeries,
      topItems,
      monthlySeries,
      saveBarber,
      removeBarber,
      saveSettings,
      exportBackup,
      importBackupFile,
      syncNowAction,
      dbList,
      dbScan,
      dbSaveRow,
      dbDeleteRow,
    }),
    [
      ready,
      needsSetup,
      session,
      users,
      branches,
      items,
      transactions,
      txnItems,
      settings,
      refresh,
      registerAdmin,
      login,
      logout,
      addUser,
      resetPin,
      toggleUserActive,
      deleteUser,
      addBranch,
      deleteBranch,
      renameBranch,
      addItem,
      updateItem,
      deleteItem,
      checkouts,
      createTransaction,
      dailySummary,
      dailyBreakdown,
      dailyLines,
      revenueSeries,
      topItems,
      monthlySeries,
      saveBarber,
      removeBarber,
      saveSettings,
      exportBackup,
      importBackupFile,
      syncNowAction,
      dbList,
      dbScan,
      dbSaveRow,
      dbDeleteRow,
    ]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}