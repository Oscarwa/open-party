import { describe, it, expect } from 'vitest'
import {
  createAttendeeSessionToken,
  verifyAttendeeSessionToken,
} from '../../src/lib/attendeeSession'

const SECRET = 'test-session-secret-at-least-32-chars'
const USER_ID = '11111111-1111-1111-1111-111111111111'

describe('attendee session token', () => {
  it('accepts a freshly-signed token and returns the userId', async () => {
    const token = await createAttendeeSessionToken(USER_ID, SECRET)
    expect(await verifyAttendeeSessionToken(token, SECRET)).toBe(USER_ID)
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await createAttendeeSessionToken(USER_ID, SECRET)
    expect(
      await verifyAttendeeSessionToken(token, 'a-completely-different-secret-32c'),
    ).toBeNull()
  })

  it('rejects an expired token', async () => {
    const now = Date.now()
    const signedNinetyOneDaysAgo = now - 91 * 24 * 60 * 60 * 1000
    const token = await createAttendeeSessionToken(USER_ID, SECRET, signedNinetyOneDaysAgo)
    expect(await verifyAttendeeSessionToken(token, SECRET, now)).toBeNull()
  })

  it('does not verify as a valid admin session', async () => {
    // Cross-module smoke check: an attendee token must not accidentally
    // satisfy the admin session's own verify function. The underlying
    // context-binding property is already proven generically in
    // tests/lib/sessionToken.test.ts — this just confirms the two real
    // wrapper modules actually used different contexts, not just that
    // the primitive supports doing so.
    const { verifySessionToken } = await import('../../src/lib/adminSession')
    const token = await createAttendeeSessionToken(USER_ID, SECRET)
    expect(await verifySessionToken(token, SECRET)).toBe(false)
  })
})
