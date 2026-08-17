'use server'

import { timingSafeEqual } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { loadEnv } from '@/lib/env'
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/adminSession'
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

// Tailscale Funnel is expected to forward X-Forwarded-For with the real
// client IP (standard reverse-proxy behavior), but this hasn't been
// independently verified against this specific deployment the way the
// old Tailscale-User-Login header behavior was (see the removed
// docs/deploy/tailscale.md verification step this plan's Task 6 deletes).
// If it's ever absent, every caller shares one 'global' bucket — a real
// but strictly worse-than-per-IP rate limit, not a silent bypass.
async function getClientKey(): Promise<string> {
  const headerList = await headers()
  const forwardedFor = headerList.get('x-forwarded-for')
  return forwardedFor ? forwardedFor.split(',')[0].trim() : 'global'
}

export async function loginAction(formData: FormData) {
  const env = loadEnv()
  const key = await getClientKey()

  if (isRateLimited(key)) {
    redirect('/admin/login?error=rate_limited')
  }

  const password = formData.get('password')
  if (typeof password !== 'string' || !passwordsMatch(password, env.ADMIN_PASSWORD)) {
    recordFailedAttempt(key)
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

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
  redirect('/admin/login')
}
