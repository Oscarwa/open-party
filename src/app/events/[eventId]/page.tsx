import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { Box, Heading, Input, Stack, Text } from '@chakra-ui/react'
import { loadEnv } from '@/lib/env'
import { ATTENDEE_SESSION_COOKIE_NAME, verifyAttendeeSessionToken } from '@/lib/attendeeSession'
import { getInviteeForUserAndEvent } from '@/lib/rsvp'
import { getEvent, getFoodOptions, getActivityOptions, getBringItems } from '@/lib/queries/events'
import { getClaimedBringItemIds } from '@/lib/queries/rsvp'
import { declineAction, submitRsvpAction } from '@/lib/actions/rsvp'
import { PageShell } from '@/components/PageShell'
import { FieldGroup } from '@/components/FieldGroup'
import { FormSelect } from '@/components/FormSelect'
import { Button } from '@/components/Button'

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
      <PageShell title={event.title}>
        <Text color="fg.muted">
          {event.date} {event.startTime}
        </Text>
        <Stack gap={2}>
          <Text>
            Final food: {foodOptions.find((o) => o.id === event.finalFoodOptionId)?.name ?? '—'}
          </Text>
          <Text>
            Final activity:{' '}
            {activityOptions.find((o) => o.id === event.finalActivityOptionId)?.name ?? '—'}
          </Text>
          <Text>
            You&apos;re bringing:{' '}
            {bringItems.find((i) => i.id === invitee.bringItemId)?.name ?? 'nothing selected'}
          </Text>
        </Stack>
      </PageShell>
    )
  }

  const claimedBringItemIds = await getClaimedBringItemIds(eventId, invitee.id)

  const foodSelectOptions = foodOptions
    .filter((option) => !option.disabled)
    .map((option) => ({ value: option.id, label: option.name }))

  const activitySelectOptions = activityOptions.map((option) => ({
    value: option.id,
    label: option.name,
  }))

  const bringItemSelectOptions = bringItems.map((item) => {
    const claimedByOther = claimedBringItemIds.has(item.id) && item.id !== invitee.bringItemId
    return {
      value: item.id,
      label: claimedByOther ? `${item.name} (already claimed)` : item.name,
      disabled: claimedByOther,
    }
  })

  return (
    <PageShell title={event.title}>
      <Text color="fg.muted">
        {event.date} {event.startTime}
      </Text>
      {event.description ? <Text>{event.description}</Text> : null}
      <Text fontWeight="medium">Your current RSVP: {invitee.rsvpStatus}</Text>

      <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
        <Heading as="h2" size="lg" mb={4}>
          Yes, I&apos;ll be there
        </Heading>
        <form action={submitRsvpAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <Stack gap={5}>
            <Heading as="h3" size="md">
              Food (pick up to 3, ranked)
            </Heading>
            {(['foodChoice1', 'foodChoice2', 'foodChoice3'] as const).map((field, index) => (
              <FieldGroup key={field} label={`${index + 1}. choice`} htmlFor={field}>
                <FormSelect
                  id={field}
                  name={field}
                  placeholder="No preference"
                  defaultValue={invitee[field] ?? undefined}
                  options={foodSelectOptions}
                />
              </FieldGroup>
            ))}

            <Heading as="h3" size="md">
              Activity (pick up to 3, ranked)
            </Heading>
            {(['activityChoice1', 'activityChoice2', 'activityChoice3'] as const).map(
              (field, index) => (
                <FieldGroup key={field} label={`${index + 1}. choice`} htmlFor={field}>
                  <FormSelect
                    id={field}
                    name={field}
                    placeholder="No preference"
                    defaultValue={invitee[field] ?? undefined}
                    options={activitySelectOptions}
                  />
                </FieldGroup>
              ),
            )}

            <FieldGroup label="What will you bring?" htmlFor="bringItemId">
              <FormSelect
                id="bringItemId"
                name="bringItemId"
                placeholder="Nothing"
                defaultValue={invitee.bringItemId ?? undefined}
                options={bringItemSelectOptions}
              />
            </FieldGroup>

            <Button type="submit" alignSelf="flex-start">
              Confirm RSVP
            </Button>
          </Stack>
        </form>
      </Box>

      <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
        <Heading as="h2" size="lg" mb={4}>
          I can&apos;t make it
        </Heading>
        <form action={declineAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <Stack gap={4}>
            <FieldGroup label="Reason (optional)" htmlFor="declineReason">
              <Input
                id="declineReason"
                name="declineReason"
                defaultValue={invitee.declineReason ?? ''}
              />
            </FieldGroup>
            <Button type="submit" variant="outline" alignSelf="flex-start">
              Decline
            </Button>
          </Stack>
        </form>
      </Box>
    </PageShell>
  )
}
