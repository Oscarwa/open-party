'use server'

import { timingSafeEqual } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { loadEnv } from '@/lib/env'
import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
} from '@/lib/adminSession'
import { isRateLimited, recordFailedAttempt } from '@/lib/loginRateLimit'

function passwordsMatch(input: string, expected: string): boolean {
  const inputBuffer = Buffer.from(input)
  const expectedBuffer = Buffer.from(expected)
  // timingSafeEqual throws on a length mismatch, so check that first.
  // Bailing out early on length still doesn't leak *which* character of an
  // equal-length attempt was wrong, which is the property this guards.
  if (inputBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(inputBuffer, expectedBuffer)
}

// Derives the per-client rate-limit key from X-Forwarded-For.
//
// We take the RIGHTMOST entry, not the leftmost. A reverse-proxy chain
// APPENDS each hop to the right, so the leftmost entry is whatever the
// original client claimed — fully attacker-controlled. An attacker sending
// a different fake leftmost IP on every request would otherwise get a fresh
// rate-limit bucket each time, defeating the lockout entirely. The rightmost
// entry is written by the last proxy in front of this app (Tailscale Funnel
// here), i.e. by infrastructure we control, so it's the only entry worth
// trusting.
//
// Two known weaknesses, both bounded by the global backstop in loginAction:
//   - If the header is absent (or empty after parsing), every caller shares
//     the 'global' bucket — worse than per-IP, but not a bypass.
//   - If a second trusted hop is ever added in front of Funnel, the
//     rightmost entry becomes that hop's address and again collapses all
//     callers into one bucket. Also degraded, still not a bypass.
async function getClientKey(): Promise<string> {
  const headerList = await headers()
  const forwardedFor = headerList.get('x-forwarded-for')
  if (!forwardedFor) return 'global'
  const hops = forwardedFor
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean)
  return hops.pop() ?? 'global'
}

// A fixed key counted alongside the per-client key, so total login attempts
// are capped even when per-client keying degrades (header absent, extra
// trusted hop collapsing every caller into one bucket, etc.). Prefixed and
// suffixed so it can't collide with a real IP-shaped key.
const GLOBAL_RATE_LIMIT_KEY = '__global__'

export async function loginAction(formData: FormData) {
  const env = loadEnv()
  const key = await getClientKey()

  // Limited if EITHER bucket is exhausted; a failure increments BOTH.
  if (isRateLimited(key) || isRateLimited(GLOBAL_RATE_LIMIT_KEY)) {
    redirect('/admin/login?error=rate_limited')
  }

  const password = formData.get('password')
  if (typeof password !== 'string' || !passwordsMatch(password, env.ADMIN_PASSWORD)) {
    recordFailedAttempt(key)
    recordFailedAttempt(GLOBAL_RATE_LIMIT_KEY)
    redirect('/admin/login?error=invalid_password')
  }

  const token = await createSessionToken(env.SESSION_SECRET)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days — matches the token's own expiry
  })

  redirect('/admin')
}

// Defence in depth for state-mutating Server Actions. src/middleware.ts
// gates the *pages* that render admin forms, but a Server Action is its own
// POST endpoint: whether an action ID is reachable without having loaded a
// gated page depends on Next.js's internal action-manifest scoping, which is
// framework behavior this app shouldn't stake its only auth boundary on. So
// every mutating action re-checks the session itself.
//
// Throws rather than redirecting: a thrown error surfaces through
// src/app/admin/error.tsx, the same path EventActionError already takes.
export async function requireAdminSession(): Promise<void> {
  const env = loadEnv()
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const isValid = token ? await verifySessionToken(token, env.SESSION_SECRET) : false
  if (!isValid) {
    throw new Error('Not authenticated. Please log in again.')
  }
}

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
  redirect('/admin/login')
}
