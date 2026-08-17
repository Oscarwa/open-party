import { describe, it, expect, beforeAll } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db } from '../../src/db/client'
import { events, users, eventInvitees, foodOptions, activityOptions, bringItems } from '../../src/db/schema'
import {
  getInviteeByToken,
  getInviteeForUserAndEvent,
  submitDecline,
  submitRsvp,
  RsvpActionError,
} from '../../src/lib/rsvp'

beforeAll(async () => {
  await db.execute(sql`truncate table users, events restart identity cascade`)
})

async function createTestInvitee(overrides: { tokenExpiresAt: Date }) {
  const [user] = await db
    .insert(users)
    .values({ name: 'Attendee', whatsappNumber: `+1555${Math.floor(Math.random() * 10_000_000)}` })
    .returning()
  const [event] = await db
    .insert(events)
    .values({ title: 'Test Event', date: '2026-10-01', startTime: '18:00', status: 'published' })
    .returning()
  const [invitee] = await db
    .insert(eventInvitees)
    .values({
      eventId: event.id,
      userId: user.id,
      inviteToken: `token-${Math.random()}`,
      tokenExpiresAt: overrides.tokenExpiresAt,
    })
    .returning()
  return { user, event, invitee }
}

describe('getInviteeByToken', () => {
  it('returns the invitee for a valid, unexpired token', async () => {
    const future = new Date(Date.now() + 60_000)
    const { invitee } = await createTestInvitee({ tokenExpiresAt: future })
    const found = await getInviteeByToken(invitee.inviteToken)
    expect(found?.id).toBe(invitee.id)
  })

  it('returns null for an expired token', async () => {
    const past = new Date(Date.now() - 60_000)
    const { invitee } = await createTestInvitee({ tokenExpiresAt: past })
    const found = await getInviteeByToken(invitee.inviteToken)
    expect(found).toBeNull()
  })

  it('returns null for a nonexistent token', async () => {
    const found = await getInviteeByToken('this-token-does-not-exist')
    expect(found).toBeNull()
  })
})

async function createPublishedEventWithInvitee() {
  const [user] = await db
    .insert(users)
    .values({ name: 'Attendee', whatsappNumber: `+1555${Math.floor(Math.random() * 10_000_000)}` })
    .returning()
  const [event] = await db
    .insert(events)
    .values({ title: 'RSVP Test Event', date: '2026-10-02', startTime: '18:00', status: 'published' })
    .returning()
  const [invitee] = await db
    .insert(eventInvitees)
    .values({
      eventId: event.id,
      userId: user.id,
      inviteToken: `token-${Math.random()}`,
      tokenExpiresAt: new Date(Date.now() + 60_000),
    })
    .returning()
  return { user, event, invitee }
}

describe('getInviteeForUserAndEvent', () => {
  it('returns the invitee row for that user and event', async () => {
    const { user, event, invitee } = await createPublishedEventWithInvitee()
    const found = await getInviteeForUserAndEvent(user.id, event.id)
    expect(found?.id).toBe(invitee.id)
  })

  it('returns null when the user is not invited to that event', async () => {
    const { event } = await createPublishedEventWithInvitee()
    const found = await getInviteeForUserAndEvent('00000000-0000-0000-0000-000000000000', event.id)
    expect(found).toBeNull()
  })
})

describe('submitDecline', () => {
  it('records a decline with an optional reason', async () => {
    const { event, invitee } = await createPublishedEventWithInvitee()
    const updated = await submitDecline(invitee.id, event.id, 'Out of town')
    expect(updated.rsvpStatus).toBe('declined')
    expect(updated.declineReason).toBe('Out of town')
    expect(updated.rsvpAt).not.toBeNull()
  })

  it('rejects declining on a non-published event', async () => {
    const { event, invitee } = await createPublishedEventWithInvitee()
    await db.update(events).set({ status: 'finalized' }).where(eq(events.id, event.id))
    await expect(submitDecline(invitee.id, event.id)).rejects.toThrow(RsvpActionError)
  })
})

