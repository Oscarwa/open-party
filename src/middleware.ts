import { NextResponse, type NextRequest } from 'next/server'
import { loadEnv } from '@/lib/env'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/adminSession'

// /admin is intentionally public (reachable at the Funnel URL) — see
// docs/deploy/tailscale.md. The ONLY thing gating it is a valid, signed
// session cookie, set by src/lib/actions/auth.ts's loginAction after a
// correct ADMIN_PASSWORD check. /admin/login itself must stay reachable
// unconditionally, or nobody could ever log in.
//
// That exemption is the single hole in the app's only security boundary, so
// treat everything sharing a component tree with /admin/login as
// unauthenticated code. Concretely: `src/app/admin/layout.tsx` wraps this
// exempt route, so nothing that mutates state — no Server Action, no
// privileged data fetch — may live in it, or it becomes reachable from a
// request with no session at all. Gated chrome and actions belong in
// `src/app/admin/(gated)/layout.tsx`, which only wraps routes this check
// protects. Mutating actions additionally re-verify the session themselves
// via requireAdminSession() (src/lib/actions/auth.ts) rather than trusting
// this middleware alone.
const LOGIN_PATH = '/admin/login'

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  if (request.nextUrl.pathname === LOGIN_PATH) {
    return NextResponse.next()
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const env = loadEnv()
  const isValid = token ? await verifySessionToken(token, env.SESSION_SECRET) : false

  if (!isValid) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}
