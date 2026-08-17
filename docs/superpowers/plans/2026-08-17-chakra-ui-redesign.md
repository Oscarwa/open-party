# Chakra UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Open Party a real, mobile-first visual design system across every page (admin and attendee), built on Chakra UI v3, with a fully custom-built dropdown replacing every native `<select>` — no browser default controls anywhere except the (intentionally kept native) date/time inputs.

**Architecture:** `@chakra-ui/react` v3 provides both the component library and the styling engine (no Tailwind). A client-only `Provider` component wraps `ChakraProvider` + `next-themes` around the whole app in the root layout; every page underneath stays a Server Component by default, since Chakra's components are client components internally but can still be rendered as ordinary children of a Server Component. The one new interactive primitive this phase introduces is `FormSelect` — a custom-built listbox (Chakra's `Select`, built on Ark UI) that renders a real hidden `<select>` (`Select.HiddenSelect`) synced to the current selection, so every existing `<form action={serverAction}>` + `FormData` pattern keeps working unchanged. No Server Action signatures change in this phase.

**Tech Stack:** `@chakra-ui/react` ^3.36.1, `@emotion/react` ^11.14.0, `next-themes` ^0.4.6 (runtime); `@testing-library/react` ^16.3.2, `@testing-library/user-event` ^14.6.4, `jsdom` ^30.0.1, `@vitejs/plugin-react` ^6.0.5 (dev, for `FormSelect`'s component tests only).

## Global Constraints

- Chakra UI v3 only — no Tailwind, no second styling system.
- No dark mode this phase — the `Provider` locks color mode to light via `forcedTheme="light"`. `next-themes` is still wired in (Chakra's documented standard setup) so enabling dark mode later is a one-line change, not a restructure.
- No confirmation dialogs for destructive admin actions (delete food option, remove invitee, etc.) — those stay a single click, just restyled.
- No custom date/time picker — `<input type="date">`/`type="time"` stay native elements, restyled only for their closed-state appearance (border, focus ring, sizing). Their native calendar/clock popups are untouched.
- No change to business logic, Server Actions, database schema, or session/auth handling. This phase is scoped to `src/app/**/page.tsx`, `src/app/**/layout.tsx`, `src/app/**/error.tsx`, `src/components/**`, `src/theme.ts`, `vitest.config.ts`, and `package.json`. Every existing test in `tests/lib/**` and `tests/middleware.test.ts` must keep passing completely unmodified.
- `FormSelect` (`src/components/FormSelect.tsx`) is the sole new interactive/client-side primitive this phase introduces — every page stays a Server Component; only `Provider` and `FormSelect` (and any component that composes them) carry `'use client'`.
- This project has no ESLint config — apostrophes and other characters in JSX text do not need HTML-entity escaping (`&apos;` etc.); write plain text.
- Chakra's style-prop token names (`colorPalette`, `size`, spacing numbers, semantic color tokens like `fg.muted`) are type-checked by `npm run build`. If a specific token or prop name in this plan doesn't match what the installed `@chakra-ui/react` version's types accept, fix it using the installed types/editor autocomplete as the source of truth and note the substitution in your task report — this is an expected, normal adjustment, not a plan defect to escalate.
- Every restyled page must remain reachable and functionally identical from the URL/routing perspective — no path, param, or redirect-target changes anywhere in this phase.

---

### Task 1: Chakra UI v3 setup — dependencies, theme, provider, root layout

**Files:**
- Modify: `package.json`
- Create: `src/theme.ts`
- Create: `src/components/Provider.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `system` (a Chakra `System` instance) exported from `src/theme.ts`, consumed by `src/components/Provider.tsx` and by Task 2's `FormSelect` test file. `Provider` (a `'use client'` component wrapping `{children}`) exported from `src/components/Provider.tsx`, consumed by `src/app/layout.tsx`. No other task depends on anything else from this task.

This task has no automated tests — it's pure setup/config with no independently-testable business logic, consistent with how prior phases treated setup-only tasks. Verification is `npm run build` plus a manual runtime smoke check.

- [ ] **Step 1: Add the runtime dependencies**

Edit `package.json`'s `"dependencies"` block, adding these three (alphabetized among the existing entries):

```json
    "@chakra-ui/react": "^3.36.1",
    "@emotion/react": "^11.14.0",
```

right after `"dependencies": {` (before `"drizzle-orm"`, since `@chakra-ui` < `@emotion` < `drizzle-orm` alphabetically), and:

```json
    "next-themes": "^0.4.6",
```

after `"next"` (before `"postgres"`). The full `"dependencies"` block becomes:

```json
  "dependencies": {
    "@chakra-ui/react": "^3.36.1",
    "@emotion/react": "^11.14.0",
    "drizzle-orm": "^0.45.2",
    "next": "^15.0.0",
    "next-themes": "^0.4.6",
    "postgres": "^3.4.9",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^4.4.3"
  },
```

Run: `npm install`
Expected: installs successfully, `package-lock.json` updates.

- [ ] **Step 2: Create the theme**

Create `src/theme.ts`:

```ts
import { createSystem, defaultConfig } from '@chakra-ui/react'

// No custom tokens for this phase — Chakra's defaults (the numeric
// spacing scale, typography, color palettes, and the mobile-first
// breakpoints base/sm/md/lg/xl) are used as-is. App-wide visual
// consistency comes from convention, not custom tokens: primary actions
// use colorPalette="orange" (the default baked into the shared Button
// wrapper, src/components/Button.tsx) instead of Chakra's default gray,
// so the app reads as intentionally designed without the added surface
// area — and token-name risk — of a hand-rolled color palette.
export const system = createSystem(defaultConfig)
```

- [ ] **Step 3: Create the provider**

Create `src/components/Provider.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'
import { ChakraProvider } from '@chakra-ui/react'
import { ThemeProvider } from 'next-themes'
import { system } from '@/theme'

// next-themes is Chakra's documented color-mode provider, required even
// though this phase ships light mode only — forcedTheme locks it there.
// Wiring it in now means enabling dark mode later is a one-line change
// (drop forcedTheme), not a restructure of this file.
export function Provider({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider value={system}>
      <ThemeProvider attribute="class" forcedTheme="light" disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </ChakraProvider>
  )
}
```

- [ ] **Step 4: Wire the provider into the root layout**

Replace the full contents of `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Provider } from '@/components/Provider'

export const metadata: Metadata = {
  title: 'Open Party',
  description: 'Organize recurring gatherings with friends and family.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  )
}
```

`suppressHydrationWarning` on `<html>` is required by `next-themes` (it sets a `class`/`style` attribute on the client before hydration completes) — its absence produces a harmless but noisy console hydration warning on every page load.

- [ ] **Step 5: Verify**

Run: `npm run build`
Expected: succeeds. No page's visual output changes yet (no page has been restyled) — this step only proves the provider mounts without error.

Run: `docker compose --profile dev up -d postgres` (if not already up), `npm run dev &`. Visit `http://localhost:3000/`. Expected: the page renders exactly as before (plain text, no styling change), no errors in the browser console, and the page's `<head>` contains an injected Emotion `<style>` tag (confirms Chakra's styling engine is actually mounted, not just present in the bundle). Stop the dev server (`kill %1`) when done.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/theme.ts src/components/Provider.tsx src/app/layout.tsx
git commit -m "feat: install and wire up Chakra UI v3"
```

---

### Task 2: Shared component library — Button, PageShell, FieldGroup, FormSelect

**Files:**
- Create: `src/components/Button.tsx`
- Create: `src/components/PageShell.tsx`
- Create: `src/components/FieldGroup.tsx`
- Create: `src/components/FormSelect.tsx`
- Test: `tests/components/FormSelect.test.tsx`
- Modify: `vitest.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `system` (Task 1, for the test file's `ChakraProvider`).
- Produces:
  - `Button(props: ButtonProps)` from `src/components/Button.tsx` — thin wrapper over Chakra's `Button`, `colorPalette="orange"` by default (overridable via props).
  - `PageShell({ title: string, children: ReactNode })` from `src/components/PageShell.tsx` — the page container + heading pattern every page uses.
  - `FieldGroup({ label: string, htmlFor: string, error?: string, children: ReactNode })` from `src/components/FieldGroup.tsx` — label + control + error-message layout.
  - `FormSelect({ id?: string, name: string, placeholder: string, defaultValue?: string, required?: boolean, options: FormSelectOption[] })` and the exported type `FormSelectOption = { value: string, label: string, disabled?: boolean }` from `src/components/FormSelect.tsx` — the custom dropdown. Every task from Task 3 onward that renders a dropdown imports this component and passes it plain `{ value, label }` objects built from the page's own data.

This is the first task with automated tests in this phase — `FormSelect` is genuinely new interactive logic (every other component here is a presentational wrapper). Follow TDD.

- [ ] **Step 1: Add the test tooling dependencies**

Edit `package.json`'s `"devDependencies"` block, adding these four (alphabetized among the existing entries):

```json
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.4",
```

after `"@types/react-dom"` (before `"drizzle-kit"`), and:

```json
    "jsdom": "^30.0.1",
```

after `"drizzle-kit"` (before `"tsx"`), and:

```json
    "@vitejs/plugin-react": "^6.0.5",
```

as the very first entry (before `"@types/node"`, alphabetically first). The full `"devDependencies"` block becomes:

```json
  "devDependencies": {
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.4",
    "@types/node": "^20.14.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^6.0.5",
    "drizzle-kit": "^0.31.10",
    "jsdom": "^30.0.1",
    "tsx": "^4.23.12",
    "typescript": "^5.6.0",
    "vitest": "^4.1.10"
  },
```

Run: `npm install`
Expected: installs successfully.

- [ ] **Step 2: Add the React plugin to vitest**

Replace the full contents of `vitest.config.ts`:

```ts
import { defineConfig, configDefaults } from 'vitest/config'
import path from 'node:path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Needed for the one .tsx test file in this suite (FormSelect's
  // component tests). A no-op for every existing .ts test file — this
  // plugin only transforms .jsx/.tsx.
  plugins: [react()],
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
    // Exclude nested git worktrees living inside this checkout (this repo
    // is used with a harness that places worktrees under .claude/worktrees/
    // or .worktrees/). Without this, running the suite from a checkout that
    // has one of those directories present picks up every test file twice
    // — once here, once from the nested copy — and two copies of
    // tests/db/client.test.ts race each other's migrate() call against the
    // same database.
    exclude: [...configDefaults.exclude, '.claude/**', '.worktrees/**', 'worktrees/**'],
    // Vitest does not read .env files into process.env, so modules that
    // validate the environment at import time (src/db/client.ts via
    // loadEnv()) need these here. Deterministic, checked-in defaults keep
    // the suite independent of any developer's local .env; a real shell
    // variable still wins.
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgres://open_party:open_party@localhost:55432/open_party_test',
      WAHA_URL: process.env.WAHA_URL ?? 'http://localhost:3001',
      WAHA_SESSION: process.env.WAHA_SESSION ?? 'default',
      SESSION_SECRET:
        process.env.SESSION_SECRET ?? 'test-session-secret-at-least-32-chars',
      ADMIN_PASSWORD:
        process.env.ADMIN_PASSWORD ?? 'test-admin-password-12-plus-chars',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

The global `test.environment` stays `'node'` (every DB-integration test needs Node's real APIs, not a DOM) — `FormSelect.test.tsx` opts into jsdom itself via a per-file pragma in Step 3.

- [ ] **Step 3: Write the failing tests for FormSelect**

Create `tests/components/FormSelect.test.tsx`:

```tsx
// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from '../../src/theme'
import { FormSelect } from '../../src/components/FormSelect'

function renderWithChakra(ui: ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>)
}

describe('FormSelect', () => {
  it('renders a hidden select with the given name and no initial value', () => {
    const { container } = renderWithChakra(
      <FormSelect
        name="foodChoice1"
        placeholder="Pick one"
        options={[
          { value: 'a', label: 'Tacos' },
          { value: 'b', label: 'Pizza' },
        ]}
      />,
    )
    const hiddenSelect = container.querySelector(
      'select[name="foodChoice1"]',
    ) as HTMLSelectElement
    expect(hiddenSelect).not.toBeNull()
    expect(hiddenSelect.value).toBe('')
  })

  it('respects defaultValue for uncontrolled initial selection', () => {
    const { container } = renderWithChakra(
      <FormSelect
        name="foodChoice1"
        placeholder="Pick one"
        defaultValue="b"
        options={[
          { value: 'a', label: 'Tacos' },
          { value: 'b', label: 'Pizza' },
        ]}
      />,
    )
    const hiddenSelect = container.querySelector(
      'select[name="foodChoice1"]',
    ) as HTMLSelectElement
    expect(hiddenSelect.value).toBe('b')
    expect(screen.getByText('Pizza')).toBeTruthy()
  })

  it('updates the hidden select value when an option is chosen', async () => {
    const user = userEvent.setup()
    const { container } = renderWithChakra(
      <FormSelect
        name="foodChoice1"
        placeholder="Pick one"
        options={[
          { value: 'a', label: 'Tacos' },
          { value: 'b', label: 'Pizza' },
        ]}
      />,
    )
    await user.click(screen.getByText('Pick one'))
    await user.click(await screen.findByText('Pizza'))
    const hiddenSelect = container.querySelector(
      'select[name="foodChoice1"]',
    ) as HTMLSelectElement
    expect(hiddenSelect.value).toBe('b')
  })

  it('does not allow selecting a disabled option', async () => {
    const user = userEvent.setup()
    const { container } = renderWithChakra(
      <FormSelect
        name="bringItemId"
        placeholder="Nothing"
        options={[
          { value: 'a', label: 'Drinks' },
          { value: 'b', label: 'Chips (already claimed)', disabled: true },
        ]}
      />,
    )
    await user.click(screen.getByText('Nothing'))
    await user.click(await screen.findByText('Chips (already claimed)'))
    const hiddenSelect = container.querySelector(
      'select[name="bringItemId"]',
    ) as HTMLSelectElement
    expect(hiddenSelect.value).toBe('')
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run tests/components/FormSelect.test.tsx`
Expected: FAIL — `src/components/FormSelect.tsx` does not exist yet.

- [ ] **Step 5: Implement FormSelect**

Create `src/components/FormSelect.tsx`:

```tsx
'use client'

import { Select, createListCollection } from '@chakra-ui/react'

export type FormSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

// The one custom-built interactive control in this app — no native
// <select> dropdown anywhere. Select.HiddenSelect renders a real,
// synced-to-selection native <select> under the hood, so this drops
// into any existing <form action={serverAction}> in place of a plain
// <select name="..." defaultValue="..."> with no change to the
// surrounding form or the Server Action reading its FormData.
export function FormSelect({
  id,
  name,
  placeholder,
  defaultValue,
  required,
  options,
}: {
  id?: string
  name: string
  placeholder: string
  defaultValue?: string
  required?: boolean
  options: FormSelectOption[]
}) {
  const collection = createListCollection({ items: options })

  return (
    <Select.Root
      collection={collection}
      name={name}
      required={required}
      defaultValue={defaultValue ? [defaultValue] : []}
    >
      <Select.HiddenSelect id={id} />
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText placeholder={placeholder} />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Select.Positioner>
        <Select.Content>
          {collection.items.map((item) => (
            <Select.Item key={item.value} item={item} disabled={item.disabled}>
              {item.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Positioner>
    </Select.Root>
  )
}
```

If `Select.Item`'s `disabled` prop doesn't compile or doesn't actually block selection at runtime (check against the 4th test above), the documented fallback is: don't disable the item — instead have the calling page filter it out of `options` entirely before passing them to `FormSelect` (the "already claimed" item simply won't appear as a choice, rather than appearing grayed out). If you need this fallback, note it in your report; it changes Task 3's bring-item select slightly (filter instead of disable-in-place).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/components/FormSelect.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 7: Implement the remaining shared components**

Create `src/components/Button.tsx`:

```tsx
import { Button as ChakraButton, type ButtonProps } from '@chakra-ui/react'

// Thin re-export so every page imports the app's Button from one place —
// a future style change (default color palette, size, variant) is one
// file, not a grep across every page that renders a button.
export function Button(props: ButtonProps) {
  return <ChakraButton colorPalette="orange" {...props} />
}
```

Create `src/components/PageShell.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Box, Heading, Stack } from '@chakra-ui/react'

export function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box as="main" maxW="42rem" mx="auto" px={{ base: 4, md: 6 }} py={{ base: 6, md: 10 }}>
      <Stack gap={{ base: 6, md: 8 }}>
        <Heading as="h1" size={{ base: 'xl', md: '2xl' }}>
          {title}
        </Heading>
        {children}
      </Stack>
    </Box>
  )
}
```

Create `src/components/FieldGroup.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Field } from '@chakra-ui/react'

export function FieldGroup({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  children: ReactNode
}) {
  return (
    <Field.Root invalid={Boolean(error)}>
      <Field.Label htmlFor={htmlFor}>{label}</Field.Label>
      {children}
      {error ? <Field.ErrorText>{error}</Field.ErrorText> : null}
    </Field.Root>
  )
}
```

- [ ] **Step 8: Run the full suite and build**

Run: `docker compose --profile dev up -d postgres-test` (if not already up), `npx vitest run`
Expected: all files pass — the 90 existing tests plus the 4 new `FormSelect` tests (94 total).

Run: `npm run build`
Expected: succeeds. `Button`, `PageShell`, and `FieldGroup` aren't consumed by any page yet — an unused-export is not a build error, so this just confirms they type-check.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/components/FormSelect.tsx tests/components/FormSelect.test.tsx src/components/Button.tsx src/components/PageShell.tsx src/components/FieldGroup.tsx
git commit -m "feat: shared Chakra component library (Button, PageShell, FieldGroup, FormSelect)"
```

---

### Task 3: Restyle the attendee RSVP page

**Files:**
- Modify: `src/app/events/[eventId]/page.tsx`

**Interfaces:**
- Consumes: `PageShell`, `FieldGroup`, `FormSelect`, `Button` (Task 2). No changes to `getInviteeForUserAndEvent`, `getEvent`, `getFoodOptions`, `getActivityOptions`, `getBringItems`, `getClaimedBringItemIds`, `declineAction`, `submitRsvpAction` — all consumed exactly as before.
- Produces: nothing new for later tasks — this is a leaf page.

This is the highest-value proving ground for `FormSelect`: 6 of the app's 8 dropdowns live here (`foodChoice1/2/3`, `activityChoice1/2/3`, `bringItemId`), alongside the bring-item "already claimed" disabling behavior `FormSelect`'s 4th test exercises. No dedicated automated test for the page itself — verified manually, consistent with every prior phase's page-level UI (there's no UI test tooling beyond the `FormSelect` component tests from Task 2).

- [ ] **Step 1: Replace the page**

Replace the full contents of `src/app/events/[eventId]/page.tsx`:

```tsx
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { Box, Heading, Input, Stack, Text } from '@chakra-ui/react'
import { loadEnv } from '@/lib/env'
import { ATTENDEE_SESSION_COOKIE_NAME, verifyAttendeeSessionToken } from '@/lib/attendeeSession'
import { getInviteeForUserAndEvent } from '@/lib/rsvp'
import { getEvent, getFoodOptions, getActivityOptions, getBringItems } from '@/lib/queries/events'
import { getClaimedBringItemIds } from '@/lib/queries/rsvp'
import { declineAction, submitRsvpAction } from '@/lib/actions/rsvp'
import { PageShell } from '@/components/PageShell'
import { FieldGroup } from '@/components/FieldGroup'
import { FormSelect } from '@/components/FormSelect'
import { Button } from '@/components/Button'

export default async function EventRsvpPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get(ATTENDEE_SESSION_COOKIE_NAME)?.value
  const env = loadEnv()
  const userId = token ? await verifyAttendeeSessionToken(token, env.SESSION_SECRET) : null
  // Middleware already redirects unsessioned requests away from /events/*
  // — this is the same page-level defense-in-depth pattern the admin event
  // detail page uses beyond its own middleware gate.
  if (!userId) notFound()

  const invitee = await getInviteeForUserAndEvent(userId, eventId)
  if (!invitee) notFound()

  const event = await getEvent(eventId)
  if (!event) notFound()

  const [foodOptions, activityOptions, bringItems] = await Promise.all([
    getFoodOptions(eventId),
    getActivityOptions(eventId),
    getBringItems(eventId),
  ])

  if (event.status !== 'published') {
    return (
      <PageShell title={event.title}>
        <Text color="fg.muted">
          {event.date} {event.startTime}
        </Text>
        <Stack gap={2}>
          <Text>
            Final food: {foodOptions.find((o) => o.id === event.finalFoodOptionId)?.name ?? '—'}
          </Text>
          <Text>
            Final activity:{' '}
            {activityOptions.find((o) => o.id === event.finalActivityOptionId)?.name ?? '—'}
          </Text>
          <Text>
            You&apos;re bringing:{' '}
            {bringItems.find((i) => i.id === invitee.bringItemId)?.name ?? 'nothing selected'}
          </Text>
        </Stack>
      </PageShell>
    )
  }

  const claimedBringItemIds = await getClaimedBringItemIds(eventId, invitee.id)

  const foodSelectOptions = foodOptions
    .filter((option) => !option.disabled)
    .map((option) => ({ value: option.id, label: option.name }))

  const activitySelectOptions = activityOptions.map((option) => ({
    value: option.id,
    label: option.name,
  }))

  const bringItemSelectOptions = bringItems.map((item) => {
    const claimedByOther = claimedBringItemIds.has(item.id) && item.id !== invitee.bringItemId
    return {
      value: item.id,
      label: claimedByOther ? `${item.name} (already claimed)` : item.name,
      disabled: claimedByOther,
    }
  })

  return (
    <PageShell title={event.title}>
      <Text color="fg.muted">
        {event.date} {event.startTime}
      </Text>
      {event.description ? <Text>{event.description}</Text> : null}
      <Text fontWeight="medium">Your current RSVP: {invitee.rsvpStatus}</Text>

      <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
        <Heading as="h2" size="lg" mb={4}>
          Yes, I&apos;ll be there
        </Heading>
        <form action={submitRsvpAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <Stack gap={5}>
            <Heading as="h3" size="md">
              Food (pick up to 3, ranked)
            </Heading>
            {(['foodChoice1', 'foodChoice2', 'foodChoice3'] as const).map((field, index) => (
              <FieldGroup key={field} label={`${index + 1}. choice`} htmlFor={field}>
                <FormSelect
                  id={field}
                  name={field}
                  placeholder="No preference"
                  defaultValue={invitee[field] ?? undefined}
                  options={foodSelectOptions}
                />
              </FieldGroup>
            ))}

            <Heading as="h3" size="md">
              Activity (pick up to 3, ranked)
            </Heading>
            {(['activityChoice1', 'activityChoice2', 'activityChoice3'] as const).map(
              (field, index) => (
                <FieldGroup key={field} label={`${index + 1}. choice`} htmlFor={field}>
                  <FormSelect
                    id={field}
                    name={field}
                    placeholder="No preference"
                    defaultValue={invitee[field] ?? undefined}
                    options={activitySelectOptions}
                  />
                </FieldGroup>
              ),
            )}

            <FieldGroup label="What will you bring?" htmlFor="bringItemId">
              <FormSelect
                id="bringItemId"
                name="bringItemId"
                placeholder="Nothing"
                defaultValue={invitee.bringItemId ?? undefined}
                options={bringItemSelectOptions}
              />
            </FieldGroup>

            <Button type="submit" alignSelf="flex-start">
              Confirm RSVP
            </Button>
          </Stack>
        </form>
      </Box>

      <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
        <Heading as="h2" size="lg" mb={4}>
          I can&apos;t make it
        </Heading>
        <form action={declineAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <Stack gap={4}>
            <FieldGroup label="Reason (optional)" htmlFor="declineReason">
              <Input
                id="declineReason"
                name="declineReason"
                defaultValue={invitee.declineReason ?? ''}
              />
            </FieldGroup>
            <Button type="submit" variant="outline" alignSelf="flex-start">
              Decline
            </Button>
          </Stack>
        </form>
      </Box>
    </PageShell>
  )
}
```

- [ ] **Step 2: Verify manually, end to end**

Run: `npm run build`
Expected: succeeds.

Run: `docker compose --profile dev up -d postgres`, `npm run dev &`. Using the admin dashboard (already working from Phase 2/3), publish an event with a food option, an activity option, a bring item, and an invitee; open the invitee's `/e/{token}` link. Confirm:
- The page renders with the new styling, no native `<select>` popup appears anywhere — clicking a dropdown shows Chakra's custom listbox.
- Selecting a food/activity choice and submitting persists correctly (reload the page, the selection is still shown).
- Claiming a bring item works; open the same event's RSVP page in a second browser session (or a private window, faking a second invitee via their own link) and confirm the claimed item shows "(already claimed)" and cannot be selected.
- The decline form still works independently of the RSVP form.
- Resize the browser to a narrow (mobile) width — confirm the layout reflows sensibly (no horizontal scrolling, buttons/selects stay usable).

Stop the dev server (`kill %1`) when done.

- [ ] **Step 3: Commit**

```bash
git add src/app/events/\[eventId\]/page.tsx
git commit -m "style: restyle the attendee RSVP page with Chakra UI"
```

---

### Task 4: Restyle the admin login page

**Files:**
- Modify: `src/app/admin/login/page.tsx`

**Interfaces:**
- Consumes: `PageShell`, `FieldGroup`, `Button` (Task 2). No changes to `loginAction`.
- Produces: nothing new for later tasks.

The second smoke test for the design system — simplest form in the app, good confirmation that `Provider`/theme wiring works correctly outside the `/events/*` tree too.

- [ ] **Step 1: Replace the page**

Replace the full contents of `src/app/admin/login/page.tsx`:

```tsx
import { Alert, Input, Stack } from '@chakra-ui/react'
import { loginAction } from '@/lib/actions/auth'
import { PageShell } from '@/components/PageShell'
import { FieldGroup } from '@/components/FieldGroup'
import { Button } from '@/components/Button'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const errorMessage =
    error === 'invalid_password'
      ? 'Incorrect password.'
      : error === 'rate_limited'
        ? 'Too many attempts. Try again in a few minutes.'
        : null

  return (
    <PageShell title="Admin Login">
      {errorMessage ? (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{errorMessage}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      ) : null}
      <form action={loginAction}>
        <Stack gap={5}>
          <FieldGroup label="Password" htmlFor="password">
            <Input id="password" name="password" type="password" required />
          </FieldGroup>
          <Button type="submit" alignSelf="flex-start">
            Log in
          </Button>
        </Stack>
      </form>
    </PageShell>
  )
}
```

- [ ] **Step 2: Verify manually**

Run: `npm run build` — expect success.

Run: `docker compose --profile dev up -d postgres`, `npm run dev &`. Visit `/admin/login`. Confirm: the page renders styled, submitting the wrong password shows the red error alert with "Incorrect password.", submitting the correct `ADMIN_PASSWORD` (from your `.env`) logs in and redirects to `/admin`. Stop the dev server (`kill %1`) when done.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/login/page.tsx
git commit -m "style: restyle the admin login page with Chakra UI"
```

---

### Task 5: Restyle My Events and link-invalid

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/link-invalid/page.tsx`

**Interfaces:**
- Consumes: `PageShell` (Task 2). No changes to `listMyEvents`, `verifyAttendeeSessionToken`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Replace the My Events page**

Replace the full contents of `src/app/page.tsx`:

```tsx
import NextLink from 'next/link'
import { cookies } from 'next/headers'
import { Link as ChakraLink, Stack, Text } from '@chakra-ui/react'
import { loadEnv } from '@/lib/env'
import { ATTENDEE_SESSION_COOKIE_NAME, verifyAttendeeSessionToken } from '@/lib/attendeeSession'
import { listMyEvents } from '@/lib/queries/rsvp'
import { PageShell } from '@/components/PageShell'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ATTENDEE_SESSION_COOKIE_NAME)?.value
  const env = loadEnv()
  const userId = token ? await verifyAttendeeSessionToken(token, env.SESSION_SECRET) : null

  if (!userId) {
    return (
      <PageShell title="Open Party">
        <Text color="fg.muted">My Events will appear here once you open an invitation link.</Text>
      </PageShell>
    )
  }

  const myEvents = await listMyEvents(userId)

  return (
    <PageShell title="My Events">
      {myEvents.length === 0 ? (
        <Text color="fg.muted">You don&apos;t have any events yet.</Text>
      ) : (
        <Stack gap={4}>
          {myEvents.map((event) => (
            <Stack key={event.eventId} gap={1} borderWidth="1px" borderRadius="lg" p={4}>
              <ChakraLink asChild fontWeight="semibold">
                <NextLink href={`/events/${event.eventId}`}>{event.title}</NextLink>
              </ChakraLink>
              <Text color="fg.muted" fontSize="sm">
                {event.date} {event.startTime} · {event.status} · you: {event.rsvpStatus}
              </Text>
            </Stack>
          ))}
        </Stack>
      )}
    </PageShell>
  )
}
```

- [ ] **Step 2: Replace the link-invalid page**

Replace the full contents of `src/app/link-invalid/page.tsx`:

```tsx
import { Text } from '@chakra-ui/react'
import { PageShell } from '@/components/PageShell'

export default function LinkInvalidPage() {
  return (
    <PageShell title="This link isn't valid anymore">
      <Text color="fg.muted">
        It may have expired, or the address may be mistyped. Ask the organizer to resend your
        invitation.
      </Text>
    </PageShell>
  )
}
```

- [ ] **Step 3: Verify manually**

Run: `npm run build` — expect success, confirm `/` is still listed as dynamic (`ƒ`).

Run: `docker compose --profile dev up -d postgres`, `npm run dev &`. Visit `/` with no session cookie (placeholder copy shows, styled), then with a valid attendee session from Task 3's testing (My Events list shows, styled, links work). Visit `/link-invalid` directly and via `/e/some-bogus-token` (confirm the redirect still lands here, styled). Stop the dev server (`kill %1`) when done.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/link-invalid/page.tsx
git commit -m "style: restyle My Events and link-invalid with Chakra UI"
```

---

### Task 6: Restyle the admin dashboard, gated layout chrome, and event-create page

**Files:**
- Modify: `src/app/admin/(gated)/layout.tsx`
- Modify: `src/app/admin/(gated)/page.tsx`
- Modify: `src/app/admin/(gated)/events/new/page.tsx`

**Interfaces:**
- Consumes: `PageShell`, `FieldGroup`, `Button` (Task 2). No changes to `logoutAction`, `listEvents`, `createEventAction`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Replace the gated admin layout (header + logout chrome)**

Replace the full contents of `src/app/admin/(gated)/layout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Box, Heading, HStack } from '@chakra-ui/react'
import { logoutAction } from '@/lib/actions/auth'
import { Button } from '@/components/Button'

// Layout for the gated admin routes only. Every route under this `(gated)`
// route group is behind src/middleware.ts's session check, so admin-only
// chrome and state-mutating Server Actions belong here — never in the outer
// `src/app/admin/layout.tsx`, which also wraps the unauthenticated
// `/admin/login` page.
//
// The `(gated)` parentheses make this an organizational group: it does not
// appear in any URL. `(gated)/page.tsx` still serves `/admin`,
// `(gated)/events/new/page.tsx` still serves `/admin/events/new`.
export default function GatedAdminLayout({ children }: { children: ReactNode }) {
  return (
    <Box>
      <HStack
        as="header"
        justify="space-between"
        px={{ base: 4, md: 6 }}
        py={4}
        borderBottomWidth="1px"
      >
        <Heading as="h1" size="md">
          Open Party — Admin
        </Heading>
        <form action={logoutAction}>
          <Button type="submit" size="sm" variant="outline">
            Log out
          </Button>
        </form>
      </HStack>
      {children}
    </Box>
  )
}
```

- [ ] **Step 2: Replace the admin dashboard**

Replace the full contents of `src/app/admin/(gated)/page.tsx`:

```tsx
import NextLink from 'next/link'
import { Link as ChakraLink, Stack, Text } from '@chakra-ui/react'
import { listEvents } from '@/lib/queries/events'
import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/Button'

// Without this, Next.js statically prerenders this page at build time
// (nothing here uses a dynamic API like cookies()/headers()/searchParams
// that would otherwise force per-request rendering) — the events list
// would freeze at whatever was in the database during `docker build` and
// never update in the deployed app until the next image rebuild.
export const dynamic = 'force-dynamic'

export default async function AdminEventsPage() {
  const events = await listEvents()

  return (
    <PageShell title="Events">
      <Button asChild alignSelf="flex-start">
        <NextLink href="/admin/events/new">New Event</NextLink>
      </Button>
      {events.length === 0 ? (
        <Text color="fg.muted">No events yet.</Text>
      ) : (
        <Stack gap={4}>
          {events.map((event) => (
            <Stack key={event.id} gap={1} borderWidth="1px" borderRadius="lg" p={4}>
              <ChakraLink asChild fontWeight="semibold">
                <NextLink href={`/admin/events/${event.id}`}>{event.title}</NextLink>
              </ChakraLink>
              <Text color="fg.muted" fontSize="sm">
                {event.date} {event.startTime} · {event.status}
              </Text>
            </Stack>
          ))}
        </Stack>
      )}
    </PageShell>
  )
}
```

- [ ] **Step 3: Replace the event-create page**

Replace the full contents of `src/app/admin/(gated)/events/new/page.tsx`:

```tsx
import { Input, Stack, Textarea } from '@chakra-ui/react'
import { createEventAction } from '@/lib/actions/events'
import { PageShell } from '@/components/PageShell'
import { FieldGroup } from '@/components/FieldGroup'
import { Button } from '@/components/Button'

export default function NewEventPage() {
  return (
    <PageShell title="New Event">
      <form action={createEventAction}>
        <Stack gap={5}>
          <FieldGroup label="Title" htmlFor="title">
            <Input id="title" name="title" required />
          </FieldGroup>
          <FieldGroup label="Date" htmlFor="date">
            <Input id="date" name="date" type="date" required />
          </FieldGroup>
          <FieldGroup label="Start time" htmlFor="startTime">
            <Input id="startTime" name="startTime" type="time" required />
          </FieldGroup>
          <FieldGroup label="Description (optional)" htmlFor="description">
            <Textarea id="description" name="description" />
          </FieldGroup>
          <Button type="submit" alignSelf="flex-start">
            Create Event
          </Button>
        </Stack>
      </form>
    </PageShell>
  )
}
```

- [ ] **Step 4: Verify manually**

Run: `npm run build` — expect success.

Run: `docker compose --profile dev up -d postgres`, `npm run dev &`. Log into `/admin`. Confirm: the header/logout chrome is styled and logout still works; the dashboard lists events (styled) with a working "New Event" button; the event-create form (styled, native date/time inputs restyled but still native) creates an event successfully. Stop the dev server (`kill %1`) when done.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/\(gated\)/layout.tsx src/app/admin/\(gated\)/page.tsx src/app/admin/\(gated\)/events/new/page.tsx
git commit -m "style: restyle the admin dashboard, chrome, and event-create page with Chakra UI"
```

---

### Task 7: Restyle the admin event-detail page

**Files:**
- Modify: `src/app/admin/(gated)/events/[id]/page.tsx`

**Interfaces:**
- Consumes: `PageShell`, `FormSelect`, `Button` (Task 2). No changes to `getEvent`, `getFoodOptions`, `getActivityOptions`, `getBringItems`, `getInvitees`, `getRsvpCounts`, `getVotingResults`, `addFoodOptionAction`, `toggleFoodOptionDisabledAction`, `deleteFoodOptionAction`, `addActivityOptionAction`, `deleteActivityOptionAction`, `addBringItemAction`, `deleteBringItemAction`, `addInviteeAction`, `removeInviteeAction`, `publishEventAction`, `finalizeEventAction`.
- Produces: nothing new for later tasks — this is the last page-restyle task.

The largest and busiest page in the app: many small inline forms (toggle/delete/remove buttons per row) restructured as `HStack` rows instead of the old `style={{ display: 'inline' }}` hack, three data tables using Chakra's `Table`, and the final 2 of the app's 8 `FormSelect` usages (the finalize form's food/activity picks).

- [ ] **Step 1: Replace the page**

Replace the full contents of `src/app/admin/(gated)/events/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { Box, Heading, HStack, Input, Stack, Table, Text } from '@chakra-ui/react'
import {
  getEvent,
  getFoodOptions,
  getActivityOptions,
  getBringItems,
  getInvitees,
  getRsvpCounts,
  getVotingResults,
} from '@/lib/queries/events'
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
  publishEventAction,
  finalizeEventAction,
} from '@/lib/actions/events'
import { PageShell } from '@/components/PageShell'
import { FormSelect } from '@/components/FormSelect'
import { Button } from '@/components/Button'

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // `events.id` is a uuid column: handing Postgres a non-uuid string makes
  // the query itself throw ("invalid input syntax for type uuid") before
  // getEvent() can return null, which would surface as a 500 instead of a
  // 404. Shape-check first so a malformed URL is just "not found".
  //
  // z.guid(), not z.uuid(): zod 4's uuid() also enforces the RFC version
  // and variant bits, which would 404 a row whose id is accepted by
  // Postgres but not RFC-conformant. All this guard needs is the 8-4-4-4-12
  // hex shape that makes the cast safe.
  if (!z.guid().safeParse(id).success) {
    notFound()
  }

  const event = await getEvent(id)

  if (!event) {
    notFound()
  }

  const isDraft = event.status === 'draft'
  const [foodOptions, activityOptions, bringItems, invitees] = await Promise.all([
    getFoodOptions(id),
    getActivityOptions(id),
    getBringItems(id),
    getInvitees(id),
  ])

  const [rsvpCounts, votingResults] = isDraft
    ? [null, null]
    : await Promise.all([getRsvpCounts(id), getVotingResults(id)])

  return (
    <PageShell title={event.title}>
      <Text color="fg.muted">
        {event.date} {event.startTime} · {event.status}
      </Text>
      {event.description ? <Text>{event.description}</Text> : null}

      <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
        <Heading as="h3" size="md" mb={3}>
          Food
        </Heading>
        <Stack gap={2} mb={4}>
          {foodOptions.map((option) => (
            <HStack key={option.id} justify="space-between" wrap="wrap" gap={2}>
              <Text>
                {option.name} {option.disabled ? '(disabled)' : ''}
              </Text>
              <HStack gap={2}>
                <form action={toggleFoodOptionDisabledAction}>
                  <input type="hidden" name="id" value={option.id} />
                  <Button type="submit" size="sm" variant="outline">
                    {option.disabled ? 'Enable' : 'Disable'}
                  </Button>
                </form>
                {isDraft ? (
                  <form action={deleteFoodOptionAction}>
                    <input type="hidden" name="id" value={option.id} />
                    <input type="hidden" name="eventId" value={event.id} />
                    <Button type="submit" size="sm" variant="outline" colorPalette="red">
                      Delete
                    </Button>
                  </form>
                ) : null}
              </HStack>
            </HStack>
          ))}
        </Stack>
        {isDraft ? (
          <form action={addFoodOptionAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <HStack gap={2}>
              <Input name="name" placeholder="e.g. Tacos" required />
              <Button type="submit">Add</Button>
            </HStack>
          </form>
        ) : null}
      </Box>

      <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
        <Heading as="h3" size="md" mb={3}>
          Activities
        </Heading>
        <Stack gap={2} mb={4}>
          {activityOptions.map((option) => (
            <HStack key={option.id} justify="space-between" wrap="wrap" gap={2}>
              <Text>{option.name}</Text>
              {isDraft ? (
                <form action={deleteActivityOptionAction}>
                  <input type="hidden" name="id" value={option.id} />
                  <input type="hidden" name="eventId" value={event.id} />
                  <Button type="submit" size="sm" variant="outline" colorPalette="red">
                    Delete
                  </Button>
                </form>
              ) : null}
            </HStack>
          ))}
        </Stack>
        {isDraft ? (
          <form action={addActivityOptionAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <HStack gap={2}>
              <Input name="name" placeholder="e.g. Board Games" required />
              <Button type="submit">Add</Button>
            </HStack>
          </form>
        ) : null}
      </Box>

      <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
        <Heading as="h3" size="md" mb={3}>
          What to bring
        </Heading>
        <Stack gap={2} mb={4}>
          {bringItems.map((item) => (
            <HStack key={item.id} justify="space-between" wrap="wrap" gap={2}>
              <Text>{item.name}</Text>
              {isDraft ? (
                <form action={deleteBringItemAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="eventId" value={event.id} />
                  <Button type="submit" size="sm" variant="outline" colorPalette="red">
                    Delete
                  </Button>
                </form>
              ) : null}
            </HStack>
          ))}
        </Stack>
        {isDraft ? (
          <form action={addBringItemAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <HStack gap={2}>
              <Input name="name" placeholder="e.g. Drinks" required />
              <Button type="submit">Add</Button>
            </HStack>
          </form>
        ) : null}
      </Box>

      <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
        <Heading as="h3" size="md" mb={3}>
          Invitees
        </Heading>
        <Stack gap={2} mb={4}>
          {invitees.map((invitee) => (
            <HStack key={invitee.id} justify="space-between" wrap="wrap" gap={2}>
              <Text>
                {invitee.userName} ({invitee.userWhatsappNumber}) — {invitee.rsvpStatus}
              </Text>
              {isDraft ? (
                <form action={removeInviteeAction}>
                  <input type="hidden" name="id" value={invitee.id} />
                  <input type="hidden" name="eventId" value={event.id} />
                  <Button type="submit" size="sm" variant="outline" colorPalette="red">
                    Remove
                  </Button>
                </form>
              ) : null}
            </HStack>
          ))}
        </Stack>
        {isDraft ? (
          <form action={addInviteeAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <Stack gap={2}>
              <Input name="name" placeholder="Name" required />
              <Input
                name="whatsappNumber"
                placeholder="WhatsApp number, e.g. +15551234567"
                required
              />
              <Button type="submit" alignSelf="flex-start">
                Add invitee
              </Button>
            </Stack>
          </form>
        ) : null}
      </Box>

      {isDraft ? (
        <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
          <Heading as="h3" size="md" mb={3}>
            Publish
          </Heading>
          <form action={publishEventAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <Button type="submit">Publish &amp; Invite</Button>
          </form>
        </Box>
      ) : null}

      {!isDraft ? (
        <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
          <Heading as="h3" size="md" mb={3}>
            Invite links
          </Heading>
          <Text color="fg.muted" mb={3}>
            WhatsApp sending isn&apos;t wired up yet — share these links manually to test the RSVP
            flow.
          </Text>
          <Stack gap={1}>
            {invitees.map((invitee) => (
              <Text key={invitee.id} fontSize="sm">
                {invitee.userName}: <Text as="code">/e/{invitee.inviteToken}</Text>
              </Text>
            ))}
          </Stack>
        </Box>
      ) : null}

      {rsvpCounts ? (
        <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
          <Heading as="h3" size="md" mb={3}>
            RSVP status
          </Heading>
          <Table.ScrollArea>
            <Table.Root size="sm">
              <Table.Body>
                <Table.Row>
                  <Table.Cell>Invited</Table.Cell>
                  <Table.Cell>{rsvpCounts.invited}</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell>Attending</Table.Cell>
                  <Table.Cell>{rsvpCounts.attending}</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell>Declined</Table.Cell>
                  <Table.Cell>{rsvpCounts.declined}</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell>No response</Table.Cell>
                  <Table.Cell>{rsvpCounts.pending}</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
        </Box>
      ) : null}

      {rsvpCounts ? (
        <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
          <Heading as="h3" size="md" mb={3}>
            Attendees
          </Heading>
          <Table.ScrollArea>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Person</Table.ColumnHeader>
                  <Table.ColumnHeader>RSVP</Table.ColumnHeader>
                  <Table.ColumnHeader>Food</Table.ColumnHeader>
                  <Table.ColumnHeader>Activity</Table.ColumnHeader>
                  <Table.ColumnHeader>Bringing</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {invitees.map((invitee) => (
                  <Table.Row key={invitee.id}>
                    <Table.Cell>{invitee.userName}</Table.Cell>
                    <Table.Cell>{invitee.rsvpStatus}</Table.Cell>
                    <Table.Cell>
                      {foodOptions.find((o) => o.id === invitee.foodChoice1)?.name ?? '—'}
                    </Table.Cell>
                    <Table.Cell>
                      {activityOptions.find((o) => o.id === invitee.activityChoice1)?.name ?? '—'}
                    </Table.Cell>
                    <Table.Cell>
                      {bringItems.find((i) => i.id === invitee.bringItemId)?.name ?? '—'}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
        </Box>
      ) : null}

      {votingResults ? (
        <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
          <Heading as="h3" size="md" mb={3}>
            Voting results
          </Heading>
          <Heading as="h4" size="sm" mb={2}>
            Food
          </Heading>
          <Table.ScrollArea mb={5}>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Option</Table.ColumnHeader>
                  <Table.ColumnHeader>1st</Table.ColumnHeader>
                  <Table.ColumnHeader>2nd</Table.ColumnHeader>
                  <Table.ColumnHeader>3rd</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {votingResults.food.map((row) => (
                  <Table.Row key={row.id}>
                    <Table.Cell>{row.name}</Table.Cell>
                    <Table.Cell>{row.first}</Table.Cell>
                    <Table.Cell>{row.second}</Table.Cell>
                    <Table.Cell>{row.third}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
          <Heading as="h4" size="sm" mb={2}>
            Activity
          </Heading>
          <Table.ScrollArea>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Option</Table.ColumnHeader>
                  <Table.ColumnHeader>1st</Table.ColumnHeader>
                  <Table.ColumnHeader>2nd</Table.ColumnHeader>
                  <Table.ColumnHeader>3rd</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {votingResults.activity.map((row) => (
                  <Table.Row key={row.id}>
                    <Table.Cell>{row.name}</Table.Cell>
                    <Table.Cell>{row.first}</Table.Cell>
                    <Table.Cell>{row.second}</Table.Cell>
                    <Table.Cell>{row.third}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
        </Box>
      ) : null}

      {event.status === 'published' ? (
        <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
          <Heading as="h3" size="md" mb={3}>
            Finalize
          </Heading>
          <form action={finalizeEventAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <Stack gap={4}>
              <FormSelect
                id="finalFoodOptionId"
                name="finalFoodOptionId"
                placeholder="Choose the final food"
                required
                options={foodOptions
                  .filter((option) => !option.disabled)
                  .map((option) => ({ value: option.id, label: option.name }))}
              />
              <FormSelect
                id="finalActivityOptionId"
                name="finalActivityOptionId"
                placeholder="Choose the final activity"
                required
                options={activityOptions.map((option) => ({
                  value: option.id,
                  label: option.name,
                }))}
              />
              <Button type="submit" alignSelf="flex-start">
                Finalize Event
              </Button>
            </Stack>
          </form>
        </Box>
      ) : null}

      {event.status === 'finalized' ? (
        <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
          <Heading as="h3" size="md" mb={3}>
            Finalized
          </Heading>
          <Text>Final food: {foodOptions.find((o) => o.id === event.finalFoodOptionId)?.name}</Text>
          <Text>
            Final activity:{' '}
            {activityOptions.find((o) => o.id === event.finalActivityOptionId)?.name}
          </Text>
        </Box>
      ) : null}
    </PageShell>
  )
}
```

Disabled food options are still excluded from the finalize `FormSelect`'s `options` list entirely (same as the original's `.filter((option) => !option.disabled)`) — an admin must not be able to finalize on a disabled option, and since `FormSelect`'s options list is simply not given that item, there's no way to select it, matching the original comment's intent even though the comment text itself isn't carried over verbatim into this version.

- [ ] **Step 2: Verify manually, end to end**

Run: `npm run build` — expect success.

Run: `docker compose --profile dev up -d postgres`, `npm run dev &`. Walk through the full admin lifecycle on this one page: create a draft event (or reuse one), add/disable/delete food and activity options and bring items, add/remove an invitee, publish, confirm the "Invite links" section shows styled `/e/{token}` links, confirm the RSVP status/attendees tables render (and scroll horizontally instead of breaking layout at a narrow width), finalize the event using the two new `FormSelect` dropdowns (confirm a disabled food option never appears as a choice), confirm the finalized section shows the chosen food/activity. Stop the dev server (`kill %1`) when done.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/\(gated\)/events/\[id\]/page.tsx
git commit -m "style: restyle the admin event-detail page with Chakra UI"
```

---

### Task 8: Restyle both error boundaries

**Files:**
- Modify: `src/app/error.tsx`
- Modify: `src/app/admin/error.tsx`

**Interfaces:**
- Consumes: `PageShell`, `Button` (Task 2).
- Produces: nothing — this is the last task in the plan.

Restyled last, once the rest of the design system's look is settled, per the design spec's rollout order. Same `error`/`reset` props and same messages as before — presentation only.

- [ ] **Step 1: Replace the root error boundary**

Replace the full contents of `src/app/error.tsx`:

```tsx
'use client'

import NextLink from 'next/link'
import { Alert, Stack, Text } from '@chakra-ui/react'
import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/Button'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageShell title="Something went wrong">
      <Alert.Root status="error">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>{error.message || 'An unexpected error occurred.'}</Alert.Description>
        </Alert.Content>
      </Alert.Root>
      {error.digest ? (
        <Text color="fg.muted" fontSize="sm">
          Reference: {error.digest}
        </Text>
      ) : null}
      <Stack direction="row" gap={3}>
        <Button onClick={() => reset()}>Try again</Button>
        <Button asChild variant="outline">
          <NextLink href="/">Back to My Events</NextLink>
        </Button>
      </Stack>
    </PageShell>
  )
}
```

- [ ] **Step 2: Replace the admin error boundary**

Replace the full contents of `src/app/admin/error.tsx`:

```tsx
'use client'

import NextLink from 'next/link'
import { Alert, Stack, Text } from '@chakra-ui/react'
import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/Button'

// Next.js error boundary for every route under /admin. Server actions in
// src/lib/events.ts throw EventActionError with admin-facing messages
// ("Add at least one food option before publishing", ...). Without this
// boundary those throws render Next's default crash page. In production
// Next may redact the message (leaving only `digest`), so this component
// degrades to a generic message plus a way back rather than a blank page.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageShell title="Something went wrong">
      <Alert.Root status="error">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>{error.message || 'An unexpected error occurred.'}</Alert.Description>
        </Alert.Content>
      </Alert.Root>
      {error.digest ? (
        <Text color="fg.muted" fontSize="sm">
          Error reference: {error.digest}
        </Text>
      ) : null}
      <Stack direction="row" gap={3}>
        <Button onClick={() => reset()}>Try again</Button>
        <Button asChild variant="outline">
          <NextLink href="/admin">Back to events</NextLink>
        </Button>
      </Stack>
    </PageShell>
  )
}
```

- [ ] **Step 3: Verify manually**

Run: `npm run build` — expect success.

Run: `docker compose --profile dev up -d postgres`, `npm run dev &`. Trigger each boundary: for the admin one, the easiest reproducible trigger is publishing an event with zero food options (if `publishEventAction` rejects that per Phase 2's validation) or any other action that throws `EventActionError` — confirm the styled alert shows the message, "Try again" resets, "Back to events" navigates to `/admin`. For the root boundary, temporarily throw an error from a page you can revert immediately after (e.g., add `throw new Error('test')` at the top of `src/app/page.tsx`, reload, confirm the styled boundary appears with "Back to My Events", then revert the temporary throw — do not commit it). Stop the dev server (`kill %1`) when done.

- [ ] **Step 4: Commit**

```bash
git add src/app/error.tsx src/app/admin/error.tsx
git commit -m "style: restyle both error boundaries with Chakra UI"
```

---

## End-of-Phase Verification

- [ ] Run the full test suite: `docker compose --profile dev up -d postgres-test`, then `npx vitest run` — expect all 94 tests across 13 files to pass (the prior 90 across 12 files, plus `tests/components/FormSelect.test.tsx`'s 4 new tests).
- [ ] Run `npm run build` — expect success, confirm the route table is unchanged (same set of routes, same static/dynamic markers as before this phase).
- [ ] Run `docker build -t open-party-test-build .` — expect success, then `docker rmi open-party-test-build` to clean up.
- [ ] Walk through every restyled page once more end to end (admin login → dashboard → create event → event detail: add options, add invitee, publish, finalize; attendee: open magic link → RSVP page → My Events → decline flow; both error boundaries), this time specifically checking: no native `<select>` dropdown appears anywhere (only the two native date/time inputs on event-create, which is expected and correct), the layout is usable at a narrow (mobile) browser width on every page, and every button/link that previously worked still works.
- [ ] Confirm `git log --oneline` shows eight commits, one per task, on top of the prior history.
