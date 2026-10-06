import './globals.css'

// Lastes som <link> i <head> i stedet for @import i CSS, slik at nettleseren
// oppdager fontene med én gang i stedet for etter at globals.css er lastet.
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap'

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body>{children}</body>
    </html>
  )
}
