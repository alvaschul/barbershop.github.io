export interface Env {
  DB: D1Database
  SYNC_TOKEN?: string
}

const APP_KEY = 'badboy-barber-pages'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
}

interface Backup {
  app: string
  version: number
  exportedAt: string
  data: {
    users: unknown[]
    branches: unknown[]
    items: unknown[]
    transactions: unknown[]
    transactionItems: unknown[]
    settings: { savedBarbers: string[]; syncEndpoint: string; syncToken: string; shopName: string }
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

function boolToInt(b: unknown): (0 | 1) {
  return b === true || b === 1 ? 1 : 0
}

function intToBool<T>(r: T & Record<string, unknown>): T {
  for (const k of ['isActive', 'isHidden']) {
    if (typeof r[k] === 'number') r[k] = r[k] === 1
  }
  return r
}

function rowToUser(r: Record<string, unknown>) {
  return intToBool<Pick<typeof r, string> & { isActive?: boolean }>(r)
}

async function authorized(req: Request, env: Env): Promise<boolean> {
  const token = env.SYNC_TOKEN
  if (!token) return true
  const header = req.headers.get('Authorization') || ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!provided || provided.length !== token.length) return false
  const a = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(provided))
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return bytesToHex(a) === bytesToHex(b)
}

function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
}

async function buildBackup(env: Env): Promise<{ backup: Backup; updatedAt: string }> {
  const [users, branches, items, transactions, transactionItems, meta] = await Promise.all([
    env.DB.prepare('SELECT * FROM users ORDER BY id').all(),
    env.DB.prepare('SELECT * FROM branches ORDER BY id').all(),
    env.DB.prepare('SELECT * FROM items ORDER BY id').all(),
    env.DB.prepare('SELECT * FROM transactions ORDER BY id').all(),
    env.DB.prepare('SELECT * FROM transaction_items ORDER BY id').all(),
    env.DB.prepare('SELECT * FROM meta').all(),
  ])
  const metaMap: Record<string, string> = {}
  for (const row of meta.results) metaMap[String(row.key)] = String(row.value)

  const rowUser = (r: Record<string, unknown>) => ({
    id: Number(r.id),
    username: String(r.username),
    pinSalt: String(r.pin_salt),
    pinHash: String(r.pin_hash),
    role: String(r.role),
    isActive: Number(r.is_active) === 1,
    createdAt: String(r.created_at),
  })
  const rowBranch = (r: Record<string, unknown>) => ({
    id: Number(r.id),
    name: String(r.name),
    isActive: Number(r.is_active) === 1,
    createdAt: String(r.created_at),
  })
  const rowItem = (r: Record<string, unknown>) => ({
    id: Number(r.id),
    name: String(r.name),
    price: Number(r.price),
    category: String(r.category),
    branchId: Number(r.branch_id),
    isActive: Number(r.is_active) === 1,
    isHidden: Number(r.is_hidden) === 1,
    createdAt: String(r.created_at),
  })
  const rowTxn = (r: Record<string, unknown>) => ({
    id: Number(r.id),
    userId: Number(r.user_id),
    branchId: r.branch_id === null ? null : Number(r.branch_id),
    totalAmount: Number(r.total_amount),
    cashAmount: Number(r.cash_amount),
    qrisAmount: Number(r.qris_amount),
    changeAmount: Number(r.change_amount),
    notes: r.notes === null ? '' : String(r.notes),
    date: String(r.date),
    createdAt: String(r.created_at),
  })
  const rowTxnItem = (r: Record<string, unknown>) => ({
    id: Number(r.id),
    transactionId: Number(r.transaction_id),
    itemId: r.item_id === null ? 0 : Number(r.item_id),
    name: String(r.name),
    category: String(r.category),
    unitPrice: Number(r.unit_price),
    quantity: Number(r.quantity),
  })

  const savedBarbers = metaMap.saved_barbers ? JSON.parse(metaMap.saved_barbers) : []
  const backup: Backup = {
    app: APP_KEY,
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      users: users.results.map(rowUser),
      branches: branches.results.map(rowBranch),
      items: items.results.map(rowItem),
      transactions: transactions.results.map(rowTxn),
      transactionItems: transactionItems.results.map(rowTxnItem),
      settings: {
        savedBarbers: Array.isArray(savedBarbers) ? savedBarbers : [],
        syncEndpoint: '',
        syncToken: '',
        shopName: metaMap.shop_name || 'Badboy Barber',
      },
    },
  }
  const updatedAt = metaMap.updated_at || '1970-01-01T00:00:00.000Z'
  return { backup, updatedAt }
}

