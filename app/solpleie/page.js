'use client'
import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { deriveRetailers } from '@/lib/retailers'
import { fmt } from '@/lib/format'

// "Solpleie" dekker solkrem, after sun og beslektede kategorier. Vi matcher
// alle kategorier som inneholder "sol" slik at kartet fanger opp nye
// kategorinavn automatisk (Solkrem, Solpleie, After sun osv.).
function isSunCare(kategori) {
  return typeof kategori === 'string' && /sol/i.test(kategori)
}

// Beregn nøkkeltall per SKU på tvers av kjedene.
function analyzeRow(row, retailers) {
  const prices = retailers
    .map(r => row[r.key])
    .filter(v => v !== null && v !== undefined)
    .map(Number)
  if (!prices.length) {
    return { min: null, max: null, avg: null, spread: null, spreadPct: null, cheapest: null }
  }
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const avg = prices.reduce((s, v) => s + v, 0) / prices.length
  const spread = max - min
  const spreadPct = min > 0 ? (spread / min) * 100 : 0
  const cheapest = prices.length > 1
    ? retailers.find(r => row[r.key] != null && Number(row[r.key]) === min) || null
    : null
  return { min, max, avg, spread, spreadPct, cheapest }
}

export default function SolpleiePage() {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [search, setSearch]   = useState('')
  const [merke, setMerke]     = useState('alle')
  const [sortCol, setSortCol] = useState('produkt')
  const [sortDir, setSortDir] = useState('asc')
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [res, updRes] = await Promise.all([
          fetch('/api/priser', { cache: 'no-store' }),
          fetch('/api/siste-oppdatering', { cache: 'no-store' }).catch(() => null),
        ])
        if (!res.ok) throw new Error(`Server error: ${res.status}`)
        const json = await res.json()
        setData(Array.isArray(json) ? json : [])

        if (updRes?.ok) {
          try {
            const { dato } = await updRes.json()
            if (dato) setLastUpdated(new Date(dato + 'T12:00:00'))
          } catch (_) { /* ignore */ }
        }
      } catch (e) {
        console.error(e)
        setError('Kunne ikke hente priser. Prøv igjen.')
        setData([])
      }
      setLoading(false)
    }
    load()
  }, [])

  // Kun solpleie-produkter
  const sunProducts = useMemo(() => data.filter(r => isSunCare(r.kategori)), [data])

  const retailers = useMemo(() => deriveRetailers(sunProducts), [sunProducts])

  const brands = useMemo(() => {
    return [...new Set(sunProducts.map(r => r.merke).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
  }, [sunProducts])

  // Berik hver rad med analysefelter
  const enriched = useMemo(() => {
    return sunProducts.map(row => ({ ...row, _calc: analyzeRow(row, retailers) }))
  }, [sunProducts, retailers])

  const filtered = useMemo(() => {
    let d = enriched
    if (merke !== 'alle') d = d.filter(r => r.merke === merke)
    if (search) {
      const s = search.toLowerCase()
      d = d.filter(r =>
        (r.produkt || '').toLowerCase().includes(s) ||
        (r.merke || '').toLowerCase().includes(s) ||
        (r.varenummer || '').toLowerCase().includes(s)
      )
    }
    return [...d].sort((a, b) => {
      // Beregnede kolonner ligger under _calc
      const calcCols = { laveste: 'min', hoyeste: 'max', snitt: 'avg', spread: 'spread', spreadPct: 'spreadPct' }
      let av, bv
      if (calcCols[sortCol]) {
        av = a._calc[calcCols[sortCol]]
        bv = b._calc[calcCols[sortCol]]
      } else if (retailers.some(r => r.key === sortCol)) {
        av = a[sortCol]; bv = b[sortCol]
      } else {
        av = a[sortCol]; bv = b[sortCol]
      }
      if (av === null || av === undefined) av = sortDir === 'asc' ? Infinity : -Infinity
      if (bv === null || bv === undefined) bv = sortDir === 'asc' ? Infinity : -Infinity
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [enriched, merke, search, sortCol, sortDir, retailers])

  // Nøkkeltall for solpleie-utvalget
  const stats = useMemo(() => {
    if (!filtered.length) return null
    const withPrices = filtered.filter(r => r._calc.min != null)
    const avgLow = withPrices.length
      ? withPrices.reduce((s, r) => s + r._calc.min, 0) / withPrices.length : 0
    const spreads = withPrices.filter(r => r._calc.spread != null).map(r => r._calc.spread)
    const avgSpread = spreads.length ? spreads.reduce((s, v) => s + v, 0) / spreads.length : 0

    // Hvilken kjede er billigst flest ganger
    const cheapestCounts = {}
    retailers.forEach(r => { cheapestCounts[r.key] = 0 })
    withPrices.forEach(r => {
      if (r._calc.cheapest) cheapestCounts[r._calc.cheapest.key]++
    })
    let topCheapest = null
    let topCount = 0
    retailers.forEach(r => {
      if (cheapestCounts[r.key] > topCount) { topCount = cheapestCounts[r.key]; topCheapest = r }
    })

    // Dekning per kjede
    const coverage = retailers.map(r => ({
      ...r,
      count: filtered.filter(row => row[r.key] !== null && row[r.key] !== undefined).length,
    }))

    return { skus: filtered.length, avgLow, avgSpread, topCheapest, topCount, coverage }
  }, [filtered, retailers])

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const renderSortIcon = (col) => {
    if (sortCol !== col) return <span style={{ opacity: 0.3 }}>↕</span>
    return <span>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function downloadExcel() {
    // Ark 1: priskart per SKU med rådata (tall) klare for videre analyse
    const priskart = filtered.map(row => {
      const c = row._calc
      const obj = {
        Varenummer: row.varenummer,
        Produkt: row.produkt,
        Merke: row.merke,
        Kategori: row.kategori,
      }
      retailers.forEach(r => { obj[r.label] = row[r.key] ?? null })
      obj['Laveste pris'] = c.min
      obj['Høyeste pris'] = c.max
      obj['Snittpris'] = c.avg != null ? +c.avg.toFixed(2) : null
      obj['Spread (kr)'] = c.spread
      obj['Spread (%)'] = c.spreadPct != null ? +c.spreadPct.toFixed(1) : null
      obj['Billigst kjede'] = c.cheapest?.label ?? null
      obj['Sist oppdatert'] = row.sist_oppdatert
        ? new Date(row.sist_oppdatert).toLocaleDateString('nb-NO')
        : ''
      return obj
    })

    // Ark 2: oppsummering per kjede
    const oppsummering = retailers.map(r => {
      const vals = filtered.map(row => row[r.key]).filter(v => v != null).map(Number)
      const billigst = filtered.filter(row => row._calc.cheapest?.key === r.key).length
      return {
        Kjede: r.label,
        'Antall SKU med pris': vals.length,
        'Snittpris': vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : null,
        'Laveste pris': vals.length ? Math.min(...vals) : null,
        'Høyeste pris': vals.length ? Math.max(...vals) : null,
        'Billigst (antall SKU)': billigst,
      }
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(priskart), 'Priskart per SKU')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(oppsummering), 'Oppsummering per kjede')
    XLSX.writeFile(wb, `karo-solpleie-priskart-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="app">
      <Header active="/solpleie" lastUpdated={lastUpdated} />

      <div className="compare-intro">
        <h2 className="compare-title">Priskart – Solpleie</h2>
        <p className="compare-desc">
          Komplett prisoversikt per SKU for solpleie på tvers av apotekkjedene. Last ned til Excel for videre analyse.
        </p>
      </div>

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
        <select
          className="brand-select"
          value={merke}
          onChange={e => setMerke(e.target.value)}
        >
          <option value="alle">Alle merker</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <div className="controls-right">
          <span className="count-badge">{filtered.length} SKU-er</span>
          <button
            className="btn-excel"
            onClick={downloadExcel}
            disabled={!filtered.length}
          >
            Last ned Excel
          </button>
        </div>
      </div>

      {stats && !loading && (
        <div className="stats-bar">
          <div className="stat">
            <span className="stat-label">SKU-er</span>
            <span className="stat-value">{stats.skus}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Snitt laveste pris</span>
            <span className="stat-value">{fmt(stats.avgLow)} kr</span>
          </div>
          <div className="stat">
            <span className="stat-label">Snitt spread</span>
            <span className="stat-value">{fmt(stats.avgSpread)} kr</span>
          </div>
          {stats.topCheapest && (
            <div className="stat">
              <span className="stat-label">Billigst oftest</span>
              <span className="stat-value" style={{ color: stats.topCheapest.color }}>{stats.topCheapest.label}</span>
              <span className="stat-sub">{stats.topCount} av {stats.skus} SKU-er</span>
            </div>
          )}
          {stats.coverage?.map(r => (
            <div key={r.key} className="stat">
              <span className="stat-label" style={{ color: r.color }}>{r.label}</span>
              <span className="stat-value">{r.count}</span>
              <span className="stat-sub">SKU-er med pris</span>
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
            <div className="empty-icon">&#9888;</div>
            <div className="empty-text">{error}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">&#9728;</div>
            <div className="empty-text">
              {sunProducts.length === 0
                ? 'Ingen solpleie-produkter funnet i datagrunnlaget'
                : 'Ingen SKU-er matcher søket'}
            </div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('varenummer')} className={sortCol === 'varenummer' ? 'sorted' : ''} style={{ width: '110px' }}>
                  Varenummer {renderSortIcon('varenummer')}
                </th>
                <th onClick={() => handleSort('produkt')} className={sortCol === 'produkt' ? 'sorted' : ''}>
                  Produkt {renderSortIcon('produkt')}
                </th>
                {retailers.map(r => (
                  <th key={r.key} onClick={() => handleSort(r.key)} className={`th-price ${sortCol === r.key ? 'sorted' : ''}`} style={{ textAlign: 'right' }}>
                    <div className="retailer-header" style={{ justifyContent: 'flex-end' }}>
                      <span className="retailer-dot" style={{ background: r.color }}></span>
                      <span className="retailer-label">{r.label}</span> {renderSortIcon(r.key)}
                    </div>
                  </th>
                ))}
                <th onClick={() => handleSort('laveste')} className={sortCol === 'laveste' ? 'sorted' : ''} style={{ textAlign: 'right' }}>
                  Lavest {renderSortIcon('laveste')}
                </th>
                <th onClick={() => handleSort('snitt')} className={sortCol === 'snitt' ? 'sorted' : ''} style={{ textAlign: 'right' }}>
                  Snitt {renderSortIcon('snitt')}
                </th>
                <th onClick={() => handleSort('spread')} className={sortCol === 'spread' ? 'sorted' : ''} style={{ textAlign: 'right' }}>
                  Spread {renderSortIcon('spread')}
                </th>
                <th style={{ textAlign: 'right', width: '130px' }}>Billigst kjede</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const c = row._calc
                return (
                  <tr key={row.id}>
                    <td>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {row.varenummer || '—'}
                      </span>
                    </td>
                    <td className="td-product">
                      <div className="product-name">{row.produkt}</div>
                      <div className="product-brand">{row.merke}</div>
                    </td>
                    {retailers.map(r => {
                      const val = row[r.key]
                      const isMin = val != null && val === c.min && c.max !== c.min
                      const isMax = val != null && val === c.max && c.max !== c.min
                      return (
                        <td key={r.key} className="td-price" data-label={r.label}>
                          {val == null ? (
                            <span className="price-null">—</span>
                          ) : (
                            <span className={`price-val ${isMin ? 'price-lowest' : isMax ? 'price-highest' : ''}`}>
                              {fmt(val)}
                              {isMin && <span className="price-dot" style={{ background: '#1D6A3A' }}></span>}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td className="td-price" data-label="Lavest">
                      {c.min != null ? (
                        <span className="price-val price-lowest">{fmt(c.min)}</span>
                      ) : <span className="price-null">—</span>}
                    </td>
                    <td className="td-price" data-label="Snitt">
                      {c.avg != null ? (
                        <span className="price-val">{fmt(c.avg)}</span>
                      ) : <span className="price-null">—</span>}
                    </td>
                    <td className="td-diff" data-label="Spread">
                      {c.spread != null && c.spread > 0 ? (
                        <span className="diff-val diff-pos">
                          +{fmt(c.spread)}{c.spreadPct != null ? ` (${c.spreadPct.toFixed(0)}%)` : ''}
                        </span>
                      ) : c.spread === 0 ? (
                        <span className="diff-val diff-zero">—</span>
                      ) : (
                        <span className="price-null">—</span>
                      )}
                    </td>
                    <td className="td-price" data-label="Billigst kjede" style={{ textAlign: 'right' }}>
                      {c.cheapest ? (
                        <span className="retailer-header" style={{ justifyContent: 'flex-end' }}>
                          <span className="retailer-dot" style={{ background: c.cheapest.color }}></span>
                          <span className="retailer-label">{c.cheapest.label}</span>
                        </span>
                      ) : <span className="price-null">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Footer left={'Karo Healthcare Norway · Priskart solpleie'} />
    </div>
  )
}
