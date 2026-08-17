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

  it('rejects a token with a tampered expiry', async () => {
    const token = await createSessionToken(SECRET)
    const [expiresAt, signature] = token.split('.')
    const tampered = `${Number(expiresAt) + 1_000_000}.${signature}`
    expect(await verifySessionToken(tampered, SECRET)).toBe(false)
  })

  it('rejects a malformed token', async () => {
    expect(await verifySessionToken('not-a-real-token', SECRET)).toBe(false)
    expect(await verifySessionToken('', SECRET)).toBe(false)
  })

  it('rejects a signature over the bare expiry, without the admin-session context', async () => {
    // Stands in for any other token minted from the same SESSION_SECRET
    // (e.g. a future attendee magic link) that happens to share this
    // `<timestamp>.<signature>` shape. Domain separation must keep it from
    // validating as an admin session.
    const expiresAt = Date.now() + 60_000
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signature = await crypto.subtle.sign(
      { name: 'HMAC', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(String(expiresAt)),
    )
    const base64url = Buffer.from(signature).toString('base64url')
    expect(await verifySessionToken(`${expiresAt}.${base64url}`, SECRET)).toBe(false)
  })

  it('rejects an expired token', async () => {
    const now = Date.now()
    const signedThirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000
    const token = await createSessionToken(SECRET, signedThirtyOneDaysAgo)
    expect(await verifySessionToken(token, SECRET, now)).toBe(false)
  })
})
