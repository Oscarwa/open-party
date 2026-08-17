import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Provider } from '@/components/Provider'

export const metadata: Metadata = {
  title: 'Open Party',
  description: 'Organize recurring gatherings with friends and family.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  )
}
