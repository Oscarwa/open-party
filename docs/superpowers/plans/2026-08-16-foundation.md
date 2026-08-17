# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a deployable, provably-wired skeleton of the app — project scaffold, database schema/migrations, docker-compose deployment, and the public/admin route split with Tailnet-only gating — with zero business logic. Later phases (Admin event management, Attendee RSVP + magic-link auth, WhatsApp integration) build features on top of this.

**Architecture:** A single Next.js (TypeScript, App Router) app serves both the public attendee-facing routes and the `/admin` routes from one process. PostgreSQL (Drizzle ORM) holds all data. WAHA runs as a separate container reachable only from the app over the internal Docker network. Tailscale Funnel exposes only the public route prefixes to the internet; `/admin` is reachable solely via the Tailnet, enforced both at the infra layer (Funnel path allowlist) and defense-in-depth in application middleware (Tailscale identity header check).

**Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript, Drizzle ORM + `postgres` (postgres.js) against PostgreSQL, Zod for env validation, Vitest for tests, Docker + Docker Compose, Tailscale Serve/Funnel.

## Global Constraints

- Single-tenant app: one organizer, one shared contact pool — no multi-tenant/household concept (plan.md §3).
- Self-hosted on the user's homelab; public routes reachable via Tailscale Funnel, admin routes reachable only via the Tailnet (plan.md §19).
- No password or OTP system anywhere. Attendees authenticate via per-invitee magic links (later phase); admin has no in-app login — Tailnet placement is the gate (plan.md §6.2, §20).
- Background jobs (reminders) run in-process via `node-cron` inside the Next.js server — no separate worker/queue service (plan.md §19).
- WAHA runs on a spare/secondary WhatsApp number and its container must never be exposed to the Tailnet or Funnel — only the app can reach it, over the internal Docker network (plan.md §16, §19).
- Testing is intentionally light: integration coverage for the trickiest flows, no e2e/UI test tooling for MVP (plan.md §19).
- Reuse the user's existing homelab PostgreSQL instance in production; a docker-compose "dev" profile provides disposable Postgres containers for local development and tests only.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `next-env.d.ts`
- Create: `.gitignore`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a buildable Next.js app with `npm run dev` / `npm run build` / `npm run start` scripts, and the `src/app/` directory later tasks add routes under.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "open-party",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^20.14.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: installs successfully, creates `package-lock.json`.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.ts`**

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
```

- [ ] **Step 5: Create `next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
```

- [ ] **Step 6: Create `.gitignore`**

```text
node_modules/
.next/
.env
.env.local
*.local
```

- [ ] **Step 7: Create the root layout**

`src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Open Party',
  description: 'Organize recurring gatherings with friends and family.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 8: Create the public home page stub**

`src/app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>Open Party</h1>
      <p>My Events will appear here once you open an invitation link.</p>
    </main>
  )
}
```

- [ ] **Step 9: Verify the app builds**

Run: `npm run build`
Expected: build succeeds with no errors, `.next/standalone` output is produced.

- [ ] **Step 10: Verify the app serves the home page**

Run: `npm run start &` then `sleep 2 && curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/`
Expected: prints `200`.
Then stop the server: `kill %1`

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts next-env.d.ts .gitignore src/app/layout.tsx src/app/page.tsx
git commit -m "chore: scaffold Next.js + TypeScript project"
```

---

### Task 2: Environment validation

**Files:**
- Create: `src/lib/env.ts`
- Test: `tests/lib/env.test.ts`
- Create: `vitest.config.ts`
- Create: `.env.example`

**Interfaces:**
- Consumes: nothing new.
- Produces: `loadEnv(source?: NodeJS.ProcessEnv): Env` from `src/lib/env.ts`, where `Env = { DATABASE_URL: string; WAHA_URL: string; WAHA_SESSION: string; SESSION_SECRET: string }`. Tasks 3, 4, and later phases call `loadEnv()` to read validated config; it throws with a readable message if any var is missing/invalid.

- [ ] **Step 1: Install test dependencies**

Run: `npm install -D vitest && npm install zod`
Expected: adds `vitest` to devDependencies and `zod` to dependencies.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: Write the failing test**

