import { notFound } from 'next/navigation'
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
  const [foodOptions, activityOptions, bringItems, invitees] = await Promise.all([
    getFoodOptions(id),
    getActivityOptions(id),
    getBringItems(id),
    getInvitees(id),
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

      {/* Later tasks in this plan add publish,
          dashboard, voting results, and finalize sections here. */}
    </main>
  )
}
