'use client'

import type { ReactNode } from 'react'
import { ChakraProvider } from '@chakra-ui/react'
import { ThemeProvider } from 'next-themes'
import { system } from '@/theme'

// next-themes is Chakra's documented color-mode provider, required even
// though this phase ships light mode only — forcedTheme locks it there.
// Wiring it in now means enabling dark mode later is a one-line change
// (drop forcedTheme), not a restructure of this file.
export function Provider({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider value={system}>
      <ThemeProvider attribute="class" forcedTheme="light" disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </ChakraProvider>
  )
}
