import { describe, it, expect } from 'vitest'
import { handlePut } from '../workers/d1-sync/src/index'
import { APP_KEY, type BackupFile, type Settings } from '../src/types'

type Row = Record<string, unknown>

class FakeStmt {
  constructor(private db: FakeDb, private sql: string, private params: unknown[] = []) {}
  bind(...params: unknown[]): FakeStmt {
    return new FakeStmt(this.db, this.sql, params)
  }
  async run(): Promise<unknown> {
    this.db.runCalls++
    this.db.apply(this.sql, this.params)
    return { success: true }
  }
}

class FakeDb {
  batchCalls = 0
  runCalls = 0
  failOnInsertIntoUsers = false
  tables: Record<string, Row[]> = {
    users: [{ id: 1, username: 'seed' }],
    branches: [],
    items: [],
    transactions: [],
    transaction_items: [],
    meta: [],
  }

  prepare(sql: string): FakeStmt {
    return new FakeStmt(this, sql)
  }

  async batch(stmts: FakeStmt[]): Promise<unknown> {
    this.batchCalls++
    const snapshot = structuredClone(this.tables)
    try {
      for (const stmt of stmts as unknown as { sql: string; params: unknown[] }[]) {
        if (this.failOnInsertIntoUsers && /^INSERT INTO users/i.test(stmt.sql)) {
          throw new Error('NOT NULL constraint failed: users.pin_hash')
        }
        this.apply(stmt.sql, stmt.params)
      }
    } catch (e) {
      this.tables = snapshot
      throw e
    }
    return []
  }

  apply(sql: string, params: unknown[]): void {
    const del = sql.match(/^DELETE FROM (\w+)/i)
    if (del) {
      this.tables[del[1]] = []
      return
    }
    const ins = sql.match(/^INSERT(?: OR REPLACE)? INTO (\w+)/i)
    if (ins) {
      const table = ins[1]
      if (table === 'meta') {
        this.tables.meta.push({ key: params[0], value: params[1] })
        return
      }
      const cols = sql.match(/\(([^)]+)\)/)?.[1] ?? ''
      const names = cols.split(',').map((c) => c.trim())
      const row: Row = {}
      names.forEach((name, i) => (row[name] = params[i]))
      this.tables[table].push(row)
      return
    }
    throw new Error('Unsupported SQL in fake D1: ' + sql)
  }
}

function makeBackup(patch: Partial<BackupFile['data']> = {}): BackupFile {
  const settings: Settings = {
    savedBarbers: ['Andi'],
    syncEndpoint: '',
    syncToken: '',
    shopName: 'Badboy',
    sheetUrl: '',
    autoSheet: false,
    autoSync: false,
  }
  return {
    app: APP_KEY,
    version: 1,
    exportedAt: '2026-09-26T00:00:00.000Z',
    data: {
      users: [],
      branches: [],
      items: [],
      transactions: [],
      transactionItems: [],
      settings,
      ...patch,
    },
  }
}

function putRequest(backup: BackupFile): Request {
  return new Request('https://sync.example/api/sync', {
    method: 'PUT',
    body: JSON.stringify({ updatedAt: backup.exportedAt, backup }),
  })
}

describe('handlePut', () => {
  it('writes the whole overwrite as one atomic batch (no statement outside it)', async () => {
    const db = new FakeDb()
    const res = await handlePut(putRequest(makeBackup()), { DB: db } as never)
    expect(res.status).toBe(200)
    expect(db.batchCalls).toBe(1)
    expect(db.runCalls).toBe(0)
  })

  it('leaves existing rows untouched when a statement fails (no wipe-and-die)', async () => {
    const db = new FakeDb()
    db.failOnInsertIntoUsers = true
    const res = await handlePut(
      putRequest(makeBackup({ users: [{ id: 9, username: 'broken' }] as never })),
      { DB: db } as never
    )
    expect(res.status).toBe(500)
    expect(db.tables.users).toHaveLength(1)
  })
})
