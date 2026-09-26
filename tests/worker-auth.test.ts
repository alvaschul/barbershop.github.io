import { describe, it, expect } from 'vitest'
import { authorized } from '../workers/d1-sync/src/index'

function req(token?: string): Request {
  return new Request('https://sync.example/api/sync', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

describe('worker authorized()', () => {
  it('fails closed when no SYNC_TOKEN is configured', async () => {
    expect(await authorized(req('anything'), { SYNC_TOKEN: undefined } as never)).toBe(false)
    expect(await authorized(req(), {} as never)).toBe(false)
  })

  it('accepts the matching bearer token', async () => {
    expect(await authorized(req('s3cret'), { SYNC_TOKEN: 's3cret' } as never)).toBe(true)
  })

  it('rejects a wrong or missing token', async () => {
    expect(await authorized(req('nope'), { SYNC_TOKEN: 's3cret' } as never)).toBe(false)
    expect(await authorized(req(), { SYNC_TOKEN: 's3cret' } as never)).toBe(false)
  })
})
