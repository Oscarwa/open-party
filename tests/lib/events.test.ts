import { describe, it, expect, beforeAll } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db } from '../../src/db/client'
import { events, eventInvitees } from '../../src/db/schema'
import {
  createEvent,
  addFoodOption,
  toggleFoodOptionDisabled,
  deleteFoodOption,
  addActivityOption,
  deleteActivityOption,
  addBringItem,
  deleteBringItem,
  addInvitee,
  removeInvitee,
  publishEvent,
  finalizeEvent,
  EventActionError,
} from '../../src/lib/events'

// File-level, not nested in a describe block: later tasks in this plan add
// more `describe` blocks to this same file (food options, invitees,
// publishEvent, finalizeEvent), each using its own fixed WhatsApp numbers
// and event titles. A per-describe beforeAll would only clean up before
// that one block's tests, leaving every other block's fixtures to collide
// with themselves (unique whatsapp_number) on a second `vitest run`
// against the same long-lived postgres-test container. This runs once
// before every test in the whole file, regardless of which describe block
// it's in.
beforeAll(async () => {
  // db.execute() takes a `sql` tagged-template object, not a plain string
  // — this is Drizzle's own db instance (src/db/client.ts), unlike
  // Foundation's raw postgres.js `queryClient` in tests/db/client.test.ts,
  // which accepts a bare template string.
  await db.execute(sql`truncate table users, events restart identity cascade`)
})

describe('createEvent', () => {
  it('creates a draft event with the given fields', async () => {
    const event = await createEvent({
      title: 'Saturday Dinner & Games',
      date: '2026-09-05',
      startTime: '18:00',
      description: 'Bring your appetite',
    })

    expect(event.title).toBe('Saturday Dinner & Games')
    expect(event.status).toBe('draft')
    expect(event.description).toBe('Bring your appetite')

    const [stored] = await db.select().from(events).where(eq(events.id, event.id))
    expect(stored.date).toBe('2026-09-05')
  })

  it('allows an event with no description', async () => {
    const event = await createEvent({
      title: 'No Description Event',
      date: '2026-09-06',
      startTime: '19:00',
    })
    expect(event.description).toBeNull()
  })
})

describe('food options', () => {
  it('adds a food option to a draft event', async () => {
    const event = await createEvent({
      title: 'Food Options Event',
      date: '2026-09-07',
      startTime: '18:00',
    })
    const option = await addFoodOption(event.id, 'Tacos')
    expect(option.name).toBe('Tacos')
    expect(option.disabled).toBe(false)
  })

  it('toggles disabled on and off', async () => {
    const event = await createEvent({
      title: 'Toggle Event',
      date: '2026-09-08',
      startTime: '18:00',
    })
    const option = await addFoodOption(event.id, 'Pizza')
    const disabled = await toggleFoodOptionDisabled(option.id)
    expect(disabled.disabled).toBe(true)
    const enabled = await toggleFoodOptionDisabled(option.id)
    expect(enabled.disabled).toBe(false)
  })

  it('deletes a food option on a draft event', async () => {
    const event = await createEvent({
      title: 'Delete Event',
      date: '2026-09-09',
      startTime: '18:00',
    })
    const option = await addFoodOption(event.id, 'Burgers')
    await deleteFoodOption(option.id)
    await expect(toggleFoodOptionDisabled(option.id)).rejects.toThrow(
      EventActionError,
    )
  })

  it('rejects adding a food option to a non-draft event', async () => {
    const event = await createEvent({
      title: 'Published Guard Event',
      date: '2026-09-10',
      startTime: '18:00',
    })
    await db.update(events).set({ status: 'published' }).where(eq(events.id, event.id))
    await expect(addFoodOption(event.id, 'Too Late')).rejects.toThrow(
      EventActionError,
    )
  })
})

describe('activity options', () => {
  it('adds and deletes an activity option on a draft event', async () => {
    const event = await createEvent({
      title: 'Activity Event',
      date: '2026-09-11',
      startTime: '18:00',
    })
    const option = await addActivityOption(event.id, 'Board Games')
    expect(option.name).toBe('Board Games')
    await deleteActivityOption(option.id)
  })
})

describe('bring items', () => {
  it('adds and deletes a bring item on a draft event', async () => {
    const event = await createEvent({
      title: 'Bring Item Event',
      date: '2026-09-12',
      startTime: '18:00',
    })
    const item = await addBringItem(event.id, 'Drinks')
    expect(item.name).toBe('Drinks')
    await deleteBringItem(item.id)
  })
})

