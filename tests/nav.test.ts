import { describe, it, expect } from 'vitest'
import { resolveTab } from '../src/lib/nav'

describe('resolveTab', () => {
  it('keeps settings for admins', () => {
    expect(resolveTab('settings', 'admin')).toBe('settings')
  })

  it('redirects non-admins away from the admin-only settings tab', () => {
    expect(resolveTab('settings', 'cashier')).toBe('pos')
  })

  it('redirects to pos when there is no session', () => {
    expect(resolveTab('settings', null)).toBe('pos')
  })

  it('leaves ordinary tabs untouched', () => {
    expect(resolveTab('reports', 'cashier')).toBe('reports')
    expect(resolveTab('items', 'admin')).toBe('items')
  })
})
