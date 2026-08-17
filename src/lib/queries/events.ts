import { desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { events } from '@/db/schema'

export async function listEvents() {
  return db.select().from(events).orderBy(desc(events.createdAt))
}

export async function getEvent(eventId: string) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId))
  return event ?? null
}
