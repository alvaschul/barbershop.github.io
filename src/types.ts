export type Role = 'admin' | 'cashier'
export type Category = 'service' | 'product'
export type PaymentMethod = 'cash' | 'qris'

export interface User {
  id: number
  username: string
  pinSalt: string
  pinHash: string
  role: Role
  isActive: boolean
  createdAt: string
}

export interface Branch {
  id: number
  name: string
  isActive: boolean
  createdAt: string
}

export interface Item {
  id: number
  name: string
  price: number
  category: Category
  branchId: number
  isActive: boolean
  isHidden: boolean
  createdAt: string
}

export interface TxnItem {
  id: number
  transactionId: number
  itemId: number
  name: string
  category: Category
  unitPrice: number
  quantity: number
}

export interface Transaction {
  id: number
  userId: number
  branchId: number | null
  totalAmount: number
  cashAmount: number
  qrisAmount: number
  changeAmount: number
  notes: string
  date: string
  createdAt: string
}

export interface Settings {
  savedBarbers: string[]
  syncEndpoint: string
  syncToken: string
  shopName: string
}

export interface DailySummary {
  date: string
  totalTransactions: number
  totalRevenue: number
  totalCash: number
  totalQris: number
  totalChange: number
  totalSales: number
  totalProducts: number
}

export interface SessionUser {
  id: number
  username: string
  role: Role
}

export interface CartLine {
  itemId: number
  name: string
  price: number
  category: Category
  qty: number
}

export interface SyncResult {
  ok: boolean
  pulled?: number
  pushed?: boolean
  message: string
}

export interface BackupFile {
  app: string
  version: number
  exportedAt: string
  data: {
    users: User[]
    branches: Branch[]
    items: Item[]
    transactions: Transaction[]
    transactionItems: TxnItem[]
    settings: Settings
  }
}

export interface DbRow {
  [key: string]: unknown
  id: number
}

export const DB_VERSION = 1
export const DB_NAME = 'badboy-barber-pos'
export const APP_KEY = 'badboy-barber-pages'