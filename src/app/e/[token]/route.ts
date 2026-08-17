import { NextResponse, type NextRequest } from 'next/server'
import { loadEnv } from '@/lib/env'
import { createAttendeeSessionToken, ATTENDEE_SESSION_COOKIE_NAME } from '@/lib/attendeeSession'
import { getInviteeByToken } from '@/lib/rsvp'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const invitee = await getInviteeByToken(token)

  if (!invitee) {
    return NextResponse.redirect(new URL('/link-invalid', request.url))
  }

  const env = loadEnv()
  const sessionToken = await createAttendeeSessionToken(invitee.userId, env.SESSION_SECRET)

  const response = NextResponse.redirect(new URL(`/events/${invitee.eventId}`, request.url))
  response.cookies.set(ATTENDEE_SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 90, // 90 days — matches the token's own expiry
  })
  return response
}
