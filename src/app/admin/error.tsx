'use client'

import NextLink from 'next/link'
import { Alert, Stack, Text } from '@chakra-ui/react'
import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/Button'

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
    <PageShell title="Something went wrong">
      <Alert.Root status="error">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>{error.message || 'An unexpected error occurred.'}</Alert.Description>
        </Alert.Content>
      </Alert.Root>
      {error.digest ? (
        <Text color="fg.muted" fontSize="sm">
          Error reference: {error.digest}
        </Text>
      ) : null}
      <Stack direction="row" gap={3}>
        <Button onClick={() => reset()}>Try again</Button>
        <Button asChild variant="outline">
          <NextLink href="/admin">Back to events</NextLink>
        </Button>
      </Stack>
    </PageShell>
  )
}
