import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/db/client'
import { eventInvitees, events } from '@/db/schema'

export class RsvpActionError extends Error {}

export async function getInviteeByToken(token: string) {
  const [invitee] = await db
    .select()
    .from(eventInvitees)
    .where(eq(eventInvitees.inviteToken, token))
  if (!invitee) return null
  if (invitee.tokenExpiresAt.getTime() <= Date.now()) return null
  return invitee
}

export async function getInviteeForUserAndEvent(userId: string, eventId: string) {
  const [invitee] = await db
    .select()
    .from(eventInvitees)
    .where(and(eq(eventInvitees.userId, userId), eq(eventInvitees.eventId, eventId)))
  return invitee ?? null
}

async function assertPublished(eventId: string) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId))
  if (!event) throw new RsvpActionError('Event not found')
  if (event.status !== 'published') {
    throw new RsvpActionError('This event is no longer accepting RSVP changes')
  }
  return event
}

export async function submitDecline(inviteeId: string, eventId: string, declineReason?: string) {
  await assertPublished(eventId)
  const [updated] = await db
    .update(eventInvitees)
    .set({
      rsvpStatus: 'declined',
      declineReason: declineReason || null,
      rsvpAt: new Date(),
      // Clear any previously-saved attending-only fields, so switching
      // from "attending" to "declined" doesn't leave stale choices behind.
      foodChoice1: null,
      foodChoice2: null,
      foodChoice3: null,
      activityChoice1: null,
      activityChoice2: null,
      activityChoice3: null,
      bringItemId: null,
    })
    .where(eq(eventInvitees.id, inviteeId))
    .returning()
  return updated
}

export async function submitRsvp(
  inviteeId: string,
  eventId: string,
  input: {
    foodChoice1?: string | null
    foodChoice2?: string | null
    foodChoice3?: string | null
    activityChoice1?: string | null
    activityChoice2?: string | null
    activityChoice3?: string | null
    bringItemId?: string | null
  },
) {
  await assertPublished(eventId)

  const foodChoices = [input.foodChoice1, input.foodChoice2, input.foodChoice3].filter(
    (choice): choice is string => Boolean(choice),
  )
  if (new Set(foodChoices).size !== foodChoices.length) {
    throw new RsvpActionError('Food choices must be distinct')
  }
  const activityChoices = [input.activityChoice1, input.activityChoice2, input.activityChoice3].filter(
    (choice): choice is string => Boolean(choice),
  )
  if (new Set(activityChoices).size !== activityChoices.length) {
    throw new RsvpActionError('Activity choices must be distinct')
  }

  if (input.bringItemId) {
    const [claimedByOther] = await db
      .select()
      .from(eventInvitees)
      .where(and(eq(eventInvitees.bringItemId, input.bringItemId), ne(eventInvitees.id, inviteeId)))
    if (claimedByOther) {
      throw new RsvpActionError('Someone else already claimed that item — pick another')
    }
  }

  const [updated] = await db
    .update(eventInvitees)
    .set({
      rsvpStatus: 'attending',
      declineReason: null,
      foodChoice1: input.foodChoice1 || null,
      foodChoice2: input.foodChoice2 || null,
      foodChoice3: input.foodChoice3 || null,
      activityChoice1: input.activityChoice1 || null,
      activityChoice2: input.activityChoice2 || null,
      activityChoice3: input.activityChoice3 || null,
      bringItemId: input.bringItemId || null,
      rsvpAt: new Date(),
    })
    .where(eq(eventInvitees.id, inviteeId))
    .returning()
  return updated
}
