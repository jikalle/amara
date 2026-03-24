import type { Metadata } from 'next'
import { Playfair_Display, DM_Sans, Space_Mono } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['700', '900'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '700'],
})

export const metadata: Metadata = {
  title:       'Anara Wallet — Autonomous Multichain',
  description: 'The world\'s first autonomous multichain wallet. Agent-powered DeFi for everyone.',
  icons: {
    icon:  '/anara-icon.svg',
    apple: '/anara-apple.png',
  },
  openGraph: {
    title:       'Anara Wallet',
    description: 'Autonomous multichain wallet. Your agent works while you sleep.',
    images:      ['/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmSans.variable} ${spaceMono.variable}`}
    >
      <body className="bg-earth text-cream font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
