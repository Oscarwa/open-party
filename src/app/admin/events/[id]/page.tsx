import { notFound } from 'next/navigation'
import { getEvent, getFoodOptions, getActivityOptions, getBringItems, getInvitees, getRsvpCounts, getVotingResults } from '@/lib/queries/events'
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

  const [rsvpCounts, votingResults] = isDraft
    ? [null, null]
    : await Promise.all([getRsvpCounts(id), getVotingResults(id)])

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
    </main>
  )
}
