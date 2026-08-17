import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { events } from '@/db/schema'

export class EventActionError extends Error {}

export async function getEventOrThrow(eventId: string) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId))
  if (!event) throw new EventActionError('Event not found')
  return event
}

export function assertDraft(event: { status: string }) {
  if (event.status !== 'draft') {
    throw new EventActionError('This event is no longer a draft')
  }
}

export async function createEvent(input: {
  title: string
  date: string
  startTime: string
  description?: string
}) {
  const [event] = await db
    .insert(events)
    .values({
      title: input.title,
      date: input.date,
      startTime: input.startTime,
      description: input.description,
    })
    .returning()
  return event
}
