# Chakra UI Redesign — Design (Phase 4)

## Overview

The app has been server-rendered plain HTML since Foundation — no CSS framework, no client-side JS, native `<select>`/`<input>`/`<button>` throughout. This phase gives it a real, mobile-first visual design system across every page (admin and attendee), built on Chakra UI, and replaces native dropdowns with fully custom-built selects. It's the fourth build phase, taking the "Phase 4" slot on the roadmap — WhatsApp integration (sending invites/reminders via WAHA), previously slated for this slot, moves to Phase 5.

## Scope

**In scope:**
- Chakra UI v3 setup (theme, provider, mobile-first breakpoints) for the whole app
- A small shared component set: `Button`, `FormSelect` (custom dropdown), `PageShell`, `FieldGroup`
- Restyling every existing page — admin (dashboard, login, event create, event detail) and attendee (My Events, RSVP, link-invalid) — plus both error boundaries
- Replacing every native `<select>` (8 total: `foodChoice1/2/3`, `activityChoice1/2/3`, and `bringItemId` on the attendee RSVP page, plus `finalFoodOptionId` and `finalActivityOptionId` on the admin finalize form) with a custom-built `FormSelect` widget (no native dropdown UI), submitting through the same Server Actions via a hidden input
- Component tests for `FormSelect`'s state → hidden-input sync (new test tooling: `@testing-library/react` + jsdom)

**Explicitly out of scope:**
- WhatsApp integration — deferred to Phase 5, unchanged from today (admin still shares magic links manually)
- Confirmation dialogs for destructive admin actions (delete food option, remove invitee, etc.) — those stay a single click, just restyled
- A custom date/time picker for the event-create form — `<input type="date">`/`type="time"` stay native elements, restyled only for their closed-state appearance; the OS calendar/clock popup is untouched
- Any change to business logic, Server Actions, database schema, or session/auth handling — this phase is purely presentational plus the one new `FormSelect` interaction primitive
- Toast notifications, animations beyond Chakra's defaults, dark mode (Chakra ships light mode by default; can be added later without disrupting this phase's work)

## Architecture

`@chakra-ui/react` v3 provides both the component library and the styling engine — no Tailwind, avoiding two parallel styling systems. A `src/app/providers.tsx` client component (`'use client'`) wraps `ChakraProvider` around `{children}` and is mounted once in `src/app/layout.tsx`; every page underneath stays a Server Component by default, since a server-rendered page can render Chakra's (internally client-side) components as ordinary JSX children without becoming a client component itself. This preserves every existing Server Action and `<form action={...}>` pattern except where `FormSelect` is used.

`src/theme.ts` defines the design tokens via Chakra's `createSystem`/`defineConfig`: a brand color scale, spacing scale, typography, and Chakra's default mobile-first breakpoint set (`base → sm → md → lg → xl`), so every component built against the theme is responsive without hand-written media queries.

**`FormSelect`** (`src/components/FormSelect.tsx`, `'use client'`) is the one new interactive primitive this phase introduces — this app has had zero client-side interactive logic until now. It's a custom-built listbox (no native `<select>` popup anywhere): open/closed and selected-option state live in React, keyboard navigation and click-outside-to-close are handled in the component, and the current selection is mirrored into a `<input type="hidden" name={fieldName} value={selectedValue} />` sibling so the enclosing native `<form action={serverAction}>` and its server-side `FormData` parsing work completely unchanged. No Server Action signature changes anywhere in this phase — `FormSelect` is a drop-in replacement for `<select name="..." defaultValue="...">` at each of its 8 call sites (RSVP page: `foodChoice1/2/3`, `activityChoice1/2/3`, `bringItemId`; admin finalize form: `finalFoodOptionId`, `finalActivityOptionId`), accepting the same `name`/`defaultValue`/options-list shape its native predecessor did.

`<input type="date">`/`type="time"` on the event-create form stay native elements, wrapped in Chakra's `Input` styling for their collapsed-state appearance (border, focus ring, sizing, font) — their native calendar/clock popups are not replaced.

Both error boundaries (`src/app/error.tsx`, `src/app/admin/error.tsx`) are restyled with Chakra's `Alert` and layout primitives — same error-handling logic (`error`/`reset` props, the same messages), different presentation.

## Component inventory

A small shared set in `src/components/`, everything else used directly from Chakra against the shared theme:

- **`Button`** — thin wrapper/re-export of Chakra's `Button`, so call sites import from `@/components/Button` rather than `@chakra-ui/react` directly; a future style tweak is then one file, not a grep across every page.
- **`FormSelect`** — the custom dropdown described above.
- **`PageShell`** — the mobile-first page container + heading pattern reused on every page (max-width, padding, heading style).
- **`FieldGroup`** — the label + input/select + error-message layout reused by every form field across both admin and attendee forms.

## Rollout order

Everything ships in a single phase (one design system, no in-between state where half the app is Chakra and half is native), built as an ordered sequence within that phase so nothing is left half-migrated at any commit:

1. Theme + provider + shared component set (`Button`, `PageShell`, `FieldGroup`)
2. `FormSelect`, proven against the two highest-value pages first: the attendee RSVP page (most selects: 6 of the 8) and admin login (simplest form, good smoke test for the theme/provider wiring)
3. Remaining attendee pages: My Events, link-invalid
4. Remaining admin pages: dashboard, event-create, event-detail (largest page — many small inline forms for food/activity/bring-item/invitee management, plus the 2 remaining `FormSelect` call sites on the finalize form)
5. Both error boundaries, restyled last (once the rest of the design system's look is settled)

## Testing

No change to any existing test — this phase touches no business logic, Server Actions, or queries, so every `src/lib/*` test keeps passing unmodified. The one new thing worth testing is `FormSelect`'s client-side state → hidden-input sync, since it's genuinely new interactive logic reused in 8 places across both admin and attendee flows. This adds `@testing-library/react` and a jsdom test environment (new to this project — every prior test has run against a real Postgres with no DOM), scoped narrowly to `FormSelect`: selecting an option updates the hidden input's `value`, the initially-rendered `defaultValue` is respected, and the widget's rendered `name` matches what's passed in (so it lines up with what the enclosing Server Action's `FormData.get(name)` expects).

Every other page's restyle is verified manually — visual/interaction review, same as how every prior phase's UI was verified before this one (there was no UI to unit-test then either).
