# Gathering Planner — Simple PRD

## 1. Product Overview

A lightweight web app for organizing recurring gatherings with friends and family.

An organizer creates an event, proposes food and activity options, and invites selected people. Invitees receive the invitation through WhatsApp, RSVP through a simple web page, vote on their preferred food and activities, and indicate what they will bring.

WhatsApp is primarily the **communication and authentication channel**, while the web app is the **interaction and event-management interface**.

> **Note on "recurring":** the app does not schedule or automate recurring events for MVP (see §21). "Recurring gatherings" means the same group of friends/family uses the app repeatedly, event after event — each one created manually by the organizer.

### Example

> **Saturday, August 29 — 6:00 PM**
>
> 🍕 Food: Pizza / Tacos / Burgers
> 🎮 Activity: Board Games / Mario Kart / Movie
> 🥤 Bring: Drinks / Dessert / Snacks
>
> 8 people invited → 6 attending → organizer chooses the final options → everyone receives confirmation through WhatsApp.

---

# 2. Goals

### Primary goals

* Make recurring gatherings extremely easy to organize.
* Minimize WhatsApp conversations and coordination.
* Let guests RSVP without creating traditional accounts/passwords.
* Collect preferences before the event.
* Give the organizer a clear view of attendance and preferences.
* Use WhatsApp for invitations, confirmations, reminders and authentication.

### Non-goals for MVP

* Payments.
* Public events.
* Calendar integrations.
* Complex social networking.
* Chat functionality.
* Multiple organizers with complex permissions.
* Native mobile apps.
* Advanced recommendation algorithms.

---

# 3. User Roles

## Admin / Organizer

Creates and manages events.

Can:

* Create an event.
* Select invitees.
* Define food options.
* Define activity options.
* Define "What to bring" items.
* Publish invitations.
* View RSVP status.
* View voting results.
* Select the final food/activity.
* Send confirmations.
* Send reminders.

## Attendee

Receives an invitation and participates in an event.

Can:

* Authenticate by opening their per-event magic link (received via WhatsApp).
* View their invitations.
* RSVP.
* Decline.
* Optionally provide a reason for declining.
* Rank food preferences.
* Rank activity preferences.
* Select something to bring.
* View final event details.

---

# 4. Core Event Lifecycle

```text
DRAFT
  ↓
PUBLISHED
  ↓
RSVP COLLECTION
  ↓
FINALIZED
  ↓
COMPLETED
```

### Draft

Admin is configuring the event.

### Published

Invitations have been sent through WhatsApp.

Guests can RSVP and vote.

### Finalized

Admin has selected the final food/activity and confirmed event details.

### Completed

The event date has passed.

---

# 5. Admin Workflow

## 5.1 Create Event

Admin enters:

* Event title
* Date
* Start time
* Optional description

Example:

> Saturday Dinner & Games
> August 29
> 6:00 PM

---

## 5.2 Select Invitees

Admin sees their contact list and selects people to invite.

Example:

* Oscar
* Bonga
* John
* Jane
* Carlos
* Ana

For MVP, contacts can simply be stored as:

* Name
* WhatsApp number

No need for a complicated contact-management system.

---

## 5.3 Configure Food

Admin adds one or more options.

Example:

**Food**

1. Pizza
2. Tacos
3. Burgers

The admin can optionally mark an option as unavailable/disabled.

---

## 5.4 Configure Activities

Admin adds possible activities.

Example:

**Activities**

1. Board games
2. Mario Kart
3. Movie night
4. Karaoke

---

## 5.5 Configure "What to Bring"

Admin creates a list of things guests can volunteer to bring.

Example:

**What to bring**

* Drinks
* Dessert
* Chips
* Ice
* Plates
* Snacks

An item can optionally have a quantity.

Example:

> Drinks — 2 people

For MVP, however, simply assigning one attendee per item is enough.

---

## 5.6 Publish Event

Admin reviews the event and clicks:

**Publish & Invite**

The system:

1. Changes event status to `PUBLISHED`.
2. Sends a WhatsApp invitation to every selected attendee.
3. Provides a unique RSVP link.

Example WhatsApp message:

> 🎉 You're invited!
>
> Saturday Dinner & Games
> Saturday, August 29 at 6:00 PM
>
> Please RSVP and vote for your favorite food and activity:
>
> [RSVP]

---

# 6. Attendee Workflow

