import { describe, it, expect, beforeAll } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db } from '../../src/db/client'
import { events } from '../../src/db/schema'
import {
  createEvent,
  addFoodOption,
  toggleFoodOptionDisabled,
  deleteFoodOption,
  addActivityOption,
  deleteActivityOption,
  addBringItem,
  deleteBringItem,
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
