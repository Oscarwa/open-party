# Admin Event Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin-facing event lifecycle end to end: create an event, configure food/activity/bring-item options, invite people, publish (generating the magic-link tokens Phase 3 will use), review the RSVP dashboard and voting results, and finalize. No WhatsApp sending exists yet — publishing displays the generated invite links instead of sending them.

**Architecture:** Business logic lives in framework-agnostic core functions (`src/lib/events.ts`) that the test suite calls directly; thin `'use server'` wrappers (`src/lib/actions/events.ts`) parse `FormData`, call the core functions, and handle Next.js-specific concerns (`revalidatePath`, `redirect`). Read queries for pages live in `src/lib/queries/events.ts`. Pages are server components with plain HTML `<form>`s bound to server actions — no client-side state library.

**Tech Stack:** Same as Foundation — Next.js 15 (App Router) + TypeScript, Drizzle ORM + `postgres`, Zod for input validation, Vitest for tests. No new dependencies.

## Global Constraints

- Event lifecycle: `draft` → `published` → `finalized` → `completed`. The `completed` transition is explicitly out of scope for this phase (needs Phase 4's scheduler) — events stay `finalized` indefinitely for now.
- No WhatsApp sending in this phase. `publishEvent` generates real `inviteToken`/`tokenExpiresAt` values per invitee (the same ones Phase 3's magic links will use) but the app only displays them — it does not attempt to send anything.
- Every mutating action re-derives the event's current status from the database before acting — never trusts client-supplied state. Attempting a draft-only action (e.g. deleting a food option) on a non-draft event fails with a specific, surfaced error rather than silently no-op-ing.
- Bring items are always optional. Publishing requires at least one food option, one activity option, and one invitee — nothing about bring items blocks publish.
- `event_invitees (event_id, user_id)` is unique at the database level — inviting the same person to the same event twice is a constraint violation, not just an application-level check.
- Admin routes are already gated by Foundation's `src/middleware.ts` (Tailnet-only) — nothing in this phase adds or changes authentication.
- Testing stays "light, integration-focused": real test database, no mocks, tests target business rules (validation, dedupe, status transitions, draft-only guards) rather than exhaustively covering every CRUD action or any UI rendering.

---

### Task 1: Schema migration — invitee uniqueness and FK indexes, plus safer test infrastructure

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `vitest.config.ts`
- Modify: `tests/db/client.test.ts`
- Create: `tests/global-setup.ts`
- Create: `tests/db/constraints.test.ts`

**Interfaces:**
- Consumes: existing schema tables (Foundation Task 3).
- Produces: a unique index on `event_invitees (event_id, user_id)` and indexes on every child table's `event_id` FK column, applied via a new migration. A Vitest `globalSetup` that applies migrations exactly once per test run (all later tasks' test files rely on this — they do **not** call `migrate()` themselves).

Foundation's `tests/db/client.test.ts` called `migrate()` from its own `beforeAll`. Vitest runs test **files** in parallel by default; a second DB-touching test file added in this phase would call `migrate()` concurrently with that one, and two concurrent `CREATE SCHEMA IF NOT EXISTS "drizzle"` calls race on Postgres's catalog (`pg_namespace_nspname_index`) — this is the exact bug already hit once during Foundation's homelab deployment (see `docs/superpowers/plans/2026-08-16-foundation.md`'s ledger). This task fixes it at the root: migrations run once, in Vitest's `globalSetup` (which Vitest guarantees runs to completion before any test file starts, regardless of worker parallelism), and file-level parallelism is disabled so concurrent test files can no longer stomp on each other's fixtures in the shared test database either.

- [ ] **Step 1: Add the unique index and FK indexes to the schema**

In `src/db/schema.ts`, add `uniqueIndex` and `index` to the import from `drizzle-orm/pg-core`:

```ts
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
```

Change the `foodOptions` table definition to add an index on `eventId`:

```ts
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
```

Change `activityOptions` the same way:

```ts
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
```

Change `bringItems` the same way:

```ts
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
```

Change `eventInvitees` to add both an `eventId` index and the composite unique index:

```ts
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
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`
Expected: creates `src/db/migrations/0001_*.sql`. Open it and confirm it contains `CREATE UNIQUE INDEX` for `event_invitees_event_id_user_id_unique` and four `CREATE INDEX` statements for the `_event_id_idx` indexes.

- [ ] **Step 3: Add a Vitest global setup that applies migrations once**

Create `tests/global-setup.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

export default async function setup() {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    'postgres://open_party:open_party@localhost:55432/open_party_test'

  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client)
  await migrate(db, { migrationsFolder: './src/db/migrations' })
  await client.end()
}
```

- [ ] **Step 4: Wire the global setup into `vitest.config.ts` and disable file parallelism**

In `vitest.config.ts`, add `globalSetup` and `fileParallelism: false` to the `test` block:

