import { describe, it, expect } from 'vitest'
import { addRow, deleteDatabase, getAll } from '../src/lib/db'

describe('deleteDatabase', () => {
  it('actually wipes all data and resolves (connection is closed first)', async () => {
    await addRow('branches', { name: 'Playen', isActive: true, createdAt: '2026-09-26T00:00:00.000Z' })
    expect((await getAll('branches')).length).toBe(1)

    await deleteDatabase()

    expect((await getAll('branches')).length).toBe(0)
  })
})