async function handlePut(req: Request, env: Env): Promise<Response> {
  let body: { updatedAt?: string; backup?: Backup }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, message: 'Invalid JSON body.' }, 400)
  }
  const backup = body.backup
  if (!backup || backup.app !== APP_KEY || !backup.data) {
    return json({ ok: false, message: 'Not a Badboy Barber backup.' }, 400)
  }
  const d = backup.data
  const updatedAt = body.updatedAt || new Date().toISOString()

  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM users'),
      env.DB.prepare('DELETE FROM branches'),
      env.DB.prepare('DELETE FROM items'),
      env.DB.prepare('DELETE FROM transactions'),
      env.DB.prepare('DELETE FROM transaction_items'),
    ])

    const userStmt = env.DB.prepare(
      'INSERT INTO users (id, username, pin_salt, pin_hash, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    for (const u of d.users as Array<Record<string, unknown>>) {
      await userStmt.bind(u.id, u.username, u.pinSalt, u.pinHash, u.role, boolToInt(u.isActive), u.createdAt).run()
    }

    const branchStmt = env.DB.prepare(
      'INSERT INTO branches (id, name, is_active, created_at) VALUES (?, ?, ?, ?)'
    )
    for (const b of d.branches as Array<Record<string, unknown>>) {
      await branchStmt.bind(b.id, b.name, boolToInt(b.isActive), b.createdAt).run()
    }

    const itemStmt = env.DB.prepare(
      'INSERT INTO items (id, name, price, category, branch_id, is_active, is_hidden, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    for (const i of d.items as Array<Record<string, unknown>>) {
      await itemStmt
        .bind(i.id, i.name, i.price, i.category, i.branchId, boolToInt(i.isActive), boolToInt(i.isHidden), i.createdAt)
        .run()
    }

    const txnStmt = env.DB.prepare(
      'INSERT INTO transactions (id, user_id, branch_id, total_amount, cash_amount, qris_amount, change_amount, notes, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    for (const t of d.transactions as Array<Record<string, unknown>>) {
      await txnStmt
        .bind(t.id, t.userId, t.branchId ?? null, t.totalAmount, t.cashAmount, t.qrisAmount, t.changeAmount, t.notes ?? '', t.date, t.createdAt)
        .run()
    }

    const txnItemStmt = env.DB.prepare(
      'INSERT INTO transaction_items (id, transaction_id, item_id, name, category, unit_price, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    for (const ti of d.transactionItems as Array<Record<string, unknown>>) {
      await txnItemStmt
        .bind(ti.id, ti.transactionId, ti.itemId, ti.name, ti.category, ti.unitPrice, ti.quantity)
        .run()
    }

    const saved = Array.isArray(d.settings?.savedBarbers) ? JSON.stringify(d.settings.savedBarbers) : '[]'
    const shopName = d.settings?.shopName || 'Badboy Barber'
    await env.DB.batch([
      env.DB.prepare('DELETE FROM meta'),
      env.DB.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').bind('updated_at', updatedAt),
      env.DB.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').bind('saved_barbers', saved),
      env.DB.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').bind('shop_name', shopName),
    ])
  } catch (e) {
    return json({ ok: false, message: 'Write failed: ' + String(e) }, 500)
  }
  return json({ ok: true, updatedAt })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }
    if (!(await authorized(req, env))) {
      return json({ ok: false, message: 'Unauthorized' }, 401)
    }
    const url = new URL(req.url)
    if (url.pathname === '/api/health') {
      return json({ ok: true, db: 'd1' })
    }
    if (url.pathname === '/api/sync' && req.method === 'GET') {
      const { backup, updatedAt } = await buildBackup(env)
      return json({ updatedAt, backup })
    }
    if (url.pathname === '/api/sync' && req.method === 'PUT') {
      return handlePut(req, env)
    }
    return json({ ok: false, message: 'Not found' }, 404)
  },
}