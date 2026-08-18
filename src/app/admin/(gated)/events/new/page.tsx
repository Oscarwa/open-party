import { Input, Stack, Textarea } from '@chakra-ui/react'
import { createEventAction } from '@/lib/actions/events'
import { PageShell } from '@/components/PageShell'
import { FieldGroup } from '@/components/FieldGroup'
import { DateField } from '@/components/DateField'
import { Button } from '@/components/Button'

export default function NewEventPage() {
  return (
    <PageShell title="New Event">
      <form action={createEventAction}>
        <Stack gap={5}>
          <FieldGroup label="Title" htmlFor="title">
            <Input id="title" name="title" required />
          </FieldGroup>
          <FieldGroup label="Date" htmlFor="date">
            <DateField id="date" name="date" required />
          </FieldGroup>
          <FieldGroup label="Start time" htmlFor="startTime">
            <Input id="startTime" name="startTime" type="time" required />
          </FieldGroup>
          <FieldGroup label="Description (optional)" htmlFor="description">
            <Textarea id="description" name="description" />
          </FieldGroup>
          <Button type="submit" alignSelf="flex-start">
            Create Event
          </Button>
        </Stack>
      </form>
    </PageShell>
  )
}
