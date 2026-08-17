import { NextResponse, type NextRequest } from 'next/server'
import { loadEnv } from '@/lib/env'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/adminSession'

// /admin is intentionally public (reachable at the Funnel URL) — see
// docs/deploy/tailscale.md. The ONLY thing gating it is a valid, signed
// session cookie, set by src/lib/actions/auth.ts's loginAction after a
// correct ADMIN_PASSWORD check. /admin/login itself must stay reachable
// unconditionally, or nobody could ever log in.
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
