import type { TxnItem } from '../types'

export function itemQtyForTxn(txnItems: TxnItem[], txnId: number): number {
  let total = 0
  for (const ti of txnItems) {
    if (ti.transactionId === txnId) total += ti.quantity
  }
  return total
}
