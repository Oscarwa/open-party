'use client'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main>
      <h1>Something went wrong</h1>
      <p>{error.message || 'An unexpected error occurred.'}</p>
      {error.digest ? <p>Reference: {error.digest}</p> : null}
      <button type="button" onClick={() => reset()}>
        Try again
      </button>
      <p>
        <a href="/">Back to My Events</a>
      </p>
    </main>
  )
}
