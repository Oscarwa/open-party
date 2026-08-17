import Link from 'next/link'
import { listEvents } from '@/lib/queries/events'

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
