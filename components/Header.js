'use client'
import { useState } from 'react'
import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/',           label: 'Tabell' },
  { href: '/historikk',  label: 'Historikk' },
  { href: '/grafer',     label: 'Grafer' },
  { href: '/produkter',  label: 'Produkter' },
  { href: '/sammenlign', label: 'Sammenlign' },
]

function formatUpdated(date) {
  if (!date) return null
  return date.toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function Header({ active, lastUpdated, showLastUpdated = true }) {
  const [mobileNav, setMobileNav] = useState(false)
  const updatedLabel = formatUpdated(lastUpdated)

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo">KARO PRISER</div>
        <div className="header-sub">Prisovervåking</div>
      </div>
      {showLastUpdated && updatedLabel && (
        <div className="header-meta-mobile">
          <span className="header-dot"></span>
          {`Oppdatert ${updatedLabel}`}
        </div>
      )}
      <button
        className="mobile-nav-toggle"
        onClick={() => setMobileNav(v => !v)}
        aria-label="Meny"
      >
        <span></span><span></span><span></span>
      </button>
      <div className={`header-right ${mobileNav ? 'open' : ''}`}>
        <nav className="header-nav">
          {NAV_ITEMS.map(item => (
            item.href === active ? (
              <span key={item.href} className="nav-link active">{item.label}</span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link"
                onClick={() => setMobileNav(false)}
              >
                {item.label}
              </Link>
            )
          ))}
        </nav>
        {showLastUpdated && (
          <div className="header-meta">
            <span className="header-dot"></span>
            {updatedLabel ? `Oppdatert ${updatedLabel}` : 'Laster...'}
          </div>
        )}
      </div>
    </header>
  )
}
