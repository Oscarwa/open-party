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
