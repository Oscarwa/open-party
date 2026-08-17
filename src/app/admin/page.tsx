import Link from 'next/link'
import { listEvents } from '@/lib/queries/events'

// Without this, Next.js statically prerenders this page at build time
// (nothing here uses a dynamic API like cookies()/headers()/searchParams
// that would otherwise force per-request rendering) — the events list
// would freeze at whatever was in the database during `docker build` and
// never update in the deployed app until the next image rebuild.
export const dynamic = 'force-dynamic'

export default async function AdminEventsPage() {
  const events = await listEvents()

  return (
    <main>
      <h2>Events</h2>
      <p>
        <Link href="/admin/events/new">New Event</Link>
      </p>
      {events.length === 0 ? (
        <p>No events yet.</p>
      ) : (
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              <Link href={`/admin/events/${event.id}`}>{event.title}</Link>
              {' — '}
              {event.date} {event.startTime} · {event.status}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