`tests/lib/env.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { loadEnv } from '../../src/lib/env'

describe('loadEnv', () => {
  const validEnv = {
    DATABASE_URL: 'postgres://user:pass@localhost:5432/open_party',
    WAHA_URL: 'http://waha:3000',
    WAHA_SESSION: 'default',
    SESSION_SECRET: 'a'.repeat(32),
  }

  it('returns parsed env when all required vars are present and valid', () => {
    const env = loadEnv(validEnv)
    expect(env).toEqual(validEnv)
  })

  it('throws a readable error when DATABASE_URL is missing', () => {
    const { DATABASE_URL, ...rest } = validEnv
    expect(() => loadEnv(rest)).toThrow(/DATABASE_URL/)
  })

  it('throws when DATABASE_URL is not a valid URL', () => {
    expect(() =>
      loadEnv({ ...validEnv, DATABASE_URL: 'not-a-url' })
    ).toThrow(/DATABASE_URL/)
  })

  it('throws when SESSION_SECRET is shorter than 32 characters', () => {
    expect(() =>
      loadEnv({ ...validEnv, SESSION_SECRET: 'short' })
    ).toThrow(/SESSION_SECRET/)
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/lib/env.test.ts`
Expected: FAIL — `src/lib/env.ts` does not exist yet.

- [ ] **Step 5: Implement `src/lib/env.ts`**

```ts
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  WAHA_URL: z.string().url(),
  WAHA_SESSION: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ')
    throw new Error(`Invalid environment configuration: ${issues}`)
  }
  return result.data
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/lib/env.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Create `.env.example`**

```text
# Postgres connection string.
# - Local dev (via `docker compose --profile dev up`): postgres://open_party:open_party@localhost:5432/open_party_dev
# - Production: point at your existing homelab Postgres instance.
DATABASE_URL=postgres://open_party:open_party@localhost:5432/open_party_dev

# WAHA (WhatsApp HTTP API) base URL.
# - Inside docker compose (app -> waha container): http://waha:3000
# - Local dev without docker: http://localhost:3001 (if you publish WAHA's port locally)
WAHA_URL=http://localhost:3001
WAHA_SESSION=default

# Random secret (32+ chars) used to sign session/magic-link cookies.
# Generate with: openssl rand -base64 32
SESSION_SECRET=
```

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/env.ts tests/lib/env.test.ts .env.example
git commit -m "feat: add environment variable validation"
```

---

### Task 3: Database schema

**Files:**
- Create: `src/db/schema.ts`
- Create: `drizzle.config.ts`
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Consumes: `loadEnv` from `src/lib/env.ts` (Task 2).
- Produces: Drizzle table objects from `src/db/schema.ts` — `users`, `events`, `foodOptions`, `activityOptions`, `bringItems`, `eventInvitees` — plus `eventStatusEnum` (`'draft' | 'published' | 'finalized' | 'completed'`) and `rsvpStatusEnum` (`'pending' | 'attending' | 'declined'`). Task 4 and all later phases import these.

- [ ] **Step 1: Install Drizzle**

Run: `npm install drizzle-orm && npm install -D drizzle-kit`

- [ ] **Step 2: Write the failing test**

`tests/db/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getTableColumns } from 'drizzle-orm'
import {
  users,
  events,
  foodOptions,
  activityOptions,
  bringItems,
  eventInvitees,
} from '../../src/db/schema'

describe('schema', () => {
  it('users table has the expected columns', () => {
    expect(Object.keys(getTableColumns(users))).toEqual([
      'id',
      'name',
      'whatsappNumber',
      'createdAt',
    ])
  })

  it('events table has the expected columns', () => {
    expect(Object.keys(getTableColumns(events))).toEqual([
      'id',
      'title',
      'date',
      'startTime',
      'description',
      'status',
      'finalFoodOptionId',
      'finalActivityOptionId',
      'createdAt',
    ])
  })

  it('foodOptions table has the expected columns', () => {
    expect(Object.keys(getTableColumns(foodOptions))).toEqual([
      'id',
      'eventId',
      'name',
      'disabled',
    ])
  })

  it('activityOptions table has the expected columns', () => {
    expect(Object.keys(getTableColumns(activityOptions))).toEqual([
      'id',
      'eventId',
      'name',
    ])
  })

  it('bringItems table has the expected columns', () => {
    expect(Object.keys(getTableColumns(bringItems))).toEqual([
      'id',
      'eventId',
      'name',
      'assignedToUserId',
    ])
  })

  it('eventInvitees table has the expected columns', () => {
    expect(Object.keys(getTableColumns(eventInvitees))).toEqual([
      'id',
      'eventId',
      'userId',
      'inviteToken',
      'tokenExpiresAt',
      'rsvpStatus',
      'declineReason',
      'foodChoice1',
      'foodChoice2',
      'foodChoice3',
      'activityChoice1',
      'activityChoice2',
      'activityChoice3',
      'bringItemId',
      'rsvpAt',
    ])
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/db/schema.test.ts`
Expected: FAIL — `src/db/schema.ts` does not exist yet.