## 6.1 Receive WhatsApp Invitation

The attendee receives a WhatsApp message containing the event information and RSVP link.

---

## 6.2 Authenticate

Each invitee's WhatsApp invitation (§5.6) contains a **unique, unguessable magic link** — not a shared event link.

Opening it logs them straight into their RSVP page. No number entry, no code to type.

### Important MVP decision

There should be **no password system, and no separate OTP step**.

Receiving the link on your own WhatsApp *is* the identity proof — only the real number's owner ever sees it, since it's delivered individually per invitee.

The link stays valid until the event completes (plus a few days after, so attendees can still view final details). There's no "forgot my link" flow for MVP — if lost, the admin can resend the invitation.

Opening any magic link also sets a session cookie tied to the attendee's `User` record, so once they've clicked into one event, they can navigate to "My Events" (§18) and see every event they're invited to — not just the one from the link they opened.

---

# 7. RSVP Page

The attendee sees:

### Event

**Saturday Dinner & Games**

Saturday, August 29
6:00 PM

---

## Attendance

### Will you attend?

* ✅ Yes, I'll be there
* ❌ I can't make it

If declining:

> Optional reason

Examples:

* Out of town
* Already have plans
* Not feeling well
* Other

---

# 8. Food Preferences

If attending:

> **What would you prefer to eat?**

The attendee ranks up to three options.

Example:

**1st choice:** 🌮 Tacos
**2nd choice:** 🍕 Pizza
**3rd choice:** 🍔 Burgers

The UI could simply allow drag-and-drop ranking.

For MVP, selecting first/second/third independently is also sufficient.

---

# 9. Activity Preferences

Same mechanism.

> **What would you like to do?**

1. 🎮 Mario Kart
2. 🎲 Board games
3. 🎬 Movie night

Maximum of three preferences.

---

# 10. What to Bring

The attendee sees the available items.

Example:

> **What would you like to bring?**

* 🥤 Drinks
* 🍰 Dessert
* 🍿 Snacks
* 🧊 Ice
* 🍽️ Plates

They select one.

Once selected, the item becomes assigned to them.

Example:

> Oscar → Drinks
> Bonga → Dessert
> John → Ice

The system should prevent two people from claiming the same item unless the admin explicitly allows multiple people.

---

# 11. Submit RSVP

The attendee clicks:

**Confirm RSVP**

The system saves:

* Attendance status
* Food ranking
* Activity ranking
* What they are bringing
* Optional decline reason

Then displays:

> ✅ You're going!
>
> We'll send you the final details once the event is finalized.

---

# 12. Admin Event Dashboard

The admin sees a simple event overview.

### Example

**Saturday Dinner & Games**

August 29 · 6:00 PM

| Status      | Count |
| ----------- | ----: |
| Invited     |     8 |
| Attending   |     6 |
| Declined    |     1 |
| No response |     1 |

---

## Attendee List

| Person | RSVP | Food  | Activity    | Bringing |
| ------ | ---- | ----- | ----------- | -------- |
| Oscar  | ✅    | Tacos | Mario Kart  | Drinks   |
| Bonga  | ✅    | Pizza | Movie       | Dessert  |
| John   | ✅    | Tacos | Board games | Ice      |
| Jane   | ❌    | —     | —           | —        |
| Carlos | ?    | —     | —           | —        |

---

# 13. Voting Results

The admin can see aggregated preferences.

### Food

| Option  | 1st | 2nd | 3rd |
| ------- | --: | --: | --: |
| Tacos   |   4 |   1 |   0 |
| Pizza   |   2 |   3 |   1 |
| Burgers |   0 |   2 |   3 |

### Activity

| Option      | 1st | 2nd | 3rd |
| ----------- | --: | --: | --: |
| Mario Kart  |   3 |   2 |   0 |
| Board Games |   2 |   3 |   1 |
| Movie       |   1 |   1 |   4 |

The app **does not need to automatically decide the winner** initially.

Instead, the admin selects:

> **Final Food:** Tacos
> **Final Activity:** Mario Kart

This keeps the organizer in control.

---

# 14. Finalize Event

Admin clicks:

**Finalize Event**

The system records:

* Final food
* Final activity
* Final date/time
* What each person is bringing

Then the admin can send:

**Send Confirmation**

WhatsApp message:

