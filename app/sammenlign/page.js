'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'

const RETAILERS = [
  { key: 'farmasiet',   label: 'Farmasiet',   color: '#2563EB' },
  { key: 'boots',       label: 'Boots',       color: '#E11D48' },
  { key: 'vitusapotek', label: 'Vitusapotek', color: '#059669' },
  { key: 'apotek1',     label: 'Apotek 1',    color: '#7C3AED' },
]

function fmt(val) {
  if (val === null || val === undefined) return null
  return Number(val).toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SammenlignPage() {
  const [allProducts, setAllProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [basket, setBasket] = useState([])
  const [mobileNav, setMobileNav] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/priser', { cache: 'no-store' })
        if (res.ok) setAllProducts(await res.json())
      } catch (_) {}

      try {
        const updRes = await fetch('/api/siste-oppdatering', { cache: 'no-store' })
        if (updRes.ok) {
          const { dato } = await updRes.json()
          if (dato) setLastUpdated(new Date(dato + 'T12:00:00'))
        }
      } catch (_) {}

      setLoading(false)
    }
    load()
  }, [])

  const searchResults = useMemo(() => {
    if (!search.trim() || search.trim().length < 2) return []
    const q = search.toLowerCase()
    return allProducts
      .filter(p =>
        !basket.some(b => b.id === p.id) &&
        (p.produkt?.toLowerCase().includes(q) ||
         p.merke?.toLowerCase().includes(q) ||
         p.varenummer?.toLowerCase().includes(q))
      )
      .slice(0, 8)
  }, [search, allProducts, basket])

  const addToBasket = useCallback((product) => {
    setBasket(prev => {
      if (prev.some(p => p.id === product.id)) return prev
      return [...prev, product]
    })
    setSearch('')
  }, [])

  const removeFromBasket = useCallback((id) => {
    setBasket(prev => prev.filter(p => p.id !== id))
  }, [])

  const clearBasket = useCallback(() => setBasket([]), [])

  const totals = useMemo(() => {
    if (!basket.length) return null
    const result = {}
    let allHavePrices = {}
    RETAILERS.forEach(r => {
      const prices = basket.map(p => p[r.key]).filter(v => v != null).map(Number)
      result[r.key] = {
        total: prices.reduce((s, v) => s + v, 0),
        count: prices.length,
        missing: basket.length - prices.length,
      }
      allHavePrices[r.key] = prices.length
    })

    const retailersWithAllPrices = RETAILERS.filter(r => result[r.key].count === basket.length)
    let cheapest = null
    if (retailersWithAllPrices.length > 0) {
      cheapest = retailersWithAllPrices.reduce((best, r) =>
        result[r.key].total < result[best.key].total ? r : best
      , retailersWithAllPrices[0])
    } else {
      // Fall back to the retailer with lowest total among those with most products
      const maxCount = Math.max(...RETAILERS.map(r => result[r.key].count))
      const candidates = RETAILERS.filter(r => result[r.key].count === maxCount && maxCount > 0)
      if (candidates.length > 0) {
        cheapest = candidates.reduce((best, r) =>
          result[r.key].total < result[best.key].total ? r : best
        , candidates[0])
      }
    }

    return { ...result, cheapest }
  }, [basket])

  const savings = useMemo(() => {
    if (!totals || !totals.cheapest) return null
    const cheapestTotal = totals[totals.cheapest.key].total
    const most = Math.max(...RETAILERS.map(r => totals[r.key].count > 0 ? totals[r.key].total : 0))
    if (most <= cheapestTotal) return null
    return most - cheapestTotal
  }, [totals])

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="header-logo">KARO PRISER</div>
          <div className="header-sub">Prisovervåking</div>
        </div>
        <button className="mobile-nav-toggle" onClick={() => setMobileNav(!mobileNav)} aria-label="Meny">
          <span></span><span></span><span></span>
        </button>
        <div className={`header-right ${mobileNav ? 'open' : ''}`}>
          <nav className="header-nav">
            <Link href="/" className="nav-link" onClick={() => setMobileNav(false)}>Tabell</Link>
            <Link href="/historikk" className="nav-link" onClick={() => setMobileNav(false)}>Historikk</Link>
            <Link href="/grafer" className="nav-link" onClick={() => setMobileNav(false)}>Grafer</Link>
            <Link href="/produkter" className="nav-link" onClick={() => setMobileNav(false)}>Produkter</Link>
            <span className="nav-link active">Sammenlign</span>
          </nav>
          <div className="header-meta">
            <span className="header-dot"></span>
            {lastUpdated
              ? `Oppdatert ${lastUpdated.toLocaleDateString('nb-NO', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`
              : 'Laster...'}
          </div>
        </div>
      </header>

      <div className="compare-intro">
        <h2 className="compare-title">Handlekurv-sammenligning</h2>
        <p className="compare-desc">Legg til produkter og se hvilken apotekkjede som gir lavest totalpris.</p>
      </div>

      <div className="compare-search-section">
        <div className="search-wrap compare-search-wrap">
          <span className="search-icon">&#x1F50D;</span>
          <input
            className="search-input"
            placeholder="Søk etter produkt, merke eller varenr..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            disabled={loading}
          />
        </div>
        {searchResults.length > 0 && (
          <div className="compare-dropdown">
            {searchResults.map(p => (
              <button
                key={p.id}
                className="compare-dropdown-item"
                onClick={() => addToBasket(p)}
              >
                <div className="compare-dropdown-name">{p.produkt}</div>
                <div className="compare-dropdown-meta">{p.merke} &middot; {p.varenummer} &middot; {p.kategori}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {basket.length > 0 && (
        <>
          <div className="compare-totals">
            {RETAILERS.map(r => {
              const t = totals?.[r.key]
              const isCheapest = totals?.cheapest?.key === r.key
              return (
                <div key={r.key} className={`compare-total-card ${isCheapest ? 'compare-total-cheapest' : ''}`}>
                  {isCheapest && <div className="compare-cheapest-badge">Billigst</div>}
                  <div className="compare-total-retailer">
                    <span className="retailer-dot" style={{ background: r.color }}></span>
                    {r.label}
                  </div>
                  <div className="compare-total-price">{t?.count > 0 ? `${fmt(t.total)} kr` : '—'}</div>
                  {t?.missing > 0 && (
                    <div className="compare-total-missing">{t.missing} produkt{t.missing > 1 ? 'er' : ''} mangler pris</div>
                  )}
                  <div className="compare-total-count">{t?.count} av {basket.length} produkter</div>
                </div>
              )
            })}
          </div>

          {savings != null && savings > 0 && (
            <div className="compare-savings">
              Du kan spare opptil <strong>{fmt(savings)} kr</strong> ved å handle hos {totals.cheapest.label}
            </div>
          )}

          <div className="compare-basket-header">
            <span className="compare-basket-count">{basket.length} produkt{basket.length > 1 ? 'er' : ''} i handlekurven</span>
            <button className="compare-clear-btn" onClick={clearBasket}>Tøm handlekurv</button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produkt</th>
                  {RETAILERS.map(r => (
                    <th key={r.key} className="th-price" style={{ textAlign: 'right' }}>
                      <div className="retailer-header" style={{ justifyContent: 'flex-end' }}>
                        <span className="retailer-dot" style={{ background: r.color }}></span>
                        <span className="retailer-label">{r.label}</span>
                      </div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'right' }}>Lavest</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {basket.map(row => {
                  const prices = RETAILERS.map(r => row[r.key]).filter(v => v != null).map(Number)
                  const min = prices.length ? Math.min(...prices) : null

                  return (
                    <tr key={row.id}>
                      <td className="td-product">
                        <div className="product-name">{row.produkt}</div>
                        <div className="product-brand">{row.merke}</div>
                        <div className="product-vn">{row.varenummer}</div>
                      </td>
                      {RETAILERS.map(r => {
                        const val = row[r.key]
                        const isMin = val != null && Number(val) === min && prices.length > 1
                        return (
                          <td key={r.key} className="td-price" data-label={r.label}>
                            {val == null ? (
                              <span className="price-null">—</span>
                            ) : (
                              <span className={`price-val ${isMin ? 'price-lowest' : ''}`}>
                                {fmt(val)}
                                {isMin && <span className="price-dot" style={{ background: '#1D6A3A' }}></span>}
                              </span>
                            )}
                          </td>
                        )
                      })}
                      <td className="td-price" data-label="Lavest">
                        {min != null ? (
                          <span className="price-val price-lowest">{fmt(min)}</span>
                        ) : <span className="price-null">—</span>}
                      </td>
                      <td>
                        <button
                          className="compare-remove-btn"
                          onClick={() => removeFromBasket(row.id)}
                          title="Fjern"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  )
                })}
                <tr className="compare-totals-row">
                  <td className="td-product"><strong>Totalt</strong></td>
                  {RETAILERS.map(r => {
                    const t = totals?.[r.key]
                    const isCheapest = totals?.cheapest?.key === r.key
                    return (
                      <td key={r.key} className="td-price" data-label={r.label}>
                        <span className={`price-val ${isCheapest ? 'price-lowest' : ''}`}>
                          {t?.count > 0 ? `${fmt(t.total)}` : '—'}
                        </span>
                      </td>
                    )
                  })}
                  <td className="td-price"></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && basket.length === 0 && (
        <div className="empty">
          <div className="empty-icon">&#128722;</div>
          <div className="empty-text">Søk og legg til produkter for å sammenligne totalpriser mellom apotekene</div>
        </div>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          Henter produkter...
        </div>
      )}

      <footer className="footer">
        <span>Karo Healthcare Norway &middot; Prisdata fra Farmasiet, Boots, Vitusapotek, Apotek 1</span>
        <span>Oppdateres daglig kl. 03:00</span>
      </footer>
    </div>
  )
}
