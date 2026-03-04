import './globals.css'

export const metadata = {
  title: 'Karo Priser — Prisovervåking',
  description: 'Daglig prisovervåking på tvers av norske apotekkjeder',
}

export default function RootLayout({ children }) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  )
}
