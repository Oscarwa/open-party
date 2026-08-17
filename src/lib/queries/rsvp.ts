import { and, eq, isNotNull, ne } from 'drizzle-orm'
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
    .where(and(eq(eventInvitees.userId, userId), ne(events.status, 'draft')))
    .orderBy(events.date)
}

// Bring-item ids already claimed by OTHER invitees for this event, so the
// RSVP form can flag them as taken rather than let an attendee pick one
// that submitRsvp will just reject.
export async function getClaimedBringItemIds(eventId: string, excludingInviteeId: string) {
  const rows = await db
    .select({ bringItemId: eventInvitees.bringItemId })
    .from(eventInvitees)
    .where(
      and(
        eq(eventInvitees.eventId, eventId),
        isNotNull(eventInvitees.bringItemId),
        ne(eventInvitees.id, excludingInviteeId),
      ),
    )
  return new Set(rows.map((row) => row.bringItemId as string))
}
