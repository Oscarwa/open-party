'use client'

import NextLink from 'next/link'
import { Alert, Stack, Text } from '@chakra-ui/react'
import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/Button'

export default function RootError({
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
          Reference: {error.digest}
        </Text>
      ) : null}
      <Stack direction="row" gap={3}>
        <Button onClick={() => reset()}>Try again</Button>
        <Button asChild variant="outline">
          <NextLink href="/">Back to My Events</NextLink>
        </Button>
      </Stack>
    </PageShell>
  )
}
