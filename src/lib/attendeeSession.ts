// Attendee session tokens — the counterpart to src/lib/adminSession.ts,
// sharing its underlying primitive (src/lib/sessionToken.ts) but with its
// own signing context and cookie name, so the two session types can never
// be confused for one another even though both derive from SESSION_SECRET.
//
// Unlike the admin session (which carries no payload — the cookie's mere
// validity is the only fact that matters), an attendee session carries
// the attendee's userId, so pages can identify who's browsing without a
// separate lookup.

import { signToken, verifyToken } from './sessionToken'

export const ATTENDEE_SESSION_COOKIE_NAME = 'attendee_session'

const SIGNING_CONTEXT = 'attendee-session:v1'
const SESSION_DURATION_MS = 90 * 24 * 60 * 60 * 1000 // 90 days

export async function createAttendeeSessionToken(
  userId: string,
  secret: string,
  now: number = Date.now(),
): Promise<string> {
  return signToken(SIGNING_CONTEXT, userId, secret, SESSION_DURATION_MS, now)
}

export async function verifyAttendeeSessionToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): Promise<string | null> {
  const result = await verifyToken(SIGNING_CONTEXT, token, secret, now)
  return result.valid ? result.payload : null
}
