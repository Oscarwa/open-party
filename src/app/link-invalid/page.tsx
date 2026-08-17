import { Text } from '@chakra-ui/react'
import { PageShell } from '@/components/PageShell'

export default function LinkInvalidPage() {
  return (
    <PageShell title="This link isn't valid anymore">
      <Text color="fg.muted">
        It may have expired, or the address may be mistyped. Ask the organizer to resend your
        invitation.
      </Text>
    </PageShell>
  )
}
