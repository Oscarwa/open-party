import { describe, it, expect, beforeAll } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db } from '../../src/db/client'
import { events, users, eventInvitees } from '../../src/db/schema'
import { getInviteeByToken } from '../../src/lib/rsvp'

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
