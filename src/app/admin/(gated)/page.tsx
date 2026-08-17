import NextLink from 'next/link'
import { Link as ChakraLink, Stack, Text } from '@chakra-ui/react'
import { listEvents } from '@/lib/queries/events'
import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/Button'

// Without this, Next.js statically prerenders this page at build time
// (nothing here uses a dynamic API like cookies()/headers()/searchParams
// that would otherwise force per-request rendering) — the events list
// would freeze at whatever was in the database during `docker build` and
// never update in the deployed app until the next image rebuild.
export const dynamic = 'force-dynamic'

export default async function AdminEventsPage() {
  const events = await listEvents()

  return (
    <PageShell title="Events">
      <Button asChild alignSelf="flex-start">
        <NextLink href="/admin/events/new">New Event</NextLink>
      </Button>
      {events.length === 0 ? (
        <Text color="fg.muted">No events yet.</Text>
      ) : (
        <Stack gap={4}>
          {events.map((event) => (
            <Stack key={event.id} gap={1} borderWidth="1px" borderRadius="lg" p={4}>
              <ChakraLink asChild fontWeight="semibold">
                <NextLink href={`/admin/events/${event.id}`}>{event.title}</NextLink>
              </ChakraLink>
              <Text color="fg.muted" fontSize="sm">
                {event.date} {event.startTime} · {event.status}
              </Text>
            </Stack>
          ))}
        </Stack>
      )}
    </PageShell>
  )
}