- [ ] **Step 4: Implement `src/db/schema.ts`**

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

export const foodOptions = pgTable('food_options', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  disabled: boolean('disabled').default(false).notNull(),
})

export const activityOptions = pgTable('activity_options', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
})

export const bringItems = pgTable('bring_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  assignedToUserId: uuid('assigned_to_user_id').references(() => users.id),
})

export const eventInvitees = pgTable('event_invitees', {
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
})
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/db/schema.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Create `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit'
import { loadEnv } from './src/lib/env'

const env = loadEnv()

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
```

- [ ] **Step 7: Add the `db:generate` script**

In `package.json`, add to `"scripts"`:

```json
"db:generate": "drizzle-kit generate"
```

- [ ] **Step 8: Generate the initial migration**

Run: `cp .env.example .env.local && npm run db:generate`
Expected: creates `src/db/migrations/0000_*.sql` and `src/db/migrations/meta/`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json drizzle.config.ts src/db/schema.ts tests/db/schema.test.ts src/db/migrations .env.local
git commit -m "feat: add database schema and initial migration"
```

Note: `.env.local` is gitignored (Task 1 `.gitignore`) — if `git add` reports it as ignored, skip it; only the migration files need to be committed.

---

### Task 4: Database client and migration runner

**Files:**
- Create: `src/db/client.ts`
- Create: `scripts/migrate.ts`
- Test: `tests/db/client.test.ts`

**Interfaces:**
- Consumes: `loadEnv` (Task 2), schema tables (Task 3).
- Produces: `db` (a Drizzle `PostgresJsDatabase` instance) from `src/db/client.ts`, importable as `import { db } from '@/db/client'`. Later phases use `db.select()/.insert()/.update()` against the Task 3 tables. Also produces the `npm run db:migrate` script for applying migrations to a live database.

- [ ] **Step 1: Install the Postgres driver and `tsx`**

Run: `npm install postgres && npm install -D tsx`

- [ ] **Step 2: Write the failing test**

`tests/db/client.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import * as schema from '../../src/db/schema'

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://open_party:open_party@localhost:55432/open_party_test'

const queryClient = postgres(TEST_DATABASE_URL)
const testDb = drizzle(queryClient, { schema })

describe('db client', () => {
  beforeAll(async () => {
    await migrate(testDb, { migrationsFolder: './src/db/migrations' })
  })

  it('inserts and reads back a user', async () => {
    const [inserted] = await testDb
      .insert(schema.users)
      .values({ name: 'Oscar', whatsappNumber: '+15551234567' })
      .returning()

    const [found] = await testDb
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, inserted.id))

    expect(found.name).toBe('Oscar')
    expect(found.whatsappNumber).toBe('+15551234567')
  })
})
```

This test needs a running Postgres — it's added by Task 5's docker-compose file. Steps 3-4 below will fail until that exists; that's expected at this point in the plan (Task 5 comes next). If executing tasks out of order, start the dev postgres containers first: `docker compose --profile dev up -d postgres-test` (see Task 5).

- [ ] **Step 3: Run the test to verify it fails for the right reason**

Run: `npx vitest run tests/db/client.test.ts`
Expected: FAIL — connection refused to `localhost:55432` (no Postgres running yet). This confirms the test exercises a real connection rather than passing vacuously.

Note: port 55432 (rather than the more conventional 5433) is deliberate — 5433 is a common "just bump 5432 by one" convention other locally-running Postgres containers may already occupy, causing a silent collision (see the incident logged in this plan's SDD ledger during implementation).

- [ ] **Step 4: Implement `src/db/client.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { loadEnv } from '../lib/env'
import * as schema from './schema'

const env = loadEnv()

const queryClient = postgres(env.DATABASE_URL)

