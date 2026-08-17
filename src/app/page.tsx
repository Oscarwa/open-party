import Link from 'next/link'
import { cookies } from 'next/headers'
import { loadEnv } from '@/lib/env'
import { ATTENDEE_SESSION_COOKIE_NAME, verifyAttendeeSessionToken } from '@/lib/attendeeSession'
import { listMyEvents } from '@/lib/queries/rsvp'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ATTENDEE_SESSION_COOKIE_NAME)?.value
  const env = loadEnv()
  const userId = token ? await verifyAttendeeSessionToken(token, env.SESSION_SECRET) : null

  if (!userId) {
    return (
      <main>
        <h1>Open Party</h1>
        <p>My Events will appear here once you open an invitation link.</p>
      </main>
    )
  }

  const myEvents = await listMyEvents(userId)

  return (
    <main>
      <h1>My Events</h1>
      {myEvents.length === 0 ? (
        <p>You don&apos;t have any events yet.</p>
      ) : (
        <ul>
          {myEvents.map((event) => (
            <li key={event.eventId}>
              <Link href={`/events/${event.eventId}`}>{event.title}</Link>
              {' — '}
              {event.date} {event.startTime} · {event.status} · you: {event.rsvpStatus}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
