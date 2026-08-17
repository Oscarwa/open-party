'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createEvent } from '@/lib/events'

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
