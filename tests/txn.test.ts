import { describe, it, expect } from 'vitest'
import { itemQtyForTxn } from '../src/lib/txn'
import type { TxnItem } from '../src/types'

const items: TxnItem[] = [
  { id: 1, transactionId: 10, itemId: 1, name: 'Haircut', category: 'service', unitPrice: 25000, quantity: 2 },
  { id: 2, transactionId: 10, itemId: 2, name: 'Pomade', category: 'product', unitPrice: 30000, quantity: 3 },
  { id: 3, transactionId: 11, itemId: 1, name: 'Haircut', category: 'service', unitPrice: 25000, quantity: 9 },
]

describe('itemQtyForTxn', () => {
  it('counts only the item quantities of the given transaction', () => {
    expect(itemQtyForTxn(items, 10)).toBe(5)
    expect(itemQtyForTxn(items, 11)).toBe(9)
  })

  it('returns 0 for a transaction with no items', () => {
    expect(itemQtyForTxn(items, 99)).toBe(0)
  })
})
