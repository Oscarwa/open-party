'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdminSession } from '@/lib/actions/auth'
import { createEvent } from '@/lib/events'
import {
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
} from '@/lib/events'

// Every action in this file starts with `await requireAdminSession()`. These
// are their own POST endpoints, independent of the middleware-gated pages
// that render the forms, so each one authenticates for itself rather than
// inheriting trust from the page tree. Any new mutating action added here
// must do the same.
const createEventSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM'),
  description: z.string().trim().optional(),
})

export async function createEventAction(formData: FormData) {
  await requireAdminSession()
  const parsed = createEventSchema.parse({
    title: formData.get('title'),
    date: formData.get('date'),
    startTime: formData.get('startTime'),
    description: formData.get('description') || undefined,
  })

  const event = await createEvent(parsed)

  revalidatePath('/admin')
  redirect(`/admin/events/${event.id}`)
}

const optionNameSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(1, 'Name is required'),
})

const idSchema = z.object({ id: z.string().uuid() })

export async function addFoodOptionAction(formData: FormData) {
  await requireAdminSession()
  const parsed = optionNameSchema.parse({
    eventId: formData.get('eventId'),
    name: formData.get('name'),
  })
  await addFoodOption(parsed.eventId, parsed.name)
  revalidatePath(`/admin/events/${parsed.eventId}`)
}

export async function toggleFoodOptionDisabledAction(formData: FormData) {
  await requireAdminSession()
  const { id } = idSchema.parse({ id: formData.get('id') })
  const option = await toggleFoodOptionDisabled(id)
  revalidatePath(`/admin/events/${option.eventId}`)
}

export async function deleteFoodOptionAction(formData: FormData) {
  await requireAdminSession()
  const eventId = formData.get('eventId')
  const { id } = idSchema.parse({ id: formData.get('id') })
  await deleteFoodOption(id)
  revalidatePath(`/admin/events/${eventId}`)
}

export async function addActivityOptionAction(formData: FormData) {
  await requireAdminSession()
  const parsed = optionNameSchema.parse({
    eventId: formData.get('eventId'),
    name: formData.get('name'),
  })
  await addActivityOption(parsed.eventId, parsed.name)
  revalidatePath(`/admin/events/${parsed.eventId}`)
}

export async function deleteActivityOptionAction(formData: FormData) {
  await requireAdminSession()
  const eventId = formData.get('eventId')
  const { id } = idSchema.parse({ id: formData.get('id') })
  await deleteActivityOption(id)
  revalidatePath(`/admin/events/${eventId}`)
}

export async function addBringItemAction(formData: FormData) {
  await requireAdminSession()
  const parsed = optionNameSchema.parse({
    eventId: formData.get('eventId'),
    name: formData.get('name'),
  })
  await addBringItem(parsed.eventId, parsed.name)
  revalidatePath(`/admin/events/${parsed.eventId}`)
}

export async function deleteBringItemAction(formData: FormData) {
  await requireAdminSession()
  const eventId = formData.get('eventId')
  const { id } = idSchema.parse({ id: formData.get('id') })
  await deleteBringItem(id)
  revalidatePath(`/admin/events/${eventId}`)
}

const addInviteeSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(1, 'Name is required'),
  whatsappNumber: z.string().trim().min(1, 'WhatsApp number is required'),
})

export async function addInviteeAction(formData: FormData) {
  await requireAdminSession()
  const parsed = addInviteeSchema.parse({
    eventId: formData.get('eventId'),
    name: formData.get('name'),
    whatsappNumber: formData.get('whatsappNumber'),
  })
  await addInvitee(parsed.eventId, parsed.name, parsed.whatsappNumber)
  revalidatePath(`/admin/events/${parsed.eventId}`)
}

export async function removeInviteeAction(formData: FormData) {
  await requireAdminSession()
  const eventId = formData.get('eventId')
  const { id } = idSchema.parse({ id: formData.get('id') })
  await removeInvitee(id)
  revalidatePath(`/admin/events/${eventId}`)
}

export async function publishEventAction(formData: FormData) {
  await requireAdminSession()
  const eventId = formData.get('eventId')
  if (typeof eventId !== 'string') throw new Error('Missing eventId')
  await publishEvent(eventId)
  revalidatePath(`/admin/events/${eventId}`)
}

const finalizeSchema = z.object({
  eventId: z.string().uuid(),
  finalFoodOptionId: z.string().uuid(),
  finalActivityOptionId: z.string().uuid(),
})

export async function finalizeEventAction(formData: FormData) {
  await requireAdminSession()
  const parsed = finalizeSchema.parse({
    eventId: formData.get('eventId'),
    finalFoodOptionId: formData.get('finalFoodOptionId'),
    finalActivityOptionId: formData.get('finalActivityOptionId'),
  })
  await finalizeEvent(
    parsed.eventId,
    parsed.finalFoodOptionId,
    parsed.finalActivityOptionId,
  )
  revalidatePath(`/admin/events/${parsed.eventId}`)
}
