import { NextResponse, type NextRequest } from 'next/server'

// When Tailscale serves this app to the Tailnet (`tailscale serve`), it
// attaches an identity header for the authenticated Tailnet user.
// Requests arriving through Tailscale Funnel (the public internet) never
// carry this header, since Funnel traffic has no Tailnet identity.
//
// The primary gate is deployment config: Funnel is only configured to
// forward public path prefixes (see docs/deploy/tailscale.md), so it
// should never reach /admin at all. This header check is defense in
// depth in case that config is ever wrong.
const TAILSCALE_IDENTITY_HEADER = 'Tailscale-User-Login'

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const identity = request.headers.get(TAILSCALE_IDENTITY_HEADER)
    if (!identity) {
      return new NextResponse('Not found', { status: 404 })
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}
