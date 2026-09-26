import './globals.css'
import type { Metadata } from 'next'
import { QueryProvider } from '@/lib/context/QueryProvider'
import { AuthProvider } from '@/lib/context/AuthContext'

export const metadata: Metadata = {
  title: {
    template: '%s | CogniScale',
    default: 'CogniScale — Research Experiment Platform',
  },
  description: 'Build, deploy, and analyze high-precision behavioral experiments in the browser. Secure SaaS for cognitive science and psychology research.',
  keywords: ['behavioral experiments', 'cognitive science', 'psychology research', 'reaction time', 'online experiments'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: 'Inter, system-ui, sans-serif' }} className="bg-slate-50 text-slate-900 min-h-screen">
        <QueryProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
