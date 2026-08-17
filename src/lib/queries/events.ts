import { asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { events } from '@/db/schema'
import { activityOptions, bringItems, foodOptions } from '@/db/schema'

export async function listEvents() {
  return db.select().from(events).orderBy(desc(events.createdAt))
}

export async function getEvent(eventId: string) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId))
  return event ?? null
}

export async function getFoodOptions(eventId: string) {
  return db
    .select()
    .from(foodOptions)
    .where(eq(foodOptions.eventId, eventId))
    .orderBy(asc(foodOptions.name))
}

export async function getActivityOptions(eventId: string) {
  return db
    .select()
    .from(activityOptions)
    .where(eq(activityOptions.eventId, eventId))
    .orderBy(asc(activityOptions.name))
}

export async function getBringItems(eventId: string) {
  return db
    .select()
    .from(bringItems)
    .where(eq(bringItems.eventId, eventId))
    .orderBy(asc(bringItems.name))
}
