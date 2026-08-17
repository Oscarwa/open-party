// Admin session tokens — a thin wrapper over the generic primitive in
// src/lib/sessionToken.ts. See that file for why context-binding matters;
// 'admin-session:v1' is this wrapper's context, so no other token type
// (e.g. an attendee session) can ever verify as an admin session.

import { signToken, verifyToken } from './sessionToken'

export const SESSION_COOKIE_NAME = 'admin_session'

const SIGNING_CONTEXT = 'admin-session:v1'
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export async function createSessionToken(
  secret: string,
  now: number = Date.now(),
): Promise<string> {
  return signToken(SIGNING_CONTEXT, '', secret, SESSION_DURATION_MS, now)
}

export async function verifySessionToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): Promise<boolean> {
  const result = await verifyToken(SIGNING_CONTEXT, token, secret, now)
  return result.valid
}