```ts
import { defineConfig, configDefaults } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    // Migrations run exactly once here, before any test file starts —
    // see tests/global-setup.ts. Individual test files must not call
    // migrate() themselves; two files doing so concurrently races on
    // Postgres's catalog (CREATE SCHEMA IF NOT EXISTS "drizzle").
    globalSetup: ['./tests/global-setup.ts'],
    // Test files share one physical test database and truncate tables
    // in their own beforeAll — safe only if files run one at a time.
    fileParallelism: false,
    exclude: [...configDefaults.exclude, '.claude/**', '.worktrees/**', 'worktrees/**'],
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgres://open_party:open_party@localhost:55432/open_party_test',
      WAHA_URL: process.env.WAHA_URL ?? 'http://localhost:3001',
      WAHA_SESSION: process.env.WAHA_SESSION ?? 'default',
      SESSION_SECRET:
        process.env.SESSION_SECRET ?? 'test-session-secret-at-least-32-chars',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 5: Remove the now-redundant per-file migration call in `tests/db/client.test.ts`**

`tests/db/client.test.ts` currently runs `migrate()` in its own `beforeAll`. With the global setup from Step 3-4, this is redundant (harmless, but wasted work) — remove it, keeping the table cleanup:

```ts
describe('db client', () => {
  beforeAll(async () => {
    // The round-trip test below inserts a fixed whatsapp_number, which is
    // unique — without this the suite only passes against a brand-new
    // database and fails on any second run.
    await queryClient`truncate table users restart identity cascade`
  })
```

(Delete the `await migrate(testDb, { migrationsFolder: './src/db/migrations' })` line and, if now unused, the `migrate` import — check whether anything else in the file still uses it before removing the import.)

- [ ] **Step 6: Write a test proving the unique constraint is enforced**

Create `tests/db/constraints.test.ts`:

```ts
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
```

- [ ] **Step 7: Run the full suite**

Run: `docker compose --profile dev up -d postgres-test` (if not already running), then `npx vitest run`
Expected: all test files pass, including the new constraints test. Confirm migrations only run once — the global setup's own console output (if any) or just the absence of any "schema already exists" error confirms it.

- [ ] **Step 8: Commit**

```bash
git add src/db/schema.ts src/db/migrations vitest.config.ts tests/global-setup.ts tests/db/client.test.ts tests/db/constraints.test.ts
git commit -m "feat: add event_invitees uniqueness, FK indexes, and safer test migration setup"
```

---

### Task 2: Create event, list events, event detail skeleton

**Files:**
- Create: `src/lib/events.ts`
- Create: `src/lib/actions/events.ts`
- Create: `src/lib/queries/events.ts`
- Modify: `src/app/admin/page.tsx`
- Create: `src/app/admin/events/new/page.tsx`
- Create: `src/app/admin/events/[id]/page.tsx`
- Test: `tests/lib/events.test.ts`

**Interfaces:**
- Consumes: `db` from `src/db/client.ts` (Foundation Task 4), schema tables (Task 1 of this plan).
- Produces: `createEvent(input: { title: string; date: string; startTime: string; description?: string }): Promise<Event>` from `src/lib/events.ts` — later tasks add more functions to this same file. `listEvents(): Promise<Event[]>` and `getEvent(eventId: string): Promise<Event | null>` from `src/lib/queries/events.ts` — later tasks add more query functions to this same file. The `createEventAction(formData: FormData)` server action from `src/lib/actions/events.ts` — later tasks add more actions to this same file.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/events.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db } from '../../src/db/client'
import { events } from '../../src/db/schema'
import { createEvent } from '../../src/lib/events'

// File-level, not nested in a describe block: later tasks in this plan add
// more `describe` blocks to this same file (food options, invitees,
// publishEvent, finalizeEvent), each using its own fixed WhatsApp numbers
// and event titles. A per-describe beforeAll would only clean up before
// that one block's tests, leaving every other block's fixtures to collide
// with themselves (unique whatsapp_number) on a second `vitest run`
// against the same long-lived postgres-test container. This runs once
// before every test in the whole file, regardless of which describe block
// it's in.
beforeAll(async () => {
  // db.execute() takes a `sql` tagged-template object, not a plain string
  // — this is Drizzle's own db instance (src/db/client.ts), unlike
  // Foundation's raw postgres.js `queryClient` in tests/db/client.test.ts,
  // which accepts a bare template string.
  await db.execute(sql`truncate table users, events restart identity cascade`)
})

describe('createEvent', () => {
  it('creates a draft event with the given fields', async () => {
    const event = await createEvent({
      title: 'Saturday Dinner & Games',
      date: '2026-09-05',
      startTime: '18:00',
      description: 'Bring your appetite',
    })

    expect(event.title).toBe('Saturday Dinner & Games')
    expect(event.status).toBe('draft')
    expect(event.description).toBe('Bring your appetite')

    const [stored] = await db.select().from(events).where(eq(events.id, event.id))
    expect(stored.date).toBe('2026-09-05')
  })

  it('allows an event with no description', async () => {
    const event = await createEvent({
      title: 'No Description Event',
      date: '2026-09-06',
      startTime: '19:00',
    })
    expect(event.description).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/events.test.ts`
Expected: FAIL — `src/lib/events.ts` does not exist yet.

- [ ] **Step 3: Implement `src/lib/events.ts`**

```ts
import { db } from '@/db/client'
import { events } from '@/db/schema'

export class EventActionError extends Error {}

export async function getEventOrThrow(eventId: string) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId))
  if (!event) throw new EventActionError('Event not found')
  return event
}

export function assertDraft(event: { status: string }) {
  if (event.status !== 'draft') {
    throw new EventActionError('This event is no longer a draft')
  }
}

export async function createEvent(input: {
  title: string
  date: string
  startTime: string
  description?: string
}) {
  const [event] = await db
    .insert(events)
    .values({
      title: input.title,
      date: input.date,
      startTime: input.startTime,
      description: input.description,
    })
    .returning()
  return event
}
```

You'll need `eq` from `drizzle-orm` — add the import:

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { events } from '@/db/schema'
```

`getEventOrThrow` and `assertDraft` aren't used by anything yet in this task — later tasks in this plan import and use both. That's expected; don't remove them as dead code.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/events.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement `src/lib/queries/events.ts`**

```ts
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
```

- [ ] **Step 6: Implement `src/lib/actions/events.ts`**

```ts
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
```

- [ ] **Step 7: Replace the Admin Events list stub**

Replace the full contents of `src/app/admin/page.tsx`:

```tsx
import Link from 'next/link'
import { listEvents } from '@/lib/queries/events'

export default async function AdminEventsPage() {
  const events = await listEvents()

  return (
    <main>
      <h2>Events</h2>
      <p>
        <Link href="/admin/events/new">New Event</Link>
      </p>
      {events.length === 0 ? (
        <p>No events yet.</p>
      ) : (
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              <Link href={`/admin/events/${event.id}`}>{event.title}</Link>
              {' — '}
              {event.date} {event.startTime} · {event.status}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

- [ ] **Step 8: Create the "New Event" form page**

Create `src/app/admin/events/new/page.tsx`:

```tsx
import { createEventAction } from '@/lib/actions/events'

export default function NewEventPage() {
  return (
    <main>
      <h2>New Event</h2>
      <form action={createEventAction}>
        <div>
          <label htmlFor="title">Title</label>
          <input type="text" id="title" name="title" required />
        </div>
        <div>
          <label htmlFor="date">Date</label>
          <input type="date" id="date" name="date" required />
        </div>
        <div>
          <label htmlFor="startTime">Start time</label>
          <input type="time" id="startTime" name="startTime" required />
        </div>
        <div>
          <label htmlFor="description">Description (optional)</label>
          <textarea id="description" name="description" />
        </div>
        <button type="submit">Create Event</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 9: Create the event detail page skeleton**

Create `src/app/admin/events/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getEvent } from '@/lib/queries/events'

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const event = await getEvent(id)

  if (!event) {
    notFound()
  }

  return (
    <main>
      <h2>{event.title}</h2>
      <p>
        {event.date} {event.startTime} · {event.status}
      </p>
      {event.description ? <p>{event.description}</p> : null}
      {/* Later tasks in this plan add food/activity/bring-item config,
          invitee management, publish, dashboard, voting results, and
          finalize sections here, each gated on event.status. */}
    </main>
  )
}
```

- [ ] **Step 10: Verify the build and the flow manually**

Run: `npm run build`
Expected: succeeds, three routes listed (`/admin`, `/admin/events/new`, `/admin/events/[id]`).

Run: `docker compose --profile dev up -d postgres` (if not already running), `cp .env.example .env.local` if you don't already have one, `npm run dev &`, then in a browser visit `http://localhost:3000/admin`, click "New Event", submit the form, confirm you land on the new event's detail page showing its title/date/status. Stop the dev server (`kill %1`) when done.

- [ ] **Step 11: Commit**

```bash
git add src/lib/events.ts src/lib/actions/events.ts src/lib/queries/events.ts src/app/admin/page.tsx src/app/admin/events tests/lib/events.test.ts
git commit -m "feat: create event, list events, event detail skeleton"
```

---

### Task 3: Food, activity, and bring-item option management

**Files:**
- Modify: `src/lib/events.ts`
- Modify: `src/lib/actions/events.ts`
- Modify: `src/lib/queries/events.ts`
- Modify: `src/app/admin/events/[id]/page.tsx`
- Test: `tests/lib/events.test.ts`

**Interfaces:**
- Consumes: `getEventOrThrow`, `assertDraft`, `EventActionError` from `src/lib/events.ts` (Task 2 of this plan).
- Produces: `addFoodOption`, `toggleFoodOptionDisabled`, `deleteFoodOption`, `addActivityOption`, `deleteActivityOption`, `addBringItem`, `deleteBringItem` — all added to `src/lib/events.ts`. `getFoodOptions`, `getActivityOptions`, `getBringItems` added to `src/lib/queries/events.ts`. Task 4 (invitees) and Task 5 (publish) both call the `getFoodOptions`/`getActivityOptions` query functions and the draft-only guard pattern established here.

- [ ] **Step 1: Write the failing tests**

Append to `tests/lib/events.test.ts` (add the import for the new functions, then the new `describe` blocks):

```ts
import {
  createEvent,
  addFoodOption,
  toggleFoodOptionDisabled,
  deleteFoodOption,
  addActivityOption,
  deleteActivityOption,
  addBringItem,
  deleteBringItem,
  EventActionError,
} from '../../src/lib/events'
```

```ts
describe('food options', () => {
  it('adds a food option to a draft event', async () => {
    const event = await createEvent({
      title: 'Food Options Event',
      date: '2026-09-07',
      startTime: '18:00',
    })
    const option = await addFoodOption(event.id, 'Tacos')
    expect(option.name).toBe('Tacos')
    expect(option.disabled).toBe(false)
  })

  it('toggles disabled on and off', async () => {
    const event = await createEvent({
      title: 'Toggle Event',
      date: '2026-09-08',
      startTime: '18:00',
    })
    const option = await addFoodOption(event.id, 'Pizza')
    const disabled = await toggleFoodOptionDisabled(option.id)
    expect(disabled.disabled).toBe(true)
    const enabled = await toggleFoodOptionDisabled(option.id)
    expect(enabled.disabled).toBe(false)
  })

  it('deletes a food option on a draft event', async () => {
    const event = await createEvent({
      title: 'Delete Event',
      date: '2026-09-09',
      startTime: '18:00',
    })
    const option = await addFoodOption(event.id, 'Burgers')
    await deleteFoodOption(option.id)
    await expect(toggleFoodOptionDisabled(option.id)).rejects.toThrow(
      EventActionError,
    )
  })

  it('rejects adding a food option to a non-draft event', async () => {
    const event = await createEvent({
      title: 'Published Guard Event',
      date: '2026-09-10',
      startTime: '18:00',
    })
    await db.update(events).set({ status: 'published' }).where(eq(events.id, event.id))
    await expect(addFoodOption(event.id, 'Too Late')).rejects.toThrow(
      EventActionError,
    )
  })
})

describe('activity options', () => {
  it('adds and deletes an activity option on a draft event', async () => {
    const event = await createEvent({
      title: 'Activity Event',
      date: '2026-09-11',
      startTime: '18:00',
    })
    const option = await addActivityOption(event.id, 'Board Games')
    expect(option.name).toBe('Board Games')
    await deleteActivityOption(option.id)
  })
})

describe('bring items', () => {
  it('adds and deletes a bring item on a draft event', async () => {
    const event = await createEvent({
      title: 'Bring Item Event',
      date: '2026-09-12',
      startTime: '18:00',
    })
    const item = await addBringItem(event.id, 'Drinks')
    expect(item.name).toBe('Drinks')
    await deleteBringItem(item.id)
  })
})
```

This test file now needs `events` (the table) alongside `db` in its top-level imports — add it if not already present:

```ts
import { db } from '../../src/db/client'
import { events } from '../../src/db/schema'
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/events.test.ts`
Expected: FAIL — the new functions don't exist in `src/lib/events.ts` yet.

- [ ] **Step 3: Add the food/activity/bring-item functions to `src/lib/events.ts`**

Append to `src/lib/events.ts` (extend the existing schema import to include the new tables):

```ts
import { activityOptions, bringItems, foodOptions } from '@/db/schema'
```

```ts
export async function addFoodOption(eventId: string, name: string) {
  const event = await getEventOrThrow(eventId)
  assertDraft(event)
  const [option] = await db.insert(foodOptions).values({ eventId, name }).returning()
  return option
}

export async function toggleFoodOptionDisabled(foodOptionId: string) {
  const [option] = await db
    .select()
    .from(foodOptions)
    .where(eq(foodOptions.id, foodOptionId))
  if (!option) throw new EventActionError('Food option not found')
  const [updated] = await db
    .update(foodOptions)
    .set({ disabled: !option.disabled })
    .where(eq(foodOptions.id, foodOptionId))
    .returning()
  return updated
}

export async function deleteFoodOption(foodOptionId: string) {
  const [option] = await db
    .select()
    .from(foodOptions)
    .where(eq(foodOptions.id, foodOptionId))
  if (!option) throw new EventActionError('Food option not found')
  const event = await getEventOrThrow(option.eventId)
  assertDraft(event)
  await db.delete(foodOptions).where(eq(foodOptions.id, foodOptionId))
}

export async function addActivityOption(eventId: string, name: string) {
  const event = await getEventOrThrow(eventId)
  assertDraft(event)
  const [option] = await db
    .insert(activityOptions)
    .values({ eventId, name })
    .returning()
  return option
}

export async function deleteActivityOption(activityOptionId: string) {
  const [option] = await db
    .select()
    .from(activityOptions)
    .where(eq(activityOptions.id, activityOptionId))
  if (!option) throw new EventActionError('Activity option not found')
  const event = await getEventOrThrow(option.eventId)
  assertDraft(event)
  await db
    .delete(activityOptions)
    .where(eq(activityOptions.id, activityOptionId))
}

export async function addBringItem(eventId: string, name: string) {
  const event = await getEventOrThrow(eventId)
  assertDraft(event)
  const [item] = await db.insert(bringItems).values({ eventId, name }).returning()
  return item
}

export async function deleteBringItem(bringItemId: string) {
  const [item] = await db
    .select()
    .from(bringItems)
    .where(eq(bringItems.id, bringItemId))
  if (!item) throw new EventActionError('Bring item not found')
  const event = await getEventOrThrow(item.eventId)
  assertDraft(event)
  await db.delete(bringItems).where(eq(bringItems.id, bringItemId))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/events.test.ts`
Expected: PASS (all tests in the file, including the new ones — 8 total).

- [ ] **Step 5: Add the read queries**

Append to `src/lib/queries/events.ts` (extend the imports):

```ts
import { asc } from 'drizzle-orm'
import { activityOptions, bringItems, foodOptions } from '@/db/schema'
```

```ts
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
```

- [ ] **Step 6: Add the server actions**

Append to `src/lib/actions/events.ts` (extend the imports from `@/lib/events`):

```ts
import {
  addFoodOption,
  toggleFoodOptionDisabled,
  deleteFoodOption,
  addActivityOption,
  deleteActivityOption,
  addBringItem,
  deleteBringItem,
} from '@/lib/events'
```

```ts
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
```

- [ ] **Step 7: Add the config sections to the event detail page**

Replace the full contents of `src/app/admin/events/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getEvent, getFoodOptions, getActivityOptions, getBringItems } from '@/lib/queries/events'
import {
  addFoodOptionAction,
  toggleFoodOptionDisabledAction,
  deleteFoodOptionAction,
  addActivityOptionAction,
  deleteActivityOptionAction,
  addBringItemAction,
  deleteBringItemAction,
} from '@/lib/actions/events'

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const event = await getEvent(id)

  if (!event) {
    notFound()
  }

  const isDraft = event.status === 'draft'
  const [foodOptions, activityOptions, bringItems] = await Promise.all([
    getFoodOptions(id),
    getActivityOptions(id),
    getBringItems(id),
  ])

  return (
    <main>
      <h2>{event.title}</h2>
      <p>
        {event.date} {event.startTime} · {event.status}
      </p>
      {event.description ? <p>{event.description}</p> : null}

      <section>
        <h3>Food</h3>
        <ul>
          {foodOptions.map((option) => (
            <li key={option.id}>
              {option.name} {option.disabled ? '(disabled)' : ''}
              <form action={toggleFoodOptionDisabledAction} style={{ display: 'inline' }}>
                <input type="hidden" name="id" value={option.id} />
                <button type="submit">{option.disabled ? 'Enable' : 'Disable'}</button>
              </form>
              {isDraft ? (
                <form action={deleteFoodOptionAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="id" value={option.id} />
                  <input type="hidden" name="eventId" value={event.id} />
                  <button type="submit">Delete</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {isDraft ? (
          <form action={addFoodOptionAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <input type="text" name="name" placeholder="e.g. Tacos" required />
            <button type="submit">Add food option</button>
          </form>
        ) : null}
      </section>

      <section>
        <h3>Activities</h3>
        <ul>
          {activityOptions.map((option) => (
            <li key={option.id}>
              {option.name}
              {isDraft ? (
                <form action={deleteActivityOptionAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="id" value={option.id} />
                  <input type="hidden" name="eventId" value={event.id} />
                  <button type="submit">Delete</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {isDraft ? (
          <form action={addActivityOptionAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <input type="text" name="name" placeholder="e.g. Board Games" required />
            <button type="submit">Add activity option</button>
          </form>
        ) : null}
      </section>

      <section>
        <h3>What to bring</h3>
        <ul>
          {bringItems.map((item) => (
            <li key={item.id}>
              {item.name}
              {isDraft ? (
                <form action={deleteBringItemAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="eventId" value={event.id} />
                  <button type="submit">Delete</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {isDraft ? (
          <form action={addBringItemAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <input type="text" name="name" placeholder="e.g. Drinks" required />
            <button type="submit">Add item</button>
          </form>
        ) : null}
      </section>

      {/* Later tasks in this plan add invitee management, publish,
          dashboard, voting results, and finalize sections here. */}
    </main>
  )
}
```

- [ ] **Step 8: Verify the build**

Run: `npm run build`
Expected: succeeds with no type errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/events.ts src/lib/actions/events.ts src/lib/queries/events.ts src/app/admin/events/[id]/page.tsx tests/lib/events.test.ts
git commit -m "feat: food, activity, and bring-item option management"
```

---

### Task 4: Invitee management

**Files:**
- Modify: `src/lib/events.ts`
- Modify: `src/lib/actions/events.ts`
- Modify: `src/lib/queries/events.ts`
- Modify: `src/app/admin/events/[id]/page.tsx`
- Test: `tests/lib/events.test.ts`

**Interfaces:**
- Consumes: `getEventOrThrow`, `assertDraft`, `EventActionError` from `src/lib/events.ts` (Task 2); the `event_invitees` unique constraint from Task 1.
- Produces: `addInvitee(eventId, name, whatsappNumber)` and `removeInvitee(eventInviteeId)` added to `src/lib/events.ts`. `getInvitees(eventId)` added to `src/lib/queries/events.ts`. Task 5 (publish) reads invitees via `getInvitees` to display generated links, and Task 6 (dashboard/voting results) builds directly on the same query shape.

`addInvitee` sets a placeholder `inviteToken`/`tokenExpiresAt` at invite time (the schema's `NOT NULL` constraint requires *some* value) but deliberately backdates `tokenExpiresAt` to the Unix epoch — guaranteeing the placeholder token can never be used, regardless of guessability, before Task 5's `publishEvent` overwrites it with a real future expiry. This matches the design doc's decision that real, usable tokens are only generated at publish time.

- [ ] **Step 1: Write the failing tests**

Append to `tests/lib/events.test.ts` (extend the import from `../../src/lib/events`):

```ts
import { addInvitee, removeInvitee } from '../../src/lib/events'
```

```ts
describe('invitees', () => {
  it('creates a new user on first invite and adds an invitee', async () => {
    const event = await createEvent({
      title: 'Invitee Event',
      date: '2026-09-13',
      startTime: '18:00',
    })
    const invitee = await addInvitee(event.id, 'Bonga', '+15559990001')
    expect(invitee.rsvpStatus).toBe('pending')
    expect(invitee.inviteToken).toBeTruthy()
    expect(invitee.tokenExpiresAt.getTime()).toBeLessThan(Date.now())
  })

  it('reuses the existing user on a second invite by the same WhatsApp number', async () => {
    const eventA = await createEvent({
      title: 'Reuse Event A',
      date: '2026-09-14',
      startTime: '18:00',
    })
    const eventB = await createEvent({
      title: 'Reuse Event B',
      date: '2026-09-15',
      startTime: '18:00',
    })
    const first = await addInvitee(eventA.id, 'John', '+15559990002')
    const second = await addInvitee(eventB.id, 'John (renamed)', '+15559990002')
    expect(second.userId).toBe(first.userId)
  })

  it('rejects inviting the same person to the same event twice', async () => {
    const event = await createEvent({
      title: 'Duplicate Invitee Event',
      date: '2026-09-16',
      startTime: '18:00',
    })
    await addInvitee(event.id, 'Ana', '+15559990003')
    await expect(addInvitee(event.id, 'Ana', '+15559990003')).rejects.toThrow(
      EventActionError,
    )
  })

  it('removes an invitee from a draft event', async () => {
    const event = await createEvent({
      title: 'Remove Invitee Event',
      date: '2026-09-17',
      startTime: '18:00',
    })
    const invitee = await addInvitee(event.id, 'Carlos', '+15559990004')
    await removeInvitee(invitee.id)
    const remaining = await addInvitee(event.id, 'Carlos', '+15559990004')
    expect(remaining.id).not.toBe(invitee.id)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/events.test.ts`
Expected: FAIL — `addInvitee`/`removeInvitee` don't exist yet.

- [ ] **Step 3: Add the invitee functions to `src/lib/events.ts`**

Append to `src/lib/events.ts` (extend the imports — add `crypto`'s `randomUUID` and the `eventInvitees`/`users` tables):

```ts
import { randomUUID } from 'node:crypto'
import { eventInvitees, users } from '@/db/schema'
```

```ts
export async function addInvitee(
  eventId: string,
  name: string,
  whatsappNumber: string,
) {
  const event = await getEventOrThrow(eventId)
  assertDraft(event)

  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.whatsappNumber, whatsappNumber))

  if (!user) {
    ;[user] = await db.insert(users).values({ name, whatsappNumber }).returning()
  }

  try {
    const [invitee] = await db
      .insert(eventInvitees)
      .values({
        eventId,
        userId: user.id,
        // Placeholder — deliberately already-expired, so this token can
        // never be used before publishEvent (Task 5) overwrites it with a
        // real future expiry.
        inviteToken: randomUUID(),
        tokenExpiresAt: new Date(0),
      })
      .returning()
    return invitee
  } catch {
    throw new EventActionError('This person is already invited to this event')
  }
}

export async function removeInvitee(eventInviteeId: string) {
  const [invitee] = await db
    .select()
    .from(eventInvitees)
    .where(eq(eventInvitees.id, eventInviteeId))
  if (!invitee) throw new EventActionError('Invitee not found')
  const event = await getEventOrThrow(invitee.eventId)
  assertDraft(event)
  await db.delete(eventInvitees).where(eq(eventInvitees.id, eventInviteeId))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/events.test.ts`
Expected: PASS (all tests, including the new ones — 12 total).

- [ ] **Step 5: Add the read query**

Append to `src/lib/queries/events.ts` (extend the imports):

```ts
import { eventInvitees, users } from '@/db/schema'
```

```ts
export async function getInvitees(eventId: string) {
  return db
    .select({
      id: eventInvitees.id,
      rsvpStatus: eventInvitees.rsvpStatus,
      declineReason: eventInvitees.declineReason,
      inviteToken: eventInvitees.inviteToken,
      foodChoice1: eventInvitees.foodChoice1,
      foodChoice2: eventInvitees.foodChoice2,
      foodChoice3: eventInvitees.foodChoice3,
      activityChoice1: eventInvitees.activityChoice1,
      activityChoice2: eventInvitees.activityChoice2,
      activityChoice3: eventInvitees.activityChoice3,
      bringItemId: eventInvitees.bringItemId,
      userName: users.name,
      userWhatsappNumber: users.whatsappNumber,
    })
    .from(eventInvitees)
    .innerJoin(users, eq(eventInvitees.userId, users.id))
    .where(eq(eventInvitees.eventId, eventId))
    .orderBy(asc(users.name))
}
```

- [ ] **Step 6: Add the server actions**

Append to `src/lib/actions/events.ts` (extend the imports):

```ts
import { addInvitee, removeInvitee } from '@/lib/events'
```

```ts
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
```

- [ ] **Step 7: Add the invitees section to the event detail page**

In `src/app/admin/events/[id]/page.tsx`, extend the imports:

```ts
import { getEvent, getFoodOptions, getActivityOptions, getBringItems, getInvitees } from '@/lib/queries/events'
import {
  addFoodOptionAction,
  toggleFoodOptionDisabledAction,
  deleteFoodOptionAction,
  addActivityOptionAction,
  deleteActivityOptionAction,
  addBringItemAction,
  deleteBringItemAction,
  addInviteeAction,
  removeInviteeAction,
} from '@/lib/actions/events'
```

Add `getInvitees(id)` to the `Promise.all` call:

```tsx
  const [foodOptions, activityOptions, bringItems, invitees] = await Promise.all([
    getFoodOptions(id),
    getActivityOptions(id),
    getBringItems(id),
    getInvitees(id),
  ])
```

Add a new section after the "What to bring" section, before the closing comment:

```tsx
      <section>
        <h3>Invitees</h3>
        <ul>
          {invitees.map((invitee) => (
            <li key={invitee.id}>
              {invitee.userName} ({invitee.userWhatsappNumber}) — {invitee.rsvpStatus}
              {isDraft ? (
                <form action={removeInviteeAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="id" value={invitee.id} />
                  <input type="hidden" name="eventId" value={event.id} />
                  <button type="submit">Remove</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {isDraft ? (
          <form action={addInviteeAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <input type="text" name="name" placeholder="Name" required />
            <input
              type="text"
              name="whatsappNumber"
              placeholder="WhatsApp number, e.g. +15551234567"
              required
            />
            <button type="submit">Add invitee</button>
          </form>
        ) : null}
      </section>
```

- [ ] **Step 8: Verify the build**

Run: `npm run build`
Expected: succeeds with no type errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/events.ts src/lib/actions/events.ts src/lib/queries/events.ts src/app/admin/events/[id]/page.tsx tests/lib/events.test.ts
git commit -m "feat: invitee management"
```

---

### Task 5: Publish

**Files:**
- Modify: `src/lib/events.ts`
- Modify: `src/lib/actions/events.ts`
- Modify: `src/app/admin/events/[id]/page.tsx`
- Test: `tests/lib/events.test.ts`

**Interfaces:**
- Consumes: `getEventOrThrow`, `assertDraft`, `EventActionError` (Task 2); `foodOptions`/`activityOptions`/`eventInvitees` tables and the placeholder-token convention from `addInvitee` (Tasks 3-4).
- Produces: `publishEvent(eventId): Promise<Event>` added to `src/lib/events.ts`. Task 7 (finalize) depends on events reaching `published` status via this function.

- [ ] **Step 1: Write the failing tests**

Append to `tests/lib/events.test.ts` (extend the import):

```ts
import { publishEvent } from '../../src/lib/events'
```

```ts
describe('publishEvent', () => {
  it('rejects publishing with no food option', async () => {
    const event = await createEvent({
      title: 'No Food Event',
      date: '2026-09-18',
      startTime: '18:00',
    })
    await addActivityOption(event.id, 'Board Games')
    await addInvitee(event.id, 'Oscar', '+15559990005')
    await expect(publishEvent(event.id)).rejects.toThrow(/food option/)
  })

  it('rejects publishing with no activity option', async () => {
    const event = await createEvent({
      title: 'No Activity Event',
      date: '2026-09-19',
      startTime: '18:00',
    })
    await addFoodOption(event.id, 'Tacos')
    await addInvitee(event.id, 'Oscar', '+15559990006')
    await expect(publishEvent(event.id)).rejects.toThrow(/activity option/)
  })

  it('rejects publishing with no invitees', async () => {
    const event = await createEvent({
      title: 'No Invitees Event',
      date: '2026-09-20',
      startTime: '18:00',
    })
    await addFoodOption(event.id, 'Tacos')
    await addActivityOption(event.id, 'Board Games')
    await expect(publishEvent(event.id)).rejects.toThrow(/invite at least one/i)
  })

  it('publishes a fully-configured event and generates usable tokens', async () => {
    const event = await createEvent({
      title: 'Publishable Event',
      date: '2026-09-21',
      startTime: '18:00',
    })
    await addFoodOption(event.id, 'Tacos')
    await addActivityOption(event.id, 'Board Games')
    const invitee = await addInvitee(event.id, 'Oscar', '+15559990007')

    const published = await publishEvent(event.id)
    expect(published.status).toBe('published')

    const [refreshed] = await db
      .select()
      .from(eventInvitees)
      .where(eq(eventInvitees.id, invitee.id))
    expect(refreshed.inviteToken).not.toBe(invitee.inviteToken)
    expect(refreshed.tokenExpiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('rejects publishing an already-published event', async () => {
    const event = await createEvent({
      title: 'Double Publish Event',
      date: '2026-09-22',
      startTime: '18:00',
    })
    await addFoodOption(event.id, 'Tacos')
    await addActivityOption(event.id, 'Board Games')
    await addInvitee(event.id, 'Oscar', '+15559990008')
    await publishEvent(event.id)
    await expect(publishEvent(event.id)).rejects.toThrow(EventActionError)
  })
})
```

This file now needs `eventInvitees` alongside `events` in its top-level table import:

```ts
import { events, eventInvitees } from '../../src/db/schema'
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/events.test.ts`
Expected: FAIL — `publishEvent` doesn't exist yet.

- [ ] **Step 3: Add `publishEvent` to `src/lib/events.ts`**

Append to `src/lib/events.ts` (extend the drizzle-orm import to include `count`):

```ts
import { count, eq } from 'drizzle-orm'
```

```ts
export async function publishEvent(eventId: string) {
  const event = await getEventOrThrow(eventId)
  assertDraft(event)

  const [[{ foodCount }], [{ activityCount }], [{ inviteeCount }]] = await Promise.all([
    db
      .select({ foodCount: count() })
      .from(foodOptions)
      .where(eq(foodOptions.eventId, eventId)),
    db
      .select({ activityCount: count() })
      .from(activityOptions)
      .where(eq(activityOptions.eventId, eventId)),
    db
      .select({ inviteeCount: count() })
      .from(eventInvitees)
      .where(eq(eventInvitees.eventId, eventId)),
  ])

  if (foodCount === 0) {
    throw new EventActionError('Add at least one food option before publishing')
  }
  if (activityCount === 0) {
    throw new EventActionError('Add at least one activity option before publishing')
  }
  if (inviteeCount === 0) {
    throw new EventActionError('Invite at least one person before publishing')
  }

  const invitees = await db
    .select()
    .from(eventInvitees)
    .where(eq(eventInvitees.eventId, eventId))

  // Real expiry: the event's date/time plus five days' grace, so an
  // attendee can still view finalized details shortly after the event.
  const tokenExpiresAt = new Date(`${event.date}T${event.startTime}Z`)
  tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 5)

  await Promise.all(
    invitees.map((invitee) =>
      db
        .update(eventInvitees)
        .set({ inviteToken: randomUUID(), tokenExpiresAt })
        .where(eq(eventInvitees.id, invitee.id)),
    ),
  )

  const [updated] = await db
    .update(events)
    .set({ status: 'published' })
    .where(eq(events.id, eventId))
    .returning()
  return updated
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/events.test.ts`
Expected: PASS (all tests, including the new ones — 17 total).

- [ ] **Step 5: Add the server action**

Append to `src/lib/actions/events.ts` (extend the imports):

```ts
import { publishEvent } from '@/lib/events'
```

```ts
export async function publishEventAction(formData: FormData) {
  const eventId = formData.get('eventId')
  if (typeof eventId !== 'string') throw new Error('Missing eventId')
  await publishEvent(eventId)
  revalidatePath(`/admin/events/${eventId}`)
}
```

Note: `publishEvent` throws `EventActionError` with a specific message on validation failure. Next.js Server Actions surface a thrown error's message to the nearest error boundary by default; for this phase, letting it propagate (rather than building a dedicated error-display component) is sufficient — the admin sees the error page with the message. A nicer inline error display is a reasonable future improvement, not required now.

- [ ] **Step 6: Add the publish button and invite-links display to the event detail page**

In `src/app/admin/events/[id]/page.tsx`, extend the imports:

```ts
import { publishEventAction } from '@/lib/actions/events'
```

Add this section right after the "Invitees" section, before the closing comment:

```tsx
      {isDraft ? (
        <section>
          <h3>Publish</h3>
          <form action={publishEventAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <button type="submit">Publish &amp; Invite</button>
          </form>
        </section>
      ) : null}

      {!isDraft ? (
        <section>
          <h3>Invite links</h3>
          <p>
            WhatsApp sending isn&apos;t wired up yet — share these links manually
            to test the RSVP flow.
          </p>
          <ul>
            {invitees.map((invitee) => (
              <li key={invitee.id}>
                {invitee.userName}: <code>/e/{invitee.inviteToken}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
```

The `/e/[token]` path shown here is the RSVP route Phase 3 will build — it doesn't exist yet, so these links aren't clickable until then. That's expected: this task only needs the tokens visible for manual copy/testing once Phase 3 lands.

- [ ] **Step 7: Verify the build**

Run: `npm run build`
Expected: succeeds with no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/events.ts src/lib/actions/events.ts src/app/admin/events/[id]/page.tsx tests/lib/events.test.ts
git commit -m "feat: publish event"
```

---

### Task 6: RSVP dashboard and voting results

**Files:**
- Modify: `src/lib/queries/events.ts`
- Modify: `src/app/admin/events/[id]/page.tsx`

**Interfaces:**
- Consumes: `getInvitees`, `getFoodOptions`, `getActivityOptions`, `getBringItems` (Tasks 3-4 of this plan) — the attendee table is built directly from these already-fetched arrays, no new query.
- Produces: `getRsvpCounts(eventId)` and `getVotingResults(eventId)` added to `src/lib/queries/events.ts`. Nothing later in this plan depends on these — Phase 3 will be the first to actually generate non-zero data for them.

This task covers all three pieces of plan.md §12-13's Admin Event Dashboard: RSVP status counts, the attendee table (one row per invitee, joined to their top food/activity choice and bring-item assignment by name), and voting-results tallies.

No new tests in this task — per the design doc's confirmed testing scope, dashboard/voting-results aggregation isn't covered by dedicated tests (plain `GROUP BY`-equivalent counting and lookups over already-tested query data; the value is in seeing it rendered correctly once Phase 3 exists). Verify manually in Step 3.

- [ ] **Step 1: Add the aggregate queries**

Append to `src/lib/queries/events.ts`:

```ts
export async function getRsvpCounts(eventId: string) {
  const invitees = await db
    .select({ rsvpStatus: eventInvitees.rsvpStatus })
    .from(eventInvitees)
    .where(eq(eventInvitees.eventId, eventId))

  return {
    invited: invitees.length,
    attending: invitees.filter((i) => i.rsvpStatus === 'attending').length,
    declined: invitees.filter((i) => i.rsvpStatus === 'declined').length,
    pending: invitees.filter((i) => i.rsvpStatus === 'pending').length,
  }
}

function tally(
  options: { id: string; name: string }[],
  first: (string | null)[],
  second: (string | null)[],
  third: (string | null)[],
) {
  return options.map((option) => ({
    id: option.id,
    name: option.name,
    first: first.filter((id) => id === option.id).length,
    second: second.filter((id) => id === option.id).length,
    third: third.filter((id) => id === option.id).length,
  }))
}

export async function getVotingResults(eventId: string) {
  const [foodOpts, activityOpts, choices] = await Promise.all([
    getFoodOptions(eventId),
    getActivityOptions(eventId),
    db
      .select({
        foodChoice1: eventInvitees.foodChoice1,
        foodChoice2: eventInvitees.foodChoice2,
        foodChoice3: eventInvitees.foodChoice3,
        activityChoice1: eventInvitees.activityChoice1,
        activityChoice2: eventInvitees.activityChoice2,
        activityChoice3: eventInvitees.activityChoice3,
      })
      .from(eventInvitees)
      .where(eq(eventInvitees.eventId, eventId)),
  ])

  return {
    food: tally(
      foodOpts,
      choices.map((c) => c.foodChoice1),
      choices.map((c) => c.foodChoice2),
      choices.map((c) => c.foodChoice3),
    ),
    activity: tally(
      activityOpts,
      choices.map((c) => c.activityChoice1),
      choices.map((c) => c.activityChoice2),
      choices.map((c) => c.activityChoice3),
    ),
  }
}
```

- [ ] **Step 2: Add the dashboard and voting-results sections to the event detail page**

In `src/app/admin/events/[id]/page.tsx`, extend the imports:

```ts
import { getRsvpCounts, getVotingResults } from '@/lib/queries/events'
```

Add `getRsvpCounts(id)` and `getVotingResults(id)` to the `Promise.all` call — but only fetch them when the event isn't a draft (no point querying zero-invitee drafts). Restructure the data-fetching block:

```tsx
  const [foodOptions, activityOptions, bringItems, invitees] = await Promise.all([
    getFoodOptions(id),
    getActivityOptions(id),
    getBringItems(id),
    getInvitees(id),
  ])

  const [rsvpCounts, votingResults] = isDraft
    ? [null, null]
    : await Promise.all([getRsvpCounts(id), getVotingResults(id)])
```

Add this section right after the "Invite links" section, before the closing comment. It includes the attendee table (plan.md §12 — one row per invitee, joined to their top food/activity choice and bring-item assignment by name) alongside the status counts, using the `invitees`/`foodOptions`/`activityOptions`/`bringItems` arrays already fetched earlier in the component — no new query needed:

```tsx
      {rsvpCounts ? (
        <section>
          <h3>RSVP status</h3>
          <table>
            <tbody>
              <tr>
                <td>Invited</td>
                <td>{rsvpCounts.invited}</td>
              </tr>
              <tr>
                <td>Attending</td>
                <td>{rsvpCounts.attending}</td>
              </tr>
              <tr>
                <td>Declined</td>
                <td>{rsvpCounts.declined}</td>
              </tr>
              <tr>
                <td>No response</td>
                <td>{rsvpCounts.pending}</td>
              </tr>
            </tbody>
          </table>
        </section>
      ) : null}

      {rsvpCounts ? (
        <section>
          <h3>Attendees</h3>
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>RSVP</th>
                <th>Food</th>
                <th>Activity</th>
                <th>Bringing</th>
              </tr>
            </thead>
            <tbody>
              {invitees.map((invitee) => (
                <tr key={invitee.id}>
                  <td>{invitee.userName}</td>
                  <td>{invitee.rsvpStatus}</td>
                  <td>
                    {foodOptions.find((o) => o.id === invitee.foodChoice1)?.name ?? '—'}
                  </td>
                  <td>
                    {activityOptions.find((o) => o.id === invitee.activityChoice1)?.name ?? '—'}
                  </td>
                  <td>
                    {bringItems.find((i) => i.id === invitee.bringItemId)?.name ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {votingResults ? (
        <section>
          <h3>Voting results</h3>
          <h4>Food</h4>
          <table>
            <thead>
              <tr>
                <th>Option</th>
                <th>1st</th>
                <th>2nd</th>
                <th>3rd</th>
              </tr>
            </thead>
            <tbody>
              {votingResults.food.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.first}</td>
                  <td>{row.second}</td>
                  <td>{row.third}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4>Activity</h4>
          <table>
            <thead>
              <tr>
                <th>Option</th>
                <th>1st</th>
                <th>2nd</th>
                <th>3rd</th>
              </tr>
            </thead>
            <tbody>
              {votingResults.activity.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.first}</td>
                  <td>{row.second}</td>
                  <td>{row.third}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
```

- [ ] **Step 3: Verify manually**

Run: `npm run build`
Expected: succeeds with no type errors.

Run: `docker compose --profile dev up -d postgres`, `npm run dev &`, publish an event through the browser (per Task 2 Step 10's flow, add food/activity options and an invitee first, then click "Publish & Invite"). Confirm the RSVP status table shows `Invited: 1, Attending: 0, Declined: 0, No response: 1`, the attendee table shows one row for your invitee with `—` in the Food/Activity/Bringing columns (no RSVP data exists until Phase 3), and the voting-results tables render with all-zero counts. Stop the dev server (`kill %1`) when done.

- [ ] **Step 4: Commit**

```bash
git add src/lib/queries/events.ts src/app/admin/events/[id]/page.tsx
git commit -m "feat: RSVP dashboard and voting results"
```

---

### Task 7: Finalize

**Files:**
- Modify: `src/lib/events.ts`
- Modify: `src/lib/actions/events.ts`
- Modify: `src/app/admin/events/[id]/page.tsx`
- Test: `tests/lib/events.test.ts`

**Interfaces:**
- Consumes: `getEventOrThrow`, `EventActionError` (Task 2); `publishEvent` (Task 5) to reach the `published` precondition; `foodOptions`/`activityOptions` (Task 3) as the values `finalizeEvent` accepts.
- Produces: `finalizeEvent(eventId, finalFoodOptionId, finalActivityOptionId): Promise<Event>` added to `src/lib/events.ts`. Nothing later in this plan depends on it — this is the last task.

- [ ] **Step 1: Write the failing tests**

Append to `tests/lib/events.test.ts` (extend the import):

```ts
import { finalizeEvent } from '../../src/lib/events'
```

```ts
describe('finalizeEvent', () => {
  it('rejects finalizing a draft event', async () => {
    const event = await createEvent({
      title: 'Finalize Draft Guard Event',
      date: '2026-09-23',
      startTime: '18:00',
    })
    const food = await addFoodOption(event.id, 'Tacos')
    const activity = await addActivityOption(event.id, 'Board Games')
    await expect(
      finalizeEvent(event.id, food.id, activity.id),
    ).rejects.toThrow(EventActionError)
  })

  it('sets the final options and status together', async () => {
    const event = await createEvent({
      title: 'Finalize Event',
      date: '2026-09-24',
      startTime: '18:00',
    })
    const food = await addFoodOption(event.id, 'Tacos')
    const activity = await addActivityOption(event.id, 'Board Games')
    await addInvitee(event.id, 'Oscar', '+15559990009')
    await publishEvent(event.id)

    const finalized = await finalizeEvent(event.id, food.id, activity.id)
    expect(finalized.status).toBe('finalized')
    expect(finalized.finalFoodOptionId).toBe(food.id)
    expect(finalized.finalActivityOptionId).toBe(activity.id)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/events.test.ts`
Expected: FAIL — `finalizeEvent` doesn't exist yet.

- [ ] **Step 3: Add `finalizeEvent` to `src/lib/events.ts`**

Append to `src/lib/events.ts`:

```ts
export async function finalizeEvent(
  eventId: string,
  finalFoodOptionId: string,
  finalActivityOptionId: string,
) {
  const event = await getEventOrThrow(eventId)
  if (event.status !== 'published') {
    throw new EventActionError('Only a published event can be finalized')
  }
  const [updated] = await db
    .update(events)
    .set({
      status: 'finalized',
      finalFoodOptionId,
      finalActivityOptionId,
    })
    .where(eq(events.id, eventId))
    .returning()
  return updated
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/events.test.ts`
Expected: PASS (all tests, including the new ones — 19 total).

- [ ] **Step 5: Add the server action**

Append to `src/lib/actions/events.ts` (extend the imports):

```ts
import { finalizeEvent } from '@/lib/events'
```

```ts
const finalizeSchema = z.object({
  eventId: z.string().uuid(),
  finalFoodOptionId: z.string().uuid(),
  finalActivityOptionId: z.string().uuid(),
})

export async function finalizeEventAction(formData: FormData) {
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
```

- [ ] **Step 6: Add the finalize form and finalized-state display to the event detail page**

In `src/app/admin/events/[id]/page.tsx`, extend the imports:

```ts
import { finalizeEventAction } from '@/lib/actions/events'
```

Add this section right after the "Voting results" section, before the closing comment:

```tsx
      {event.status === 'published' ? (
        <section>
          <h3>Finalize</h3>
          <form action={finalizeEventAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <div>
              <label htmlFor="finalFoodOptionId">Final food</label>
              <select id="finalFoodOptionId" name="finalFoodOptionId" required>
                {foodOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="finalActivityOptionId">Final activity</label>
              <select id="finalActivityOptionId" name="finalActivityOptionId" required>
                {activityOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit">Finalize Event</button>
          </form>
        </section>
      ) : null}

      {event.status === 'finalized' ? (
        <section>
          <h3>Finalized</h3>
          <p>
            Final food:{' '}
            {foodOptions.find((o) => o.id === event.finalFoodOptionId)?.name}
          </p>
          <p>
            Final activity:{' '}
            {activityOptions.find((o) => o.id === event.finalActivityOptionId)?.name}
          </p>
        </section>
      ) : null}
```

- [ ] **Step 7: Verify the build and the full flow manually**

Run: `npm run build`
Expected: succeeds with no type errors.

Run: `docker compose --profile dev up -d postgres`, `npm run dev &`. Walk through the complete flow in the browser: create an event, add a food option, an activity option, an invitee, publish, confirm the invite link and RSVP dashboard render, finalize with the food/activity you added, confirm the finalized section shows the names you picked. Stop the dev server (`kill %1`) when done.

- [ ] **Step 8: Commit**

```bash
git add src/lib/events.ts src/lib/actions/events.ts src/app/admin/events/[id]/page.tsx tests/lib/events.test.ts
git commit -m "feat: finalize event"
```

---

## End-of-Phase Verification

- [ ] Run the full test suite: `docker compose --profile dev up -d postgres-test`, then `npx vitest run` — expect all tests across all files to pass: 35 tests across 6 files (Foundation's 15 across `env`/`schema`/`client`/`middleware`, plus this plan's 20 across the new `constraints` file and `events.test.ts`'s accumulated describe blocks).
- [ ] Run `npm run build` — expect success.
- [ ] Walk through the full admin flow once more end to end in the browser (create → configure → invite → publish → view dashboard/voting-results (zero-state) → finalize).
- [ ] Confirm `git log --oneline` shows seven commits, one per task, on top of Foundation's history.
