'use client'

import Link from 'next/link'

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
    <main>
      <h2>Something went wrong</h2>
      <p>{error.message || 'An unexpected error occurred.'}</p>
      {error.digest ? <p>Error reference: {error.digest}</p> : null}
      <p>
        <button type="button" onClick={() => reset()}>
          Try again
        </button>
      </p>
      <p>
        <Link href="/admin">Back to events</Link>
      </p>
    </main>
  )
}
