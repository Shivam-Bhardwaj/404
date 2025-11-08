import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '404 - Error Evolution',
  description: 'The page you seek has transcended into digital consciousness',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

