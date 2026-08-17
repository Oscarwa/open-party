import type { ReactNode } from 'react'
import { Box, Heading, HStack } from '@chakra-ui/react'
import { logoutAction } from '@/lib/actions/auth'
import { Button } from '@/components/Button'

// Layout for the gated admin routes only. Every route under this `(gated)`
// route group is behind src/middleware.ts's session check, so admin-only
// chrome and state-mutating Server Actions belong here — never in the outer
// `src/app/admin/layout.tsx`, which also wraps the unauthenticated
// `/admin/login` page.
//
// The `(gated)` parentheses make this an organizational group: it does not
// appear in any URL. `(gated)/page.tsx` still serves `/admin`,
// `(gated)/events/new/page.tsx` still serves `/admin/events/new`.
export default function GatedAdminLayout({ children }: { children: ReactNode }) {
  return (
    <Box>
      <HStack
        as="header"
        justify="space-between"
        px={{ base: 4, md: 6 }}
        py={4}
        borderBottomWidth="1px"
      >
        <Heading as="h2" size="md">
          Open Party — Admin
        </Heading>
        <form action={logoutAction}>
          <Button type="submit" size="sm" variant="outline">
            Log out
          </Button>
        </form>
      </HStack>
      {children}
    </Box>
  )
}
