import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Knowledge IQ | Private Document Assistant',
    template: '%s | Knowledge IQ',
  },
  description:
    'A local-first document assistant. Search your files and get answers grounded in cited sources.',
}

export const viewport: Viewport = {
  themeColor: '#09090b',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  )
}