export const db = drizzle(queryClient, { schema })
```

- [ ] **Step 5: Implement `scripts/migrate.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { loadEnv } from '../src/lib/env'

async function main() {
  const env = loadEnv()
  const client = postgres(env.DATABASE_URL, { max: 1 })
  const db = drizzle(client)
  await migrate(db, { migrationsFolder: './src/db/migrations' })
  await client.end()
  console.log('Migrations applied.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 6: Add the `db:migrate` script**

In `package.json`, add to `"scripts"`:

```json
"db:migrate": "tsx scripts/migrate.ts"
```

- [ ] **Step 7: Start the dev/test Postgres containers (from Task 5's compose file) and run the test**

Run: `docker compose --profile dev up -d postgres-test`
Then: `npx vitest run tests/db/client.test.ts`
Expected: PASS (1 test). Tear down when done: `docker compose --profile dev down`

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/db/client.ts scripts/migrate.ts tests/db/client.test.ts
git commit -m "feat: add database client and migration runner"
```

---

### Task 5: Docker deployment

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docker-compose.yml`

**Interfaces:**
- Consumes: `package.json` build/start scripts (Task 1), env vars validated by `src/lib/env.ts` (Task 2).
- Produces: a buildable `open-party` Docker image and a `docker-compose.yml` with services `app`, `waha`, and dev-only `postgres` / `postgres-test`. Task 6 relies on `app` being reachable at `127.0.0.1:3000` only.

- [ ] **Step 1: Create `.dockerignore`**

```text
node_modules
.next
.git
.env.local
tests
docs
*.md
```

- [ ] **Step 2: Create the `public/` directory**

Next.js's standalone Docker build copies `public/` unconditionally; without it the Docker build fails on a missing-directory error.

Run: `mkdir -p public && touch public/.gitkeep`

- [ ] **Step 3: Create `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

- [ ] **Step 4: Create `docker-compose.yml`**

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    env_file: .env
    environment:
      # Overrides for running the full stack via compose: resolve
      # Postgres/WAHA by their Docker network service name instead of
      # localhost. In real production, .env's DATABASE_URL should point
      # at your existing homelab Postgres instance instead — remove
      # this override in that case.
      DATABASE_URL: postgres://open_party:open_party@postgres:5432/open_party_dev
      WAHA_URL: http://waha:3000
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      - waha

  waha:
    image: devlikeapro/waha:latest
    restart: unless-stopped
    volumes:
      - waha-sessions:/app/.sessions
    # No published ports: WAHA is reachable only from `app` over the
    # internal Docker network (http://waha:3000) — never from the
    # Tailnet or Funnel (plan.md §16, §19).

  postgres:
    profiles: ["dev"]
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: open_party
      POSTGRES_PASSWORD: open_party
      POSTGRES_DB: open_party_dev
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - postgres-dev-data:/var/lib/postgresql/data

  postgres-test:
    profiles: ["dev"]
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: open_party
      POSTGRES_PASSWORD: open_party
      POSTGRES_DB: open_party_test
    ports:
      - "127.0.0.1:55432:5432"
    tmpfs:
      - /var/lib/postgresql/data

volumes:
  waha-sessions:
  postgres-dev-data:
```

- [ ] **Step 5: Verify the image builds**

Run: `docker build -t open-party .`
Expected: builds successfully.

- [ ] **Step 6: Verify the compose file is valid**

Run: `docker compose config --quiet`
Expected: no output, exit code 0.

- [ ] **Step 7: Smoke-test the full stack**

```bash
cp .env.example .env
docker compose --profile dev up -d postgres app
sleep 3
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
docker compose down
```

Expected: prints `200`.

- [ ] **Step 8: Commit**

```bash
git add Dockerfile .dockerignore docker-compose.yml public/.gitkeep
git commit -m "feat: add Docker and docker-compose deployment"
```

---

### Task 6: Route split and Tailnet-only admin gating

**Files:**
- Create: `src/middleware.ts`
- Test: `tests/middleware.test.ts`
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Create: `docs/deploy/tailscale.md`

**Interfaces:**
- Consumes: Next.js app shell (Task 1).
- Produces: `middleware(request: NextRequest): NextResponse` from `src/middleware.ts`, gating `/admin/:path*`. Route stubs at `/` (Task 1) and `/admin`. Later phases (Admin event management) add real pages under `src/app/admin/*`; the Attendee/RSVP phase adds pages under `src/app/` (public).

- [ ] **Step 1: Write the failing test**

`tests/middleware.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../src/middleware'

function makeRequest(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(path, 'https://example.ts.net'), { headers })
}

describe('admin gating middleware', () => {
  it('returns 404 for /admin requests without a Tailscale identity header', () => {
    const response = middleware(makeRequest('/admin'))
    expect(response.status).toBe(404)
  })

  it('allows /admin requests carrying a Tailscale identity header', () => {
    const response = middleware(
      makeRequest('/admin', { 'Tailscale-User-Login': 'oscar@github' })
    )
    expect(response.status).toBe(200)
  })

  it('does not gate public routes', () => {
    const response = middleware(makeRequest('/'))
    expect(response.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/middleware.test.ts`
Expected: FAIL — `src/middleware.ts` does not exist yet.

- [ ] **Step 3: Implement `src/middleware.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'

// When Tailscale serves this app to the Tailnet (`tailscale serve`), it
// attaches an identity header for the authenticated Tailnet user.
// Requests arriving through Tailscale Funnel (the public internet) never
// carry this header, since Funnel traffic has no Tailnet identity.
//
// The primary gate is deployment config: Funnel is only configured to
// forward public path prefixes (see docs/deploy/tailscale.md), so it
// should never reach /admin at all. This header check is defense in
// depth in case that config is ever wrong.
const TAILSCALE_IDENTITY_HEADER = 'Tailscale-User-Login'

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const identity = request.headers.get(TAILSCALE_IDENTITY_HEADER)
    if (!identity) {
      return new NextResponse('Not found', { status: 404 })
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/middleware.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Create the admin route stubs**

`src/app/admin/layout.tsx`:

```tsx
import type { ReactNode } from 'react'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <header>
        <h1>Open Party — Admin</h1>
      </header>
      {children}
    </div>
  )
}
```

`src/app/admin/page.tsx`:

```tsx
export default function AdminEventsPage() {
  return (
    <main>
      <h2>Events</h2>
      <p>No events yet.</p>
    </main>
  )
}
```

- [ ] **Step 6: Document the Tailscale Serve/Funnel configuration**

`docs/deploy/tailscale.md`:

```markdown
# Tailscale Serve / Funnel configuration

Run these on the homelab host after `docker compose up -d` has the `app`
container listening on `127.0.0.1:3000`. Flag names below match Tailscale's
serve/funnel CLI as of writing — confirm against `tailscale serve --help`
and `tailscale funnel --help` on your installed version before relying on
them, since this CLI has changed across Tailscale releases.

1. Serve the full app to your Tailnet only. This is what makes `/admin`
   reachable to you:

   ```
   tailscale serve --bg 3000
   ```

2. Expose ONLY the public routes to the internet via Funnel. Funnel needs
   an explicit allowlist of paths — do not funnel the whole port, or
   `/admin` becomes public:

   ```
   tailscale funnel --bg --set-path=/ 3000
   ```

   As the app grows, add one `--set-path` per public route prefix (e.g.
   `/e` for the RSVP pages added in a later phase). Never add `/admin`.

3. Verify:
   - From a device on your Tailnet: `https://<magicdns-name>.ts.net/admin`
     should load the admin stub page.
   - From a device off your Tailnet (e.g. phone on cellular data):
     `https://<magicdns-name>.ts.net/admin` should return "Not found",
     and `https://<magicdns-name>.ts.net/` should load the public stub
     page.
```

- [ ] **Step 7: Commit**

```bash
git add src/middleware.ts tests/middleware.test.ts src/app/admin docs/deploy/tailscale.md
git commit -m "feat: split public/admin routes with Tailnet-only admin gating"
```

---

## End-of-Phase Verification

- [ ] Run the full test suite: `npx vitest run` — expect all tests (env, schema, db client, middleware) to pass (dev/test Postgres containers must be running for the db client test: `docker compose --profile dev up -d postgres-test`).
- [ ] Run `npm run build` — expect success.
- [ ] Run the Task 5 Step 6 smoke test again — expect `200` from `http://127.0.0.1:3000/`.
- [ ] Confirm `git log --oneline` shows six commits, one per task, on top of the `plan.md` refinement commit.
