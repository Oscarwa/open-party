import { describe, it, expect } from 'vitest'
import { signToken, verifyToken } from '../../src/lib/sessionToken'

const SECRET = 'test-session-secret-at-least-32-chars'
const CONTEXT = 'test-context:v1'
const DAY_MS = 24 * 60 * 60 * 1000

describe('sessionToken', () => {
  it('round-trips a signed token, returning the original payload', async () => {
    const token = await signToken(CONTEXT, 'some-payload', SECRET, DAY_MS)
    const result = await verifyToken(CONTEXT, token, SECRET)
    expect(result).toEqual({ valid: true, payload: 'some-payload' })
  })

  it('rejects a token verified with the wrong secret', async () => {
    const token = await signToken(CONTEXT, 'payload', SECRET, DAY_MS)
    const result = await verifyToken(CONTEXT, token, 'a-completely-different-secret-32c')
    expect(result.valid).toBe(false)
  })

  it('rejects a token verified under a different context — the whole point of this module', async () => {
    const token = await signToken(CONTEXT, 'payload', SECRET, DAY_MS)
    const result = await verifyToken('a-different-context:v1', token, SECRET)
    expect(result.valid).toBe(false)
  })

  it('rejects a token with a tampered payload segment', async () => {
    const token = await signToken(CONTEXT, 'payload', SECRET, DAY_MS)
    const [, expiresAt, signature] = token.split('.')
    const tampered = `dGFtcGVyZWQ.${expiresAt}.${signature}` // "tampered" base64url, wrong length is fine
    const result = await verifyToken(CONTEXT, tampered, SECRET)
    expect(result.valid).toBe(false)
  })

  it('rejects a token with a tampered expiry segment', async () => {
    const token = await signToken(CONTEXT, 'payload', SECRET, DAY_MS)
    const [payload, expiresAt, signature] = token.split('.')
    const tampered = `${payload}.${Number(expiresAt) + 1_000_000}.${signature}`
    const result = await verifyToken(CONTEXT, tampered, SECRET)
    expect(result.valid).toBe(false)
  })

  it('rejects a malformed token (wrong number of segments)', async () => {
    expect((await verifyToken(CONTEXT, 'not-a-real-token', SECRET)).valid).toBe(false)
    expect((await verifyToken(CONTEXT, '', SECRET)).valid).toBe(false)
    expect((await verifyToken(CONTEXT, 'a.b', SECRET)).valid).toBe(false)
  })

  it('rejects an expired token', async () => {
    const now = Date.now()
    const signedTwoDaysAgo = now - 2 * DAY_MS
    const token = await signToken(CONTEXT, 'payload', SECRET, DAY_MS, signedTwoDaysAgo)
    const result = await verifyToken(CONTEXT, token, SECRET, now)
    expect(result.valid).toBe(false)
  })
})
