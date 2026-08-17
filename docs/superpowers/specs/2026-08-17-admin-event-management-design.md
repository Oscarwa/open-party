# Admin Event Management — Design (Phase 2)

## Overview

Phase 2 builds the admin-facing half of Open Party: creating an event, configuring its food/activity/"what to bring" options, inviting people, publishing, and — once there's RSVP data (Phase 3) — reviewing results and finalizing. This is the second of four phases (`docs/superpowers/plans/2026-08-16-foundation.md` was Phase 1). No WhatsApp sending exists yet (Phase 4); publishing generates the same magic-link tokens the real flow will use, and displays them in the dashboard so the admin can test the RSVP flow manually once Phase 3 exists.

## Scope

**In scope:**
- Admin Events list page
- Create event → configure food/activity/bring options → invite people → publish
- Admin Event dashboard: RSVP status counts, attendee table, voting-results tallies (all real queries — empty/zero until Phase 3 exists)
- Finalize: pick final food/activity, transition to `FINALIZED`

**Explicitly out of scope for this phase:**
- Any WhatsApp sending — invitations, confirmations, reminders (Phase 4)
- Attendee-facing pages, magic-link login, RSVP submission (Phase 3)
- Automatic transition to `COMPLETED` when the event date passes — no scheduler exists until Phase 4's reminder cron job; that's the natural place to add it
- A separate Contacts management page — invitees are added inline during event configuration
- Event cancellation/rescheduling, guest +1, multiple admins — all explicitly deferred in plan.md §21

## Architecture

No new dependencies. Pages are Next.js server components querying Drizzle directly; mutations are `'use server'` Server Actions called from plain `<form action={...}>` elements — the same pattern Foundation's stack was chosen for, no client-side state library needed.

### Routes

- `/admin` — Admin Events list. Every event (any status), with a "New Event" link.
- `/admin/events/new` — create form (title, date, start time, optional description). On submit: creates a `DRAFT` event, redirects to its detail page.
- `/admin/events/[id]` — the single admin workhorse page. Its content depends on event status:
  - `DRAFT`: food/activity/bring-item config, invitee list (add/remove), "Publish & Invite" button (disabled with a reason until the validation in "Publish" below passes)
  - `PUBLISHED`: read-only summary of the config above — except food options keep their disable-toggle live, so the admin can pull an option that ran out mid-flight (plan.md §5.3) — plus the RSVP dashboard (counts + attendee table), voting-results tallies, generated invite links per invitee, a "Finalize" form (pick final food/activity)
  - `FINALIZED`: everything from `PUBLISHED`, plus the recorded final food/activity shown prominently

### Data model changes

Two additions to the existing schema (`src/db/schema.ts`), both migrations — no new tables:

1. Unique constraint on `event_invitees (event_id, user_id)` — the DB is the enforcement point for "can't invite the same person to the same event twice," not just application logic.
2. Indexes on each child table's `event_id` foreign key (`food_options`, `activity_options`, `bring_items`, `event_invitees`) — Postgres does not auto-index FK columns, and every dashboard/config query filters by `event_id`.

### Server actions

All in `src/lib/actions/events.ts` (one file — small enough for Phase 2; split if it grows past this phase):

| Action | Allowed when | Effect |
|---|---|---|
| `createEvent(title, date, startTime, description?)` | always | new `DRAFT` event |
| `addFoodOption(eventId, name)` | `DRAFT` | new `FoodOption` |
| `toggleFoodOptionDisabled(id)` | any status | flips `disabled` |
| `deleteFoodOption(id)` | `DRAFT` only | removes it |
| `addActivityOption(eventId, name)` | `DRAFT` | new `ActivityOption` |
| `deleteActivityOption(id)` | `DRAFT` only | removes it |
| `addBringItem(eventId, name)` | `DRAFT` | new `BringItem` |
| `deleteBringItem(id)` | `DRAFT` only | removes it |
| `addInvitee(eventId, name, whatsappNumber)` | `DRAFT` | finds-or-creates `User` by WhatsApp number, adds `EventInvitee` (blocked by the unique constraint on a duplicate) |
| `removeInvitee(eventInviteeId)` | `DRAFT` only | removes the invite |
| `publishEvent(eventId)` | `DRAFT`, and validation passes | see below |
| `finalizeEvent(eventId, finalFoodOptionId, finalActivityOptionId)` | `PUBLISHED` only | sets both final option IDs, flips status to `FINALIZED` — one action, not two separate steps |

Every action re-derives the event's current status from the DB before acting (not trusting client state) and throws/returns an error the calling form surfaces if the precondition isn't met — e.g. attempting to delete a food option on a `PUBLISHED` event fails loudly rather than silently no-op-ing.

### Publish validation

`publishEvent` rejects (with a specific error message, not a generic failure) unless the event has:
- at least 1 food option
- at least 1 activity option
- at least 1 invitee

Bring items stay optional (matches plan.md §5.5). On success: generates a unique `inviteToken` + `tokenExpiresAt` (event date + a few days, per plan.md §6.2) for every `EventInvitee`, sets `status = PUBLISHED`.

### Dashboard & voting results

Both are plain aggregate queries over `EventInvitee` rows for the event — no new tables or precomputed state:
- Status counts: `COUNT(*) GROUP BY rsvpStatus` (plus "invited" = total row count)
- Attendee table: one row per invitee, joined to their food/activity choices and bring-item assignment
- Voting results: `COUNT(*) GROUP BY foodChoice1/2/3` and the activity equivalent, rendered as the 1st/2nd/3rd tables from plan.md §13

All of this returns real, correctly-shaped results today — just empty, since no attendee can submit an RSVP until Phase 3 exists.

## Testing

Same "light, integration-focused" philosophy as Foundation — real test DB, no mocks, focused on business rules rather than exhaustively testing every CRUD action:

- `publishEvent`: rejects with no food option / no activity option / no invitees; succeeds and generates a token per invitee when valid
- `addInvitee`: creates a new `User` on first invite by a WhatsApp number; the unique constraint rejects a duplicate invite to the same event
- `finalizeEvent`: sets both final option IDs and flips status to `FINALIZED`; rejected when the event isn't `PUBLISHED`
- Draft-only guards: `deleteFoodOption` (and siblings) rejected once the event is `PUBLISHED`

No component/UI testing — pages are thin server components over these actions, consistent with Foundation's scope.
