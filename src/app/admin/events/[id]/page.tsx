import { notFound } from 'next/navigation'
import { getEvent } from '@/lib/queries/events'

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const event = await getEvent(id)

  if (!event) {
    notFound()
  }

  return (
    <main>
      <h2>{event.title}</h2>
      <p>
        {event.date} {event.startTime} · {event.status}
      </p>
      {event.description ? <p>{event.description}</p> : null}
      {/* Later tasks in this plan add food/activity/bring-item config,
          invitee management, publish, dashboard, voting results, and
          finalize sections here, each gated on event.status. */}
    </main>
  )
}
