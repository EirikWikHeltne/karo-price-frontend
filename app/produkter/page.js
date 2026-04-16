'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'

const CAT_CLASS = {
  'Body lotion': 'cat-lotion',
  'Paracetamol': 'cat-paracetamol',
  'Mouthwash':   'cat-mouthwash',
  'Intimate':    'cat-intimate',
  'Ibuprofen':   'cat-ibuprofen',
}

export default function ProdukterPage() {
  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [kategori, setKategori] = useState('alle')
  const [sortCol, setSortCol]   = useState('kategori')
  const [sortDir, setSortDir]   = useState('asc')
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(() => {
    fetch('/api/produkter', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setData(d || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const categories = useMemo(() => {
    return [...new Set(data.map(r => r.kategori).filter(Boolean))].sort()
  }, [data])

  const brands = useMemo(() => {
    return [...new Set(data.map(r => r.merke).filter(Boolean))].sort()
  }, [data])

  const filtered = useMemo(() => {
    let d = data
    if (kategori !== 'alle') d = d.filter(r => r.kategori === kategori)
    if (search) {
      const s = search.toLowerCase()
      d = d.filter(r =>
        (r.produkt || '').toLowerCase().includes(s) ||
        (r.merke || '').toLowerCase().includes(s) ||
        (r.varenummer || '').toLowerCase().includes(s)
      )
    }
    return [...d].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (av === null || av === undefined) av = ''
      if (bv === null || bv === undefined) bv = ''
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [data, kategori, search, sortCol, sortDir])

  // Stats by category
  const categoryStats = useMemo(() => {
    const stats = {}
    data.forEach(r => {
      if (!r.kategori) return
      if (!stats[r.kategori]) stats[r.kategori] = { count: 0, brands: new Set() }
      stats[r.kategori].count++
      if (r.merke) stats[r.kategori].brands.add(r.merke)
    })
    return stats
  }, [data])

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const renderSortIcon = (col) => {
    if (sortCol !== col) return <span style={{ opacity: 0.3 }}>&#8597;</span>
    return <span>{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
  }

  function downloadExcel() {
    const rows = filtered.map(row => ({
      Produkt: row.produkt,
      Merke: row.merke,
      Varenummer: row.varenummer,
      Kategori: row.kategori,
      'Sist oppdatert': row.sist_oppdatert
        ? new Date(row.sist_oppdatert).toLocaleDateString('nb-NO')
        : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Produkter')
    XLSX.writeFile(wb, `karo-produkter-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

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
            <span className="nav-link active">Produkter</span>
            <Link href="/sammenlign" className="nav-link" onClick={() => setMobileNav(false)}>Sammenlign</Link>
          </nav>
        </div>
      </header>

      <div className="controls">
        <div className="search-wrap">
          <span className="search-icon">&#x1F50D;</span>
          <input
            className="search-input"
            placeholder="Søk produkt, merke, varenr..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {['alle', ...categories].map(k => (
            <button
              key={k}
              className={`tab ${kategori === k ? 'active' : ''}`}
              onClick={() => setKategori(k)}
            >
              {k === 'alle' ? 'Alle kategorier' : k}
            </button>
          ))}
        </div>
        <div className="controls-right">
          <span className="count-badge">{filtered.length} produkter</span>
          <button
            className="btn-excel"
            onClick={downloadExcel}
            disabled={!filtered.length}
          >
            Last ned Excel
          </button>
        </div>
      </div>

      {/* Category summary cards */}
      {!loading && data.length > 0 && (
        <div className="stats-bar">
          <div className="stat">
            <span className="stat-label">Totalt produkter</span>
            <span className="stat-value">{data.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Kategorier</span>
            <span className="stat-value">{categories.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Merker</span>
            <span className="stat-value">{brands.length}</span>
          </div>
          {Object.entries(categoryStats).sort(([a], [b]) => a.localeCompare(b)).map(([cat, s]) => (
            <div key={cat} className="stat">
              <span className="stat-label">{cat}</span>
              <span className="stat-value">{s.count}</span>
              <span className="stat-sub">{s.brands.size} merker</span>
            </div>
          ))}
        </div>
      )}

      <div className="table-wrap">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            Henter produkter...
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">&#9678;</div>
            <div className="empty-text">Ingen produkter funnet</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('varenummer')} className={sortCol === 'varenummer' ? 'sorted' : ''} style={{ width: '120px' }}>
                  Varenummer {renderSortIcon('varenummer')}
                </th>
                <th onClick={() => handleSort('produkt')} className={sortCol === 'produkt' ? 'sorted' : ''}>
                  Produkt {renderSortIcon('produkt')}
                </th>
                <th onClick={() => handleSort('merke')} className={sortCol === 'merke' ? 'sorted' : ''} style={{ width: '160px' }}>
                  Merke {renderSortIcon('merke')}
                </th>
                <th onClick={() => handleSort('kategori')} className={sortCol === 'kategori' ? 'sorted' : ''} style={{ width: '140px' }}>
                  Kategori {renderSortIcon('kategori')}
                </th>
                <th style={{ width: '140px' }}>Sist oppdatert</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id}>
                  <td>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {row.varenummer || '—'}
                    </span>
                  </td>
                  <td>
                    <span className="product-name">{row.produkt}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.78rem' }}>{row.merke || '—'}</span>
                  </td>
                  <td className="td-category">
                    <span className={`cat-pill ${CAT_CLASS[row.kategori] || ''}`}>
                      {row.kategori}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {row.sist_oppdatert
                        ? new Date(row.sist_oppdatert).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <footer className="footer">
        <span>Karo Healthcare Norway · Produkter som overvåkes</span>
        <span>Oppdateres daglig kl. 03:00</span>
      </footer>
    </div>
  )
}
