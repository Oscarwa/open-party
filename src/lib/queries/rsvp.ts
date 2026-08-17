import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { eventInvitees, events } from '@/db/schema'

export async function listMyEvents(userId: string) {
  return db
    .select({
      eventId: events.id,
      title: events.title,
      date: events.date,
      startTime: events.startTime,
      status: events.status,
      rsvpStatus: eventInvitees.rsvpStatus,
    })
    .from(eventInvitees)
    .innerJoin(events, eq(eventInvitees.eventId, events.id))
    .where(eq(eventInvitees.userId, userId))
    .orderBy(events.date)
}
