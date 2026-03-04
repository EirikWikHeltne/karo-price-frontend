'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'

const RETAILERS = [
  { key: 'farmasiet',   label: 'Farmasiet',   color: '#2563EB' },
  { key: 'boots',       label: 'Boots',       color: '#E11D48' },
  { key: 'vitusapotek', label: 'Vitusapotek', color: '#059669' },
  { key: 'apotek1',     label: 'Apotek 1',    color: '#7C3AED' },
]

const CATEGORIES = ['alle', 'Body lotion', 'Paracetamol', 'Mouthwash', 'Intimate', 'Ibuprofen']

const CAT_CLASS = {
  'Body lotion': 'cat-lotion',
  'Paracetamol': 'cat-paracetamol',
  'Mouthwash':   'cat-mouthwash',
  'Intimate':    'cat-intimate',
  'Ibuprofen':   'cat-ibuprofen',
}

function fmt(val) {
  if (val === null || val === undefined) return null
  return Number(val).toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Page() {
  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [search, setSearch]     = useState('')
  const [kategori, setKategori] = useState('alle')
  const [merke, setMerke]       = useState('alle')
  const [sortCol, setSortCol]   = useState('merke')
  const [sortDir, setSortDir]   = useState('asc')
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (kategori !== 'alle') params.set('kategori', kategori)
      if (search) params.set('search', search)
      const res = await fetch(`/api/priser?${params}`)
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`)
      }
      const json = await res.json()
      setData(json || [])
      if (json?.length) {
        const dates = json.map(r => r.sist_oppdatert).filter(Boolean).sort()
        if (dates.length) setLastUpdated(new Date(dates[dates.length - 1]))
      }
    } catch(e) {
      console.error(e)
      setError('Kunne ikke hente priser. Prøv igjen.')
      setData([])
    }
    setLoading(false)
  }, [kategori, search])

  useEffect(() => {
    const t = setTimeout(fetchData, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchData])

  const brands = useMemo(() => {
    if (!data.length) return []
    return [...new Set(data.map(r => r.merke).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  }, [data])

  const sorted = useMemo(() => {
    if (!data.length) return []
    let filtered = data
    if (merke !== 'alle') filtered = filtered.filter(r => r.merke === merke)
    return [...filtered].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (av === null || av === undefined) av = sortDir === 'asc' ? Infinity : -Infinity
      if (bv === null || bv === undefined) bv = sortDir === 'asc' ? Infinity : -Infinity
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [data, merke, sortCol, sortDir])

  const stats = useMemo(() => {
    if (!data.length) return {}
    const withPrices = data.filter(r => r.laveste_pris)
    const avgLow = withPrices.reduce((s,r) => s + Number(r.laveste_pris), 0) / (withPrices.length || 1)
    const avgHigh = withPrices.reduce((s,r) => s + Number(r.hoyeste_pris), 0) / (withPrices.length || 1)
    const coverage = RETAILERS.map(r => ({
      ...r,
      count: data.filter(row => row[r.key] !== null && row[r.key] !== undefined).length
    }))
    return { avgLow, avgHigh, coverage, total: data.length }
  }, [data])

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <span style={{opacity:0.3}}>↕</span>
    return <span>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function downloadExcel() {
    const rows = sorted.map(row => {
      const prices = RETAILERS.map(r => row[r.key]).filter(v => v != null)
      const min = prices.length ? Math.min(...prices) : null
      const max = prices.length ? Math.max(...prices) : null
      const obj = {
        Produkt: row.produkt,
        Merke: row.merke,
        Varenummer: row.varenummer,
        Kategori: row.kategori,
      }
      RETAILERS.forEach(r => { obj[r.label] = row[r.key] ?? null })
      obj['Laveste pris'] = min
      obj['Høyeste pris'] = max
      obj['Spread'] = min != null && max != null ? max - min : null
      return obj
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Priser')
    XLSX.writeFile(wb, `karo-priser-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="header-logo">KARO PRISER</div>
          <div className="header-sub">Prisovervåking</div>
        </div>
        <div className="header-right">
          <nav className="header-nav">
            <span className="nav-link active">Tabell</span>
            <Link href="/grafer" className="nav-link">Grafer</Link>
          </nav>
          <div className="header-meta">
            <span className="header-dot"></span>
            {lastUpdated
              ? `Oppdatert ${lastUpdated.toLocaleDateString('nb-NO', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`
              : 'Laster...'}
          </div>
        </div>
      </header>

      <div className="controls">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Søk produkt, merke, varenr..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {CATEGORIES.map(k => (
            <button
              key={k}
              className={`tab ${kategori === k ? 'active' : ''}`}
              onClick={() => setKategori(k)}
            >
              {k === 'alle' ? 'Alle kategorier' : k}
            </button>
          ))}
        </div>
        <select
          className="brand-select"
          value={merke}
          onChange={e => setMerke(e.target.value)}
        >
          <option value="alle">Alle merker</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <div className="controls-right">
          <span className="count-badge">{sorted.length} produkter</span>
          <button
            className="btn-excel"
            onClick={downloadExcel}
            disabled={!sorted.length}
          >
            Last ned Excel
          </button>
        </div>
      </div>

      {!loading && stats.total > 0 && (
        <div className="stats-bar">
          <div className="stat">
            <span className="stat-label">Produkter</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Snitt laveste pris</span>
            <span className="stat-value">{fmt(stats.avgLow)} kr</span>
          </div>
          <div className="stat">
            <span className="stat-label">Snitt høyeste pris</span>
            <span className="stat-value">{fmt(stats.avgHigh)} kr</span>
          </div>
          {stats.coverage?.map(r => (
            <div key={r.key} className="stat">
              <span className="stat-label" style={{color: r.color}}>{r.label}</span>
              <span className="stat-value">{r.count}</span>
              <span className="stat-sub">produkter med pris</span>
            </div>
          ))}
        </div>
      )}

      <div className="table-wrap">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            Henter priser...
          </div>
        ) : error ? (
          <div className="empty">
            <div className="empty-icon">⚠</div>
            <div className="empty-text">{error}</div>
          </div>
        ) : sorted.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">◎</div>
            <div className="empty-text">Ingen produkter funnet</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('produkt')} className={sortCol==='produkt'?'sorted':''}>
                  Produkt <SortIcon col="produkt" />
                </th>
                <th onClick={() => handleSort('kategori')} className={sortCol==='kategori'?'sorted':''}>
                  Kategori <SortIcon col="kategori" />
                </th>
                {RETAILERS.map(r => (
                  <th key={r.key} onClick={() => handleSort(r.key)} className={sortCol===r.key?'sorted':''} style={{textAlign:'right'}}>
                    <div className="retailer-header" style={{justifyContent:'flex-end'}}>
                      <span className="retailer-dot" style={{background: r.color}}></span>
                      {r.label} <SortIcon col={r.key} />
                    </div>
                  </th>
                ))}
                <th onClick={() => handleSort('laveste_pris')} className={sortCol==='laveste_pris'?'sorted':''} style={{textAlign:'right'}}>
                  Lavest <SortIcon col="laveste_pris" />
                </th>
                <th style={{textAlign:'right'}}>Spread</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => {
                const prices = RETAILERS.map(r => row[r.key]).filter(v => v !== null && v !== undefined)
                const min = prices.length ? Math.min(...prices) : null
                const max = prices.length ? Math.max(...prices) : null
                const spread = min && max ? max - min : null

                return (
                  <tr key={row.id}>
                    <td className="td-product">
                      <div className="product-name">{row.produkt}</div>
                      <div className="product-brand">{row.merke}</div>
                      <div className="product-vn">{row.varenummer}</div>
                    </td>
                    <td className="td-category">
                      <span className={`cat-pill ${CAT_CLASS[row.kategori] || ''}`}>
                        {row.kategori}
                      </span>
                    </td>
                    {RETAILERS.map(r => {
                      const val = row[r.key]
                      const isMin = val !== null && val !== undefined && val === min && prices.length > 1
                      const isMax = val !== null && val !== undefined && val === max && prices.length > 1 && min !== max
                      return (
                        <td key={r.key} className="td-price">
                          {val === null || val === undefined ? (
                            <span className="price-null">—</span>
                          ) : (
                            <span className={`price-val ${isMin ? 'price-lowest' : isMax ? 'price-highest' : ''}`}>
                              {fmt(val)}
                              {isMin && <span className="price-dot" style={{background:'#1D6A3A'}}></span>}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td className="td-price">
                      {min != null ? (
                        <span className="price-val price-lowest">{fmt(min)}</span>
                      ) : <span className="price-null">—</span>}
                    </td>
                    <td className="td-diff">
                      {spread != null && spread > 0 ? (
                        <span className="diff-val diff-pos">+{fmt(spread)}</span>
                      ) : spread === 0 ? (
                        <span className="diff-val diff-zero">—</span>
                      ) : (
                        <span className="price-null">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <footer className="footer">
        <span>Karo Healthcare Norway · Prisdata fra Farmasiet, Boots, Vitusapotek, Apotek 1</span>
        <span>Oppdateres daglig kl. 03:00</span>
      </footer>
    </div>
  )
}
