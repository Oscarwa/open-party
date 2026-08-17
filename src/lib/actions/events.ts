'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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
} from '@/lib/events'

const createEventSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM'),
  description: z.string().trim().optional(),
})

export async function createEventAction(formData: FormData) {
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
  const parsed = optionNameSchema.parse({
    eventId: formData.get('eventId'),
    name: formData.get('name'),
  })
  await addFoodOption(parsed.eventId, parsed.name)
  revalidatePath(`/admin/events/${parsed.eventId}`)
}

export async function toggleFoodOptionDisabledAction(formData: FormData) {
  const { id } = idSchema.parse({ id: formData.get('id') })
  const option = await toggleFoodOptionDisabled(id)
  revalidatePath(`/admin/events/${option.eventId}`)
}

export async function deleteFoodOptionAction(formData: FormData) {
  const eventId = formData.get('eventId')
  const { id } = idSchema.parse({ id: formData.get('id') })
  await deleteFoodOption(id)
  revalidatePath(`/admin/events/${eventId}`)
}

export async function addActivityOptionAction(formData: FormData) {
  const parsed = optionNameSchema.parse({
    eventId: formData.get('eventId'),
    name: formData.get('name'),
  })
  await addActivityOption(parsed.eventId, parsed.name)
  revalidatePath(`/admin/events/${parsed.eventId}`)
}

export async function deleteActivityOptionAction(formData: FormData) {
  const eventId = formData.get('eventId')
  const { id } = idSchema.parse({ id: formData.get('id') })
  await deleteActivityOption(id)
  revalidatePath(`/admin/events/${eventId}`)
}

export async function addBringItemAction(formData: FormData) {
  const parsed = optionNameSchema.parse({
    eventId: formData.get('eventId'),
    name: formData.get('name'),
  })
  await addBringItem(parsed.eventId, parsed.name)
  revalidatePath(`/admin/events/${parsed.eventId}`)
}

export async function deleteBringItemAction(formData: FormData) {
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
  const parsed = addInviteeSchema.parse({
    eventId: formData.get('eventId'),
    name: formData.get('name'),
    whatsappNumber: formData.get('whatsappNumber'),
  })
  await addInvitee(parsed.eventId, parsed.name, parsed.whatsappNumber)
  revalidatePath(`/admin/events/${parsed.eventId}`)
}

export async function removeInviteeAction(formData: FormData) {
  const eventId = formData.get('eventId')
  const { id } = idSchema.parse({ id: formData.get('id') })
  await removeInvitee(id)
  revalidatePath(`/admin/events/${eventId}`)
}

export async function publishEventAction(formData: FormData) {
  const eventId = formData.get('eventId')
  if (typeof eventId !== 'string') throw new Error('Missing eventId')
  await publishEvent(eventId)
  revalidatePath(`/admin/events/${eventId}`)
}