describe('submitRsvp', () => {
  it('records attendance with food and activity rankings', async () => {
    const { event, invitee } = await createPublishedEventWithInvitee()
    const [food] = await db.insert(foodOptions).values({ eventId: event.id, name: 'Tacos' }).returning()
    const [activity] = await db.insert(activityOptions).values({ eventId: event.id, name: 'Board Games' }).returning()

    const updated = await submitRsvp(invitee.id, event.id, {
      foodChoice1: food.id,
      activityChoice1: activity.id,
    })
    expect(updated.rsvpStatus).toBe('attending')
    expect(updated.foodChoice1).toBe(food.id)
    expect(updated.activityChoice1).toBe(activity.id)
  })

  it('rejects duplicate food choices', async () => {
    const { event, invitee } = await createPublishedEventWithInvitee()
    const [food] = await db.insert(foodOptions).values({ eventId: event.id, name: 'Tacos' }).returning()

    await expect(
      submitRsvp(invitee.id, event.id, { foodChoice1: food.id, foodChoice2: food.id }),
    ).rejects.toThrow(/distinct/)
  })

  it('claims a bring item', async () => {
    const { event, invitee } = await createPublishedEventWithInvitee()
    const [item] = await db.insert(bringItems).values({ eventId: event.id, name: 'Drinks' }).returning()

    const updated = await submitRsvp(invitee.id, event.id, { bringItemId: item.id })
    expect(updated.bringItemId).toBe(item.id)
  })

  it('rejects claiming a bring item someone else already holds', async () => {
    const { event, invitee: firstInvitee } = await createPublishedEventWithInvitee()
    const [item] = await db.insert(bringItems).values({ eventId: event.id, name: 'Drinks' }).returning()
    await submitRsvp(firstInvitee.id, event.id, { bringItemId: item.id })

    const [secondUser] = await db
      .insert(users)
      .values({ name: 'Second Attendee', whatsappNumber: `+1555${Math.floor(Math.random() * 10_000_000)}` })
      .returning()
    const [secondInvitee] = await db
      .insert(eventInvitees)
      .values({
        eventId: event.id,
        userId: secondUser.id,
        inviteToken: `token-${Math.random()}`,
        tokenExpiresAt: new Date(Date.now() + 60_000),
      })
      .returning()

    await expect(
      submitRsvp(secondInvitee.id, event.id, { bringItemId: item.id }),
    ).rejects.toThrow(RsvpActionError)
  })

  it('allows re-claiming the same item you already hold (no-op, not a conflict)', async () => {
    const { event, invitee } = await createPublishedEventWithInvitee()
    const [item] = await db.insert(bringItems).values({ eventId: event.id, name: 'Drinks' }).returning()
    await submitRsvp(invitee.id, event.id, { bringItemId: item.id })

    const updated = await submitRsvp(invitee.id, event.id, { bringItemId: item.id })
    expect(updated.bringItemId).toBe(item.id)
  })

  it('rejects submitting RSVP on a non-published event', async () => {
    const { event, invitee } = await createPublishedEventWithInvitee()
    await db.update(events).set({ status: 'finalized' }).where(eq(events.id, event.id))
    await expect(submitRsvp(invitee.id, event.id, {})).rejects.toThrow(RsvpActionError)
  })

  it('rejects a food choice id that belongs to a different event', async () => {
    const { event, invitee } = await createPublishedEventWithInvitee()
    const { event: otherEvent } = await createPublishedEventWithInvitee()
    const [otherFood] = await db
      .insert(foodOptions)
      .values({ eventId: otherEvent.id, name: 'Other Event Tacos' })
      .returning()

    await expect(
      submitRsvp(invitee.id, event.id, { foodChoice1: otherFood.id }),
    ).rejects.toThrow(RsvpActionError)
  })

  it('rejects a disabled food choice', async () => {
    const { event, invitee } = await createPublishedEventWithInvitee()
    const [disabledFood] = await db
      .insert(foodOptions)
      .values({ eventId: event.id, name: 'Disabled Dish', disabled: true })
      .returning()

    await expect(
      submitRsvp(invitee.id, event.id, { foodChoice1: disabledFood.id }),
    ).rejects.toThrow(RsvpActionError)
  })
})
