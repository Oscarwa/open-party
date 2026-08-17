'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { loadEnv } from '@/lib/env'
import { ATTENDEE_SESSION_COOKIE_NAME, verifyAttendeeSessionToken } from '@/lib/attendeeSession'
import { getInviteeForUserAndEvent, submitDecline, submitRsvp } from '@/lib/rsvp'

async function requireAttendeeSession(): Promise<string> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ATTENDEE_SESSION_COOKIE_NAME)?.value
  const env = loadEnv()
  const userId = token ? await verifyAttendeeSessionToken(token, env.SESSION_SECRET) : null
  if (!userId) throw new Error('Not authenticated. Please open your invitation link again.')
  return userId
}

const declineSchema = z.object({
  eventId: z.string().uuid(),
  declineReason: z.string().trim().optional(),
})

export async function declineAction(formData: FormData) {
  const userId = await requireAttendeeSession()
  const parsed = declineSchema.parse({
    eventId: formData.get('eventId'),
    declineReason: formData.get('declineReason') || undefined,
  })
  const invitee = await getInviteeForUserAndEvent(userId, parsed.eventId)
  if (!invitee) throw new Error('You are not invited to this event.')
  await submitDecline(invitee.id, parsed.eventId, parsed.declineReason)
  revalidatePath(`/events/${parsed.eventId}`)
}

function optionalUuid(value: FormDataEntryValue | null) {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

const rsvpSchema = z.object({
  eventId: z.string().uuid(),
  foodChoice1: z.string().uuid().optional(),
  foodChoice2: z.string().uuid().optional(),
  foodChoice3: z.string().uuid().optional(),
  activityChoice1: z.string().uuid().optional(),
  activityChoice2: z.string().uuid().optional(),
  activityChoice3: z.string().uuid().optional(),
  bringItemId: z.string().uuid().optional(),
})

export async function submitRsvpAction(formData: FormData) {
  const userId = await requireAttendeeSession()
  const parsed = rsvpSchema.parse({
    eventId: formData.get('eventId'),
    foodChoice1: optionalUuid(formData.get('foodChoice1')),
    foodChoice2: optionalUuid(formData.get('foodChoice2')),
    foodChoice3: optionalUuid(formData.get('foodChoice3')),
    activityChoice1: optionalUuid(formData.get('activityChoice1')),
    activityChoice2: optionalUuid(formData.get('activityChoice2')),
    activityChoice3: optionalUuid(formData.get('activityChoice3')),
    bringItemId: optionalUuid(formData.get('bringItemId')),
  })
  const invitee = await getInviteeForUserAndEvent(userId, parsed.eventId)
  if (!invitee) throw new Error('You are not invited to this event.')
  await submitRsvp(invitee.id, parsed.eventId, {
    foodChoice1: parsed.foodChoice1 ?? null,
    foodChoice2: parsed.foodChoice2 ?? null,
    foodChoice3: parsed.foodChoice3 ?? null,
    activityChoice1: parsed.activityChoice1 ?? null,
    activityChoice2: parsed.activityChoice2 ?? null,
    activityChoice3: parsed.activityChoice3 ?? null,
    bringItemId: parsed.bringItemId ?? null,
  })
  revalidatePath(`/events/${parsed.eventId}`)
}
