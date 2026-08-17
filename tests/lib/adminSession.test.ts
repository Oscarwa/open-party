import { describe, it, expect } from 'vitest'
import { createSessionToken, verifySessionToken } from '../../src/lib/adminSession'

const SECRET = 'test-session-secret-at-least-32-chars'

describe('admin session token', () => {
  it('accepts a freshly-signed token', async () => {
    const token = await createSessionToken(SECRET)
    expect(await verifySessionToken(token, SECRET)).toBe(true)
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await createSessionToken(SECRET)
    expect(
      await verifySessionToken(token, 'a-completely-different-secret-32c'),
    ).toBe(false)
  })

  it('rejects an expired token', async () => {
    const now = Date.now()
    const signedThirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000
    const token = await createSessionToken(SECRET, signedThirtyOneDaysAgo)
    expect(await verifySessionToken(token, SECRET, now)).toBe(false)
  })
})
