import { describe, it, expect, beforeAll } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db } from '../../src/db/client'
import { events } from '../../src/db/schema'
import { createEvent } from '../../src/lib/events'

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
