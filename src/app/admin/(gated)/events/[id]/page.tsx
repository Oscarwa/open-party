import { notFound } from 'next/navigation'
import { z } from 'zod'
import { Box, Heading, HStack, Input, Stack, Table, Text } from '@chakra-ui/react'
import {
  getEvent,
  getFoodOptions,
  getActivityOptions,
  getBringItems,
  getInvitees,
  getRsvpCounts,
  getVotingResults,
} from '@/lib/queries/events'
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
import { PageShell } from '@/components/PageShell'
import { FormSelect } from '@/components/FormSelect'
import { Button } from '@/components/Button'

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // `events.id` is a uuid column: handing Postgres a non-uuid string makes
  // the query itself throw ("invalid input syntax for type uuid") before
  // getEvent() can return null, which would surface as a 500 instead of a
  // 404. Shape-check first so a malformed URL is just "not found".
  //
  // z.guid(), not z.uuid(): zod 4's uuid() also enforces the RFC version
  // and variant bits, which would 404 a row whose id is accepted by
  // Postgres but not RFC-conformant. All this guard needs is the 8-4-4-4-12
  // hex shape that makes the cast safe.
  if (!z.guid().safeParse(id).success) {
    notFound()
  }

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
    <PageShell title={event.title}>
      <Text color="fg.muted">
        {event.date} {event.startTime} · {event.status}
      </Text>
      {event.description ? <Text>{event.description}</Text> : null}

      <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
        <Heading as="h3" size="md" mb={3}>
          Food
        </Heading>
        <Stack gap={2} mb={4}>
          {foodOptions.map((option) => (
            <HStack key={option.id} justify="space-between" wrap="wrap" gap={2}>
              <Text>
                {option.name} {option.disabled ? '(disabled)' : ''}
              </Text>
              <HStack gap={2}>
                <form action={toggleFoodOptionDisabledAction}>
                  <input type="hidden" name="id" value={option.id} />
                  <Button type="submit" size="sm" variant="outline">
                    {option.disabled ? 'Enable' : 'Disable'}
                  </Button>
                </form>
                {isDraft ? (
                  <form action={deleteFoodOptionAction}>
                    <input type="hidden" name="id" value={option.id} />
                    <input type="hidden" name="eventId" value={event.id} />
                    <Button type="submit" size="sm" variant="outline" colorPalette="red">
                      Delete
                    </Button>
                  </form>
                ) : null}
              </HStack>
            </HStack>
          ))}
        </Stack>
        {isDraft ? (
          <form action={addFoodOptionAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <HStack gap={2}>
              <Input name="name" placeholder="e.g. Tacos" required />
              <Button type="submit">Add</Button>
            </HStack>
          </form>
        ) : null}
      </Box>

      <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
        <Heading as="h3" size="md" mb={3}>
          Activities
        </Heading>
        <Stack gap={2} mb={4}>
          {activityOptions.map((option) => (
            <HStack key={option.id} justify="space-between" wrap="wrap" gap={2}>
              <Text>{option.name}</Text>
              {isDraft ? (
                <form action={deleteActivityOptionAction}>
                  <input type="hidden" name="id" value={option.id} />
                  <input type="hidden" name="eventId" value={event.id} />
                  <Button type="submit" size="sm" variant="outline" colorPalette="red">
                    Delete
                  </Button>
                </form>
              ) : null}
            </HStack>
          ))}
        </Stack>
        {isDraft ? (
          <form action={addActivityOptionAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <HStack gap={2}>
              <Input name="name" placeholder="e.g. Board Games" required />
              <Button type="submit">Add</Button>
            </HStack>
          </form>
        ) : null}
      </Box>

      <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
        <Heading as="h3" size="md" mb={3}>
          What to bring
        </Heading>
        <Stack gap={2} mb={4}>
          {bringItems.map((item) => (
            <HStack key={item.id} justify="space-between" wrap="wrap" gap={2}>
              <Text>{item.name}</Text>
              {isDraft ? (
                <form action={deleteBringItemAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="eventId" value={event.id} />
                  <Button type="submit" size="sm" variant="outline" colorPalette="red">
                    Delete
                  </Button>
                </form>
              ) : null}
            </HStack>
          ))}
        </Stack>
        {isDraft ? (
          <form action={addBringItemAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <HStack gap={2}>
              <Input name="name" placeholder="e.g. Drinks" required />
              <Button type="submit">Add</Button>
            </HStack>
          </form>
        ) : null}
      </Box>

      <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
        <Heading as="h3" size="md" mb={3}>
          Invitees
        </Heading>
        <Stack gap={2} mb={4}>
          {invitees.map((invitee) => (
            <HStack key={invitee.id} justify="space-between" wrap="wrap" gap={2}>
              <Text>
                {invitee.userName} ({invitee.userWhatsappNumber}) — {invitee.rsvpStatus}
              </Text>
              {isDraft ? (
                <form action={removeInviteeAction}>
                  <input type="hidden" name="id" value={invitee.id} />
                  <input type="hidden" name="eventId" value={event.id} />
                  <Button type="submit" size="sm" variant="outline" colorPalette="red">
                    Remove
                  </Button>
                </form>
              ) : null}
            </HStack>
          ))}
        </Stack>
        {isDraft ? (
          <form action={addInviteeAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <Stack gap={2}>
              <Input name="name" placeholder="Name" required />
              <Input
                name="whatsappNumber"
                placeholder="WhatsApp number, e.g. +15551234567"
                required
              />
              <Button type="submit" alignSelf="flex-start">
                Add invitee
              </Button>
            </Stack>
          </form>
        ) : null}
      </Box>

      {isDraft ? (
        <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
          <Heading as="h3" size="md" mb={3}>
            Publish
          </Heading>
          <form action={publishEventAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <Button type="submit">Publish &amp; Invite</Button>
          </form>
        </Box>
      ) : null}

      {!isDraft ? (
        <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
          <Heading as="h3" size="md" mb={3}>
            Invite links
          </Heading>
          <Text color="fg.muted" mb={3}>
            WhatsApp sending isn&apos;t wired up yet — share these links manually to test the RSVP
            flow.
          </Text>
          <Stack gap={1}>
            {invitees.map((invitee) => (
              <Text key={invitee.id} fontSize="sm">
                {invitee.userName}: <Text as="code">/e/{invitee.inviteToken}</Text>
              </Text>
            ))}
          </Stack>
        </Box>
      ) : null}

      {rsvpCounts ? (
        <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
          <Heading as="h3" size="md" mb={3}>
            RSVP status
          </Heading>
          <Table.ScrollArea>
            <Table.Root size="sm">
              <Table.Body>
                <Table.Row>
                  <Table.Cell>Invited</Table.Cell>
                  <Table.Cell>{rsvpCounts.invited}</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell>Attending</Table.Cell>
                  <Table.Cell>{rsvpCounts.attending}</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell>Declined</Table.Cell>
                  <Table.Cell>{rsvpCounts.declined}</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell>No response</Table.Cell>
                  <Table.Cell>{rsvpCounts.pending}</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
        </Box>
      ) : null}

      {rsvpCounts ? (
        <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
          <Heading as="h3" size="md" mb={3}>
            Attendees
          </Heading>
          <Table.ScrollArea>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Person</Table.ColumnHeader>
                  <Table.ColumnHeader>RSVP</Table.ColumnHeader>
                  <Table.ColumnHeader>Food</Table.ColumnHeader>
                  <Table.ColumnHeader>Activity</Table.ColumnHeader>
                  <Table.ColumnHeader>Bringing</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {invitees.map((invitee) => (
                  <Table.Row key={invitee.id}>
                    <Table.Cell>{invitee.userName}</Table.Cell>
                    <Table.Cell>{invitee.rsvpStatus}</Table.Cell>
                    <Table.Cell>
                      {foodOptions.find((o) => o.id === invitee.foodChoice1)?.name ?? '—'}
                    </Table.Cell>
                    <Table.Cell>
                      {activityOptions.find((o) => o.id === invitee.activityChoice1)?.name ?? '—'}
                    </Table.Cell>
                    <Table.Cell>
                      {bringItems.find((i) => i.id === invitee.bringItemId)?.name ?? '—'}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
        </Box>
      ) : null}

      {votingResults ? (
        <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
          <Heading as="h3" size="md" mb={3}>
            Voting results
          </Heading>
          <Heading as="h4" size="sm" mb={2}>
            Food
          </Heading>
          <Table.ScrollArea mb={5}>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Option</Table.ColumnHeader>
                  <Table.ColumnHeader>1st</Table.ColumnHeader>
                  <Table.ColumnHeader>2nd</Table.ColumnHeader>
                  <Table.ColumnHeader>3rd</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {votingResults.food.map((row) => (
                  <Table.Row key={row.id}>
                    <Table.Cell>{row.name}</Table.Cell>
                    <Table.Cell>{row.first}</Table.Cell>
                    <Table.Cell>{row.second}</Table.Cell>
                    <Table.Cell>{row.third}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
          <Heading as="h4" size="sm" mb={2}>
            Activity
          </Heading>
          <Table.ScrollArea>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Option</Table.ColumnHeader>
                  <Table.ColumnHeader>1st</Table.ColumnHeader>
                  <Table.ColumnHeader>2nd</Table.ColumnHeader>
                  <Table.ColumnHeader>3rd</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {votingResults.activity.map((row) => (
                  <Table.Row key={row.id}>
                    <Table.Cell>{row.name}</Table.Cell>
                    <Table.Cell>{row.first}</Table.Cell>
                    <Table.Cell>{row.second}</Table.Cell>
                    <Table.Cell>{row.third}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
        </Box>
      ) : null}

      {event.status === 'published' ? (
        <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
          <Heading as="h3" size="md" mb={3}>
            Finalize
          </Heading>
          <form action={finalizeEventAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <Stack gap={4}>
              <FormSelect
                id="finalFoodOptionId"
                name="finalFoodOptionId"
                placeholder="Choose the final food"
                required
                options={foodOptions
                  .filter((option) => !option.disabled)
                  .map((option) => ({ value: option.id, label: option.name }))}
              />
              <FormSelect
                id="finalActivityOptionId"
                name="finalActivityOptionId"
                placeholder="Choose the final activity"
                required
                options={activityOptions.map((option) => ({
                  value: option.id,
                  label: option.name,
                }))}
              />
              <Button type="submit" alignSelf="flex-start">
                Finalize Event
              </Button>
            </Stack>
          </form>
        </Box>
      ) : null}

      {event.status === 'finalized' ? (
        <Box as="section" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }}>
          <Heading as="h3" size="md" mb={3}>
            Finalized
          </Heading>
          <Text>Final food: {foodOptions.find((o) => o.id === event.finalFoodOptionId)?.name}</Text>
          <Text>
            Final activity:{' '}
            {activityOptions.find((o) => o.id === event.finalActivityOptionId)?.name}
          </Text>
        </Box>
      ) : null}
    </PageShell>
  )
}
