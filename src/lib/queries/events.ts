import { asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { events } from '@/db/schema'
import { activityOptions, bringItems, foodOptions, eventInvitees, users } from '@/db/schema'

export async function listEvents() {
  return db.select().from(events).orderBy(desc(events.createdAt))
}

export async function getEvent(eventId: string) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId))
  return event ?? null
}

export async function getFoodOptions(eventId: string) {
  return db
    .select()
    .from(foodOptions)
    .where(eq(foodOptions.eventId, eventId))
    .orderBy(asc(foodOptions.name))
}

export async function getActivityOptions(eventId: string) {
  return db
    .select()
    .from(activityOptions)
    .where(eq(activityOptions.eventId, eventId))
    .orderBy(asc(activityOptions.name))
}

export async function getBringItems(eventId: string) {
  return db
    .select()
    .from(bringItems)
    .where(eq(bringItems.eventId, eventId))
    .orderBy(asc(bringItems.name))
}

export async function getInvitees(eventId: string) {
  return db
    .select({
      id: eventInvitees.id,
      rsvpStatus: eventInvitees.rsvpStatus,
      declineReason: eventInvitees.declineReason,
      inviteToken: eventInvitees.inviteToken,
      foodChoice1: eventInvitees.foodChoice1,
      foodChoice2: eventInvitees.foodChoice2,
      foodChoice3: eventInvitees.foodChoice3,
      activityChoice1: eventInvitees.activityChoice1,
      activityChoice2: eventInvitees.activityChoice2,
      activityChoice3: eventInvitees.activityChoice3,
      bringItemId: eventInvitees.bringItemId,
      userName: users.name,
      userWhatsappNumber: users.whatsappNumber,
    })
    .from(eventInvitees)
    .innerJoin(users, eq(eventInvitees.userId, users.id))
    .where(eq(eventInvitees.eventId, eventId))
    .orderBy(asc(users.name))
}

export async function getRsvpCounts(eventId: string) {
  const invitees = await db
    .select({ rsvpStatus: eventInvitees.rsvpStatus })
    .from(eventInvitees)
    .where(eq(eventInvitees.eventId, eventId))

  return {
    invited: invitees.length,
    attending: invitees.filter((i) => i.rsvpStatus === 'attending').length,
    declined: invitees.filter((i) => i.rsvpStatus === 'declined').length,
    pending: invitees.filter((i) => i.rsvpStatus === 'pending').length,
  }
}

function tally(
  options: { id: string; name: string }[],
  first: (string | null)[],
  second: (string | null)[],
  third: (string | null)[],
) {
  return options.map((option) => ({
    id: option.id,
    name: option.name,
    first: first.filter((id) => id === option.id).length,
    second: second.filter((id) => id === option.id).length,
    third: third.filter((id) => id === option.id).length,
  }))
}

export async function getVotingResults(eventId: string) {
  const [foodOpts, activityOpts, choices] = await Promise.all([
    getFoodOptions(eventId),
    getActivityOptions(eventId),
    db
      .select({
        foodChoice1: eventInvitees.foodChoice1,
        foodChoice2: eventInvitees.foodChoice2,
        foodChoice3: eventInvitees.foodChoice3,
        activityChoice1: eventInvitees.activityChoice1,
        activityChoice2: eventInvitees.activityChoice2,
        activityChoice3: eventInvitees.activityChoice3,
      })
      .from(eventInvitees)
      .where(eq(eventInvitees.eventId, eventId)),
  ])

  return {
    food: tally(
      foodOpts,
      choices.map((c) => c.foodChoice1),
      choices.map((c) => c.foodChoice2),
      choices.map((c) => c.foodChoice3),
    ),
    activity: tally(
      activityOpts,
      choices.map((c) => c.activityChoice1),
      choices.map((c) => c.activityChoice2),
      choices.map((c) => c.activityChoice3),
    ),
  }
}
