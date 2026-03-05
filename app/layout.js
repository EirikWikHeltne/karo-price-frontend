import './globals.css'

export const metadata = {
  title: 'PrisScanner — Sammenlign apotekpriser',
  description: 'Sammenlign apotekpriser på tvers av norske apotek.',
  icons: {
    icon: '/logo.svg',
    apple: '/logo.svg',
  },
  openGraph: {
    title: 'PrisScanner — Sammenlign apotekpriser',
    description: 'Sammenlign apotekpriser på tvers av norske apotek.',
    images: [{ url: '/og-image.svg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PrisScanner — Sammenlign apotekpriser',
    description: 'Sammenlign apotekpriser på tvers av norske apotek.',
    images: ['/og-image.svg'],
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  )
}