> 🎉 It's official!
>
> This Saturday at 6:00 PM.
>
> 🌮 Food: Tacos
> 🎮 Activity: Mario Kart
>
> You're bringing: Drinks
>
> See you there!

---

# 15. Reminders

The system automatically sends a WhatsApp reminder one day before the event.

Example:

> 👋 Reminder!
>
> Tomorrow at 6:00 PM:
>
> 🌮 Tacos
> 🎮 Mario Kart
>
> You're bringing: Drinks
>
> See you tomorrow!

The attendee can also open the RSVP page at any time to see the latest details.

---

# 16. WhatsApp Integration

WAHA acts as the communication layer.

WAHA automates a real WhatsApp account via an unofficial web-session API — free, but against WhatsApp's ToS and carries a risk of that number being banned. For MVP, run it on a **spare/secondary number**, not your primary personal number. If message volume or reliability ever becomes a problem, migrating to the official WhatsApp Business Cloud API is the documented fallback (see §21).

### Messages sent by the system

* Event invitation (contains the invitee's magic link)
* RSVP confirmation
* Event finalized notification
* Event reminder
* Potentially RSVP follow-up reminders

### Example message types

```text
INVITATION
"You're invited to Saturday Dinner & Games — [magic link]"

CONFIRMATION
"You're attending!"

FINAL_DETAILS
"The event is finalized: Tacos + Mario Kart"

REMINDER
"Tomorrow is the event!"
```

The web application should not depend on WhatsApp for its core functionality. WhatsApp is primarily the **notification + authentication mechanism** — the magic link it delivers is what authenticates the attendee (see §6.2).

---

# 17. Suggested MVP Data Model

Keep the backend very small.

### User

```text
User
- Id
- Name
- WhatsAppNumber
- CreatedAt
```

### Event

```text
Event
- Id
- Title
- Date
- StartTime
- Description
- Status
- FinalFoodOptionId
- FinalActivityOptionId
- CreatedAt
```

### EventInvitee

```text
EventInvitee
- Id
- EventId
- UserId
- InviteToken       // unique, unguessable — the magic-link credential
- TokenExpiresAt    // event date + a few days grace
- RSVPStatus
- DeclineReason
- FoodChoice1
- FoodChoice2
- FoodChoice3
- ActivityChoice1
- ActivityChoice2
- ActivityChoice3
- BringItemId
- RSVPAt
```

### FoodOption

```text
FoodOption
- Id
- EventId
- Name
- Disabled
```

### ActivityOption

```text
ActivityOption
- Id
- EventId
- Name
```

### BringItem

```text
BringItem
- Id
- EventId
- Name
- AssignedToUserId
```

This is enough for the entire MVP. There's no `OTP` entity — the invite token on `EventInvitee` is the only auth credential needed (see §6.2).

---

# 18. Pages

The application could realistically start with only **4 pages** — there's no dedicated login page, since opening a magic link *is* the login (§6.2). It also sets a session cookie tied to the attendee's `User` record, so subsequent navigation (e.g. to "My Events") works without needing another link click.

### 1. My Events

Attendee sees:

* Upcoming events
* RSVP status
* Past events

Reachable once they've opened at least one magic link (which establishes their session).

### 2. RSVP

The main attendee experience.

### 3. Admin Events

List of events created by the admin.

### 4. Admin Event

Event configuration + RSVP dashboard + voting results + finalization.

---

# 19. MVP Technology

Because the application is intentionally simple, a monolith is appropriate — and since this is single-tenant (§3) and self-hosted on a homelab, there's no need for microservices, queues, Redis, or serverless infrastructure.

### Stack

```text
Next.js (TypeScript) — single app
  - React UI (App Router)
  - Server actions / route handlers as the API
  - Two route groups: public (attendee-facing) and /admin
       ↓
PostgreSQL — reuses the existing homelab instance
  - Drizzle as the ORM/migration tool
       ↓
WAHA — own container, spare/secondary WhatsApp number
```

**Why this shape:**

* **Next.js over a separate SPA + API** — one Docker image, one process, no CORS. Matches the "don't overbuild" principle in §22.
* **Drizzle over an ORM like EF Core/Prisma** — lightweight, migrations as plain readable SQL, no code-gen step. Fits a schema this small.
* **Reusing the existing Postgres instance** — no need to stand up a dedicated database for a project this size.

### Background jobs

The only scheduled job for MVP is the day-before reminder (§15). `node-cron` running in-process inside the Next.js server is sufficient — it's one query + a loop once a day, and the app runs persistently on the homelab box (no serverless cold-start/sleep concerns). A dedicated worker/queue is unnecessary at this scale.

### Hosting & exposure

Self-hosted on the homelab, made reachable via **Tailscale Funnel** (public internet, no Tailscale client required on anyone's end). Funnel exposes the whole app, `/admin` included — the admin dashboard is intentionally public and gated by a password, not by Tailnet placement:

```text
Attendees ──(public internet)──▶ Tailscale Funnel ──▶ Next.js public routes ( / )
You       ──(public internet)──▶ Tailscale Funnel ──▶ Next.js admin routes ( /admin )
                                                       └─ gated by ADMIN_PASSWORD
                                                          + signed session cookie

docker-compose services on the homelab box:
  - app   (Next.js, standalone build)   — DATABASE_URL points at the existing Postgres
  - waha  (WAHA, persistent session volume) — internal-only, not exposed to Tailnet or Funnel
```

Because Funnel exposes a whole port, `/admin` cannot rely on network placement for privacy, so it carries its own auth: **decided and implemented** — a single `ADMIN_PASSWORD` checked in a Server Action, which sets an HMAC-signed session cookie that middleware verifies on every `/admin/*` request except `/admin/login`. `ADMIN_PASSWORD` is therefore the entire admin security boundary. See `docs/deploy/tailscale.md` for the deployed model and `docs/superpowers/specs/2026-08-17-admin-password-auth-design.md` for the design rationale.

### Testing

Light coverage for MVP: integration tests (against a test database) for the trickiest flows — magic-link auth, RSVP submission, finalize flow, and the reminder job. No e2e/UI test tooling for MVP; add if the app grows past a solo project.

---

# 20. MVP Requirements

### Must Have

* [ ] Admin dashboard gated by an in-app password login (`ADMIN_PASSWORD` + signed session cookie); `/admin` itself is publicly reachable via Funnel
* [ ] Create event
* [ ] Set date/time
* [ ] Select invitees
* [ ] Add food options
* [ ] Add activity options
* [ ] Add "What to bring" items
* [ ] Publish event
* [ ] WhatsApp invitation with per-invitee magic link
* [ ] Magic-link authentication (no OTP, no password)
* [ ] RSVP
* [ ] Decline + optional reason
* [ ] Rank food preferences
* [ ] Rank activity preferences
* [ ] Claim a "What to bring" item
* [ ] Admin RSVP dashboard
* [ ] Admin voting results
* [ ] Select final food/activity
* [ ] Send final confirmation
* [ ] Automated day-before reminder
* [ ] Attendee can view finalized event details

---

# 21. Things Explicitly Deferred

These are potentially useful later, but should not complicate the MVP.

### Later

* Recurring events
* Automatic food/activity winner calculation
* Guest +1
* Multiple admins
* Multiple households/groups
* Calendar integration
* Google/Apple calendar links
* Photo sharing after events
* Event history/statistics
* Favorite food/activity tracking
* Automatic recommendations
* Cost splitting
* Shopping lists
* WhatsApp interactive buttons
* Polls directly inside WhatsApp
* Event cancellation/rescheduling
* Custom event themes
* Push notifications
* Native mobile application
* Short-lived/regenerable magic links + a "resend my link" flow
* Migrating off WAHA to the official WhatsApp Business Cloud API (if ban risk or volume becomes a real problem)
* Multiple organizers / multi-tenant support

---

# 22. Key Product Principle

The app should **not become another social network or event-management platform**.

The ideal experience is:

### Admin

```text
Create event
     ↓
Pick people
     ↓
Add food/activity/bring options
     ↓
Publish
     ↓
Wait for responses
     ↓
Pick final options
     ↓
Confirm
```

### Attendee

```text
WhatsApp
     ↓
Open link  (logged in automatically)
     ↓
Pick:
  Food #1 #2 #3
  Activity #1 #2 #3
  What I'll bring
     ↓
RSVP
     ↓
Done
```

The entire attendee flow should ideally take **less than 2 minutes**.

The product's biggest advantage is not sophisticated functionality; it's **removing the annoying coordination loop of "so who's coming, what should we eat, what do you guys want to do, who's bringing drinks?" from WhatsApp.**
