import { NextResponse, type NextRequest } from 'next/server'

// When Tailscale serves this app to the Tailnet (`tailscale serve`), it
// attaches an identity header for the authenticated Tailnet user.
//
// PRIMARY BOUNDARY: the deployment's Tailscale Funnel path configuration.
// Funnel is only ever pointed at public path prefixes, never at anything
// reaching /admin (see docs/deploy/tailscale.md). That config — not this
// file — is what keeps /admin off the public internet.
//
// DEFENSE IN DEPTH: the header check below, meant to survive a Funnel
// misconfiguration that accidentally exposes /admin. Its effectiveness
// rests on an assumption we have NOT verified: that Tailscale strips or
// overrides a client-supplied Tailscale-User-Login header on
// Funnel-origin requests. If it does not, a public attacker can forge the
// header and this check is worthless. docs/deploy/tailscale.md step 4
// gives operators a curl-based check to run against their own deployment.
// Never relax the Funnel path config on the strength of this check.
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
