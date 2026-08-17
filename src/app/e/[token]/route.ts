import { NextResponse, type NextRequest } from 'next/server'
import { loadEnv } from '@/lib/env'
import { createAttendeeSessionToken, ATTENDEE_SESSION_COOKIE_NAME } from '@/lib/attendeeSession'
import { getInviteeByToken } from '@/lib/rsvp'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const invitee = await getInviteeByToken(token)

  if (!invitee) {
    // A relative Location, not `NextResponse.redirect(new URL(path,
    // request.url))`: behind the reverse proxy this app is deployed behind
    // (Tailscale Serve/Funnel), `request.url`'s host reflects the internal
    // bind address, not the public hostname — an absolute redirect built
    // from it sends the browser to an unreachable address. Middleware
    // doesn't hit this (its edge runtime resolves the host correctly), but
    // this Route Handler runs in the Node runtime, so it can't rely on the
    // same resolution. A relative Location sidesteps host detection
    // entirely; every browser resolves it against the current origin.
    return new NextResponse(null, { status: 307, headers: { Location: '/link-invalid' } })
  }

  const env = loadEnv()
  const sessionToken = await createAttendeeSessionToken(invitee.userId, env.SESSION_SECRET)

  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: `/events/${invitee.eventId}` },
  })
  response.cookies.set(ATTENDEE_SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 90, // 90 days — matches the token's own expiry
  })
  return response
}
