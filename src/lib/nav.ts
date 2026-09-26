import type { Role } from '../types'

export type TabId = 'pos' | 'items' | 'reports' | 'settings'

export function resolveTab(tab: TabId, role: Role | null): TabId {
  if (!role) return 'pos'
  if (tab === 'settings' && role !== 'admin') return 'pos'
  return tab
}
