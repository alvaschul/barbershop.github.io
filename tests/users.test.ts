import { describe, it, expect } from 'vitest'
import { shouldLogoutAfterToggle } from '../src/lib/users'

describe('shouldLogoutAfterToggle', () => {
  it('logs out when the session user is deactivated', () => {
    expect(shouldLogoutAfterToggle(true, true)).toBe(true)
  })

  it('keeps the session when a different user is toggled', () => {
    expect(shouldLogoutAfterToggle(false, true)).toBe(false)
  })

  it('keeps the session when the session user is reactivated', () => {
    expect(shouldLogoutAfterToggle(true, false)).toBe(false)
  })
})
