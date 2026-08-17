import {
  pgTable,
  pgEnum,
  uuid,
  text,
  date,
  time,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'

export const eventStatusEnum = pgEnum('event_status', [
  'draft',
  'published',
  'finalized',
  'completed',
])

export const rsvpStatusEnum = pgEnum('rsvp_status', [
  'pending',
  'attending',
  'declined',
])

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  whatsappNumber: text('whatsapp_number').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  date: date('date').notNull(),
  startTime: time('start_time').notNull(),
  description: text('description'),
  status: eventStatusEnum('status').default('draft').notNull(),
  finalFoodOptionId: uuid('final_food_option_id'),
  finalActivityOptionId: uuid('final_activity_option_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const foodOptions = pgTable(
  'food_options',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    disabled: boolean('disabled').default(false).notNull(),
  },
  (table) => [index('food_options_event_id_idx').on(table.eventId)],
)

export const activityOptions = pgTable(
  'activity_options',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
  },
  (table) => [index('activity_options_event_id_idx').on(table.eventId)],
)

export const bringItems = pgTable(
  'bring_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id),
  },
  (table) => [index('bring_items_event_id_idx').on(table.eventId)],
)

export const eventInvitees = pgTable(
  'event_invitees',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    inviteToken: text('invite_token').notNull().unique(),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }).notNull(),
    rsvpStatus: rsvpStatusEnum('rsvp_status').default('pending').notNull(),
    declineReason: text('decline_reason'),
    foodChoice1: uuid('food_choice_1').references(() => foodOptions.id),
    foodChoice2: uuid('food_choice_2').references(() => foodOptions.id),
    foodChoice3: uuid('food_choice_3').references(() => foodOptions.id),
    activityChoice1: uuid('activity_choice_1').references(() => activityOptions.id),
    activityChoice2: uuid('activity_choice_2').references(() => activityOptions.id),
    activityChoice3: uuid('activity_choice_3').references(() => activityOptions.id),
    bringItemId: uuid('bring_item_id').references(() => bringItems.id),
    rsvpAt: timestamp('rsvp_at', { withTimezone: true }),
  },
  (table) => [
    index('event_invitees_event_id_idx').on(table.eventId),
    uniqueIndex('event_invitees_event_id_user_id_unique').on(
      table.eventId,
      table.userId,
    ),
  ],
)
