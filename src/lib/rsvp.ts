import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { eventInvitees } from '@/db/schema'

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
