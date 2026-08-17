import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { loadEnv } from '@/lib/env'
import { ATTENDEE_SESSION_COOKIE_NAME, verifyAttendeeSessionToken } from '@/lib/attendeeSession'
import { getInviteeForUserAndEvent } from '@/lib/rsvp'
import { getEvent, getFoodOptions, getActivityOptions, getBringItems } from '@/lib/queries/events'
import { getClaimedBringItemIds } from '@/lib/queries/rsvp'
import { declineAction, submitRsvpAction } from '@/lib/actions/rsvp'

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
      <main>
        <h1>{event.title}</h1>
        <p>
          {event.date} {event.startTime}
        </p>
        <p>
          Final food: {foodOptions.find((o) => o.id === event.finalFoodOptionId)?.name ?? '—'}
        </p>
        <p>
          Final activity:{' '}
          {activityOptions.find((o) => o.id === event.finalActivityOptionId)?.name ?? '—'}
        </p>
        <p>
          You&apos;re bringing:{' '}
          {bringItems.find((i) => i.id === invitee.bringItemId)?.name ?? 'nothing selected'}
        </p>
      </main>
    )
  }

  const claimedBringItemIds = await getClaimedBringItemIds(eventId, invitee.id)

  return (
    <main>
      <h1>{event.title}</h1>
      <p>
        {event.date} {event.startTime}
      </p>
      {event.description ? <p>{event.description}</p> : null}
      <p>Your current RSVP: {invitee.rsvpStatus}</p>

      <section>
        <h2>Yes, I&apos;ll be there</h2>
        <form action={submitRsvpAction}>
          <input type="hidden" name="eventId" value={eventId} />

          <h3>Food (pick up to 3, ranked)</h3>
          {(['foodChoice1', 'foodChoice2', 'foodChoice3'] as const).map((field, index) => (
            <div key={field}>
              <label htmlFor={field}>{index + 1}. choice</label>
              <select id={field} name={field} defaultValue={invitee[field] ?? ''}>
                <option value="">No preference</option>
                {foodOptions
                  .filter((option) => !option.disabled)
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
              </select>
            </div>
          ))}

          <h3>Activity (pick up to 3, ranked)</h3>
          {(['activityChoice1', 'activityChoice2', 'activityChoice3'] as const).map((field, index) => (
            <div key={field}>
              <label htmlFor={field}>{index + 1}. choice</label>
              <select id={field} name={field} defaultValue={invitee[field] ?? ''}>
                <option value="">No preference</option>
                {activityOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <h3>What will you bring?</h3>
          <select name="bringItemId" defaultValue={invitee.bringItemId ?? ''}>
            <option value="">Nothing</option>
            {bringItems.map((item) => {
              const claimedByOther = claimedBringItemIds.has(item.id) && item.id !== invitee.bringItemId
              return (
                <option key={item.id} value={item.id} disabled={claimedByOther}>
                  {item.name}
                  {claimedByOther ? ' (already claimed)' : ''}
                </option>
              )
            })}
          </select>

          <button type="submit">Confirm RSVP</button>
        </form>
      </section>

      <section>
        <h2>I can&apos;t make it</h2>
        <form action={declineAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <label htmlFor="declineReason">Reason (optional)</label>
          <input
            type="text"
            id="declineReason"
            name="declineReason"
            defaultValue={invitee.declineReason ?? ''}
          />
          <button type="submit">Decline</button>
        </form>
      </section>
    </main>
  )
}
