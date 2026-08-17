import type { ReactNode } from 'react'
import { Box, Heading, Stack } from '@chakra-ui/react'

export function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box as="main" maxW="42rem" mx="auto" px={{ base: 4, md: 6 }} py={{ base: 6, md: 10 }}>
      <Stack gap={{ base: 6, md: 8 }}>
        <Heading as="h1" size={{ base: 'xl', md: '2xl' }}>
          {title}
        </Heading>
        {children}
      </Stack>
    </Box>
  )
}
