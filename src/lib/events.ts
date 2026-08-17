import { randomUUID } from 'node:crypto'
import { count, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { events } from '@/db/schema'
import { activityOptions, bringItems, foodOptions, eventInvitees, users } from '@/db/schema'

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

export async function addFoodOption(eventId: string, name: string) {
  const event = await getEventOrThrow(eventId)
  assertDraft(event)
  const [option] = await db.insert(foodOptions).values({ eventId, name }).returning()
  return option
}

export async function toggleFoodOptionDisabled(foodOptionId: string) {
  const [option] = await db
    .select()
    .from(foodOptions)
    .where(eq(foodOptions.id, foodOptionId))
  if (!option) throw new EventActionError('Food option not found')
  const [updated] = await db
    .update(foodOptions)
    .set({ disabled: !option.disabled })
    .where(eq(foodOptions.id, foodOptionId))
    .returning()
  return updated
}

export async function deleteFoodOption(foodOptionId: string) {
  const [option] = await db
    .select()
    .from(foodOptions)
    .where(eq(foodOptions.id, foodOptionId))
  if (!option) throw new EventActionError('Food option not found')
  const event = await getEventOrThrow(option.eventId)
  assertDraft(event)
  await db.delete(foodOptions).where(eq(foodOptions.id, foodOptionId))
}

export async function addActivityOption(eventId: string, name: string) {
  const event = await getEventOrThrow(eventId)
  assertDraft(event)
  const [option] = await db
    .insert(activityOptions)
    .values({ eventId, name })
    .returning()
  return option
}

export async function deleteActivityOption(activityOptionId: string) {
  const [option] = await db
    .select()
    .from(activityOptions)
    .where(eq(activityOptions.id, activityOptionId))
  if (!option) throw new EventActionError('Activity option not found')
  const event = await getEventOrThrow(option.eventId)
  assertDraft(event)
  await db
    .delete(activityOptions)
    .where(eq(activityOptions.id, activityOptionId))
}

export async function addBringItem(eventId: string, name: string) {
  const event = await getEventOrThrow(eventId)
  assertDraft(event)
  const [item] = await db.insert(bringItems).values({ eventId, name }).returning()
  return item
}

export async function deleteBringItem(bringItemId: string) {
  const [item] = await db
    .select()
    .from(bringItems)
    .where(eq(bringItems.id, bringItemId))
  if (!item) throw new EventActionError('Bring item not found')
  const event = await getEventOrThrow(item.eventId)
  assertDraft(event)
  await db.delete(bringItems).where(eq(bringItems.id, bringItemId))
}

export async function addInvitee(
  eventId: string,
  name: string,
  whatsappNumber: string,
) {
  const event = await getEventOrThrow(eventId)
  assertDraft(event)

  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.whatsappNumber, whatsappNumber))

  if (!user) {
    ;[user] = await db.insert(users).values({ name, whatsappNumber }).returning()
  }

  try {
    const [invitee] = await db
      .insert(eventInvitees)
      .values({
        eventId,
        userId: user.id,
        // Placeholder — deliberately already-expired, so this token can
        // never be used before publishEvent (Task 5) overwrites it with a
        // real future expiry.
        inviteToken: randomUUID(),
        tokenExpiresAt: new Date(0),
      })
      .returning()
    return invitee
  } catch (error) {
    // Only convert the unique constraint violation on (eventId, userId) to
    // the domain error. Rethrow any other database error to avoid masking
    // real issues (dropped connections, FK violations, etc.).
    const cause = (error as any)?.cause
    if (
      cause instanceof Error &&
      'code' in cause &&
      cause.code === '23505' &&
      'constraint_name' in cause &&
      cause.constraint_name === 'event_invitees_event_id_user_id_unique'
    ) {
      throw new EventActionError('This person is already invited to this event')
    }
    throw error
  }
}

export async function removeInvitee(eventInviteeId: string) {
  const [invitee] = await db
    .select()
    .from(eventInvitees)
    .where(eq(eventInvitees.id, eventInviteeId))
  if (!invitee) throw new EventActionError('Invitee not found')
  const event = await getEventOrThrow(invitee.eventId)
  assertDraft(event)
  await db.delete(eventInvitees).where(eq(eventInvitees.id, eventInviteeId))
}

export async function publishEvent(eventId: string) {
  const event = await getEventOrThrow(eventId)
  assertDraft(event)

  const [[{ foodCount }], [{ activityCount }], [{ inviteeCount }]] = await Promise.all([
    db
      .select({ foodCount: count() })
      .from(foodOptions)
      .where(eq(foodOptions.eventId, eventId)),
    db
      .select({ activityCount: count() })
      .from(activityOptions)
      .where(eq(activityOptions.eventId, eventId)),
    db
      .select({ inviteeCount: count() })
      .from(eventInvitees)
      .where(eq(eventInvitees.eventId, eventId)),
  ])

  if (foodCount === 0) {
    throw new EventActionError('Add at least one food option before publishing')
  }
  if (activityCount === 0) {
    throw new EventActionError('Add at least one activity option before publishing')
  }
  if (inviteeCount === 0) {
    throw new EventActionError('Invite at least one person before publishing')
  }

  const invitees = await db
    .select()
    .from(eventInvitees)
    .where(eq(eventInvitees.eventId, eventId))

  // Real expiry: the event's date/time plus five days' grace, so an
  // attendee can still view finalized details shortly after the event.
  const tokenExpiresAt = new Date(`${event.date}T${event.startTime}Z`)
  tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 5)

  await Promise.all(
    invitees.map((invitee) =>
      db
        .update(eventInvitees)
        .set({ inviteToken: randomUUID(), tokenExpiresAt })
        .where(eq(eventInvitees.id, invitee.id)),
    ),
  )

  const [updated] = await db
    .update(events)
    .set({ status: 'published' })
    .where(eq(events.id, eventId))
    .returning()
  return updated
}