describe('invitees', () => {
  it('creates a new user on first invite and adds an invitee', async () => {
    const event = await createEvent({
      title: 'Invitee Event',
      date: '2026-09-13',
      startTime: '18:00',
    })
    const invitee = await addInvitee(event.id, 'Bonga', '+15559990001')
    expect(invitee.rsvpStatus).toBe('pending')
    expect(invitee.inviteToken).toBeTruthy()
    expect(invitee.tokenExpiresAt.getTime()).toBeLessThan(Date.now())
  })

  it('reuses the existing user on a second invite by the same WhatsApp number', async () => {
    const eventA = await createEvent({
      title: 'Reuse Event A',
      date: '2026-09-14',
      startTime: '18:00',
    })
    const eventB = await createEvent({
      title: 'Reuse Event B',
      date: '2026-09-15',
      startTime: '18:00',
    })
    const first = await addInvitee(eventA.id, 'John', '+15559990002')
    const second = await addInvitee(eventB.id, 'John (renamed)', '+15559990002')
    expect(second.userId).toBe(first.userId)
  })

  it('rejects inviting the same person to the same event twice', async () => {
    const event = await createEvent({
      title: 'Duplicate Invitee Event',
      date: '2026-09-16',
      startTime: '18:00',
    })
    await addInvitee(event.id, 'Ana', '+15559990003')
    await expect(addInvitee(event.id, 'Ana', '+15559990003')).rejects.toThrow(
      EventActionError,
    )
  })

  it('removes an invitee from a draft event', async () => {
    const event = await createEvent({
      title: 'Remove Invitee Event',
      date: '2026-09-17',
      startTime: '18:00',
    })
    const invitee = await addInvitee(event.id, 'Carlos', '+15559990004')
    await removeInvitee(invitee.id)
    const remaining = await addInvitee(event.id, 'Carlos', '+15559990004')
    expect(remaining.id).not.toBe(invitee.id)
  })
})

describe('publishEvent', () => {
  it('rejects publishing with no food option', async () => {
    const event = await createEvent({
      title: 'No Food Event',
      date: '2026-09-18',
      startTime: '18:00',
    })
    await addActivityOption(event.id, 'Board Games')
    await addInvitee(event.id, 'Oscar', '+15559990005')
    await expect(publishEvent(event.id)).rejects.toThrow(/food option/)
  })

  it('rejects publishing with no activity option', async () => {
    const event = await createEvent({
      title: 'No Activity Event',
      date: '2026-09-19',
      startTime: '18:00',
    })
    await addFoodOption(event.id, 'Tacos')
    await addInvitee(event.id, 'Oscar', '+15559990006')
    await expect(publishEvent(event.id)).rejects.toThrow(/activity option/)
  })

  it('rejects publishing with no invitees', async () => {
    const event = await createEvent({
      title: 'No Invitees Event',
      date: '2026-09-20',
      startTime: '18:00',
    })
    await addFoodOption(event.id, 'Tacos')
    await addActivityOption(event.id, 'Board Games')
    await expect(publishEvent(event.id)).rejects.toThrow(/invite at least one/i)
  })

  it('publishes a fully-configured event and generates usable tokens', async () => {
    const event = await createEvent({
      title: 'Publishable Event',
      date: '2026-09-21',
      startTime: '18:00',
    })
    await addFoodOption(event.id, 'Tacos')
    await addActivityOption(event.id, 'Board Games')
    const invitee = await addInvitee(event.id, 'Oscar', '+15559990007')

    const published = await publishEvent(event.id)
    expect(published.status).toBe('published')

    const [refreshed] = await db
      .select()
      .from(eventInvitees)
      .where(eq(eventInvitees.id, invitee.id))
    expect(refreshed.inviteToken).not.toBe(invitee.inviteToken)
    expect(refreshed.tokenExpiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('rejects publishing an already-published event', async () => {
    const event = await createEvent({
      title: 'Double Publish Event',
      date: '2026-09-22',
      startTime: '18:00',
    })
    await addFoodOption(event.id, 'Tacos')
    await addActivityOption(event.id, 'Board Games')
    await addInvitee(event.id, 'Oscar', '+15559990008')
    await publishEvent(event.id)
    await expect(publishEvent(event.id)).rejects.toThrow(EventActionError)
  })
})

describe('finalizeEvent', () => {
  it('rejects finalizing a draft event', async () => {
    const event = await createEvent({
      title: 'Finalize Draft Guard Event',
      date: '2026-09-23',
      startTime: '18:00',
    })
    const food = await addFoodOption(event.id, 'Tacos')
    const activity = await addActivityOption(event.id, 'Board Games')
    await expect(
      finalizeEvent(event.id, food.id, activity.id),
    ).rejects.toThrow(EventActionError)
  })

  it('sets the final options and status together', async () => {
    const event = await createEvent({
      title: 'Finalize Event',
      date: '2026-09-24',
      startTime: '18:00',
    })
    const food = await addFoodOption(event.id, 'Tacos')
    const activity = await addActivityOption(event.id, 'Board Games')
    await addInvitee(event.id, 'Oscar', '+15559990009')
    await publishEvent(event.id)

    const finalized = await finalizeEvent(event.id, food.id, activity.id)
    expect(finalized.status).toBe('finalized')
    expect(finalized.finalFoodOptionId).toBe(food.id)
    expect(finalized.finalActivityOptionId).toBe(activity.id)
  })
})
