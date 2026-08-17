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
