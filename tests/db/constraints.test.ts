import { describe, it, expect, beforeAll } from 'vitest'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../../src/db/schema'

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://open_party:open_party@localhost:55432/open_party_test'

const queryClient = postgres(TEST_DATABASE_URL)
const testDb = drizzle(queryClient, { schema })

describe('event_invitees unique constraint', () => {
  beforeAll(async () => {
    await queryClient`truncate table users, events restart identity cascade`
  })

  it('rejects a second invite for the same user on the same event', async () => {
    const [user] = await testDb
      .insert(schema.users)
      .values({ name: 'Oscar', whatsappNumber: '+15551234567' })
      .returning()

    const [event] = await testDb
      .insert(schema.events)
      .values({ title: 'Test Event', date: '2026-09-01', startTime: '18:00' })
      .returning()

    await testDb.insert(schema.eventInvitees).values({
      eventId: event.id,
      userId: user.id,
      inviteToken: 'token-1',
      tokenExpiresAt: new Date('2026-09-10'),
    })

    await expect(
      testDb.insert(schema.eventInvitees).values({
        eventId: event.id,
        userId: user.id,
        inviteToken: 'token-2',
        tokenExpiresAt: new Date('2026-09-10'),
      }),
    ).rejects.toThrow()
  })
})
