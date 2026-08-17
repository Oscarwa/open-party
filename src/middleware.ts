import { NextResponse, type NextRequest } from 'next/server'
import { loadEnv } from '@/lib/env'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/adminSession'
import { ATTENDEE_SESSION_COOKIE_NAME, verifyAttendeeSessionToken } from '@/lib/attendeeSession'

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

// /events/* is gated the same way, on a separate attendee session cookie.
// /e/[token] (the magic-link Route Handler) is what ESTABLISHES that
// cookie in the first place, so it must never be gated — it isn't under
// this matcher at all (see config.matcher below), same as how
// /admin/login isn't gated despite living under /admin.
const NO_ATTENDEE_SESSION_REDIRECT = '/'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/admin')) {
    if (pathname === LOGIN_PATH) {
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

  if (pathname.startsWith('/events')) {
    const token = request.cookies.get(ATTENDEE_SESSION_COOKIE_NAME)?.value
    const env = loadEnv()
    const userId = token ? await verifyAttendeeSessionToken(token, env.SESSION_SECRET) : null
    if (!userId) {
      return NextResponse.redirect(new URL(NO_ATTENDEE_SESSION_REDIRECT, request.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/events/:path*'],
}
