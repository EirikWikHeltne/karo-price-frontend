'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area,
} from 'recharts'
import { deriveRetailers, fmt, fmtShort } from '@/lib/retailers'

const CATEGORIES = ['alle', 'Body lotion', 'Paracetamol', 'Mouthwash', 'Intimate', 'Ibuprofen']

const CAT_CLASS = {
  'Body lotion': 'cat-lotion',
  'Paracetamol': 'cat-paracetamol',
  'Mouthwash':   'cat-mouthwash',
  'Intimate':    'cat-intimate',
  'Ibuprofen':   'cat-ibuprofen',
}

const TIME_PERIODS = [
  { label: 'Alle', value: 'all' },
  { label: 'Siste 24t', value: '1' },
  { label: 'Siste 7d', value: '7' },
  { label: 'Siste 30d', value: '30' },
  { label: 'Siste 90d', value: '90' },
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map(p => (
        <div key={p.name || p.dataKey} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: p.payload?.color || p.color || p.fill }}></span>
          {p.name}: {fmt(p.value)} kr
        </div>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-dot" style={{ background: payload[0].payload?.color }}></span>
        {payload[0].name}: {payload[0].value} produkter
      </div>
    </div>
  )
}

function renderPieLabel({ name, value, cx, x }) {
  const anchor = x > cx ? 'start' : 'end'
  return (
    <text x={x} y={0} textAnchor={anchor} fontSize={11} fontFamily="DM Mono" fill="var(--text)">
      {name} ({value})
    </text>
  )
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
  const [timePeriod, setTimePeriod]   = useState('all')
  const [showGraphs, setShowGraphs]   = useState(true)
  const [mobileNav, setMobileNav]     = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (kategori !== 'alle') params.set('kategori', kategori)
      if (search) params.set('search', search)

      const [res, updRes] = await Promise.all([
        fetch(`/api/priser?${params}`, { cache: 'no-store' }),
        fetch('/api/siste-oppdatering', { cache: 'no-store' }).catch(() => null),
      ])

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`)
      }
      const json = await res.json()
      setData(json || [])

      if (updRes?.ok) {
        try {
          const { dato } = await updRes.json()
          if (dato) setLastUpdated(new Date(dato + 'T12:00:00'))
        } catch (_) {
          if (json?.length) {
            const dates = json.map(r => r.sist_oppdatert).filter(Boolean).sort()
            if (dates.length) setLastUpdated(new Date(dates[dates.length - 1]))
          }
        }
      } else if (json?.length) {
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

  const retailers = useMemo(() => deriveRetailers(data), [data])

  const brands = useMemo(() => {
    if (!data.length) return []
    return [...new Set(data.map(r => r.merke).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  }, [data])

  // Filter by time period based on sist_oppdatert
  const timeFiltered = useMemo(() => {
    if (timePeriod === 'all' || !data.length) return data
    const days = parseInt(timePeriod, 10)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return data.filter(r => {
      if (!r.sist_oppdatert) return false
      return new Date(r.sist_oppdatert) >= cutoff
    })
  }, [data, timePeriod])

  const sorted = useMemo(() => {
    if (!timeFiltered.length) return []
    let filtered = timeFiltered
    if (merke !== 'alle') filtered = filtered.filter(r => r.merke === merke)
    return [...filtered].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (av === null || av === undefined) av = sortDir === 'asc' ? Infinity : -Infinity
      if (bv === null || bv === undefined) bv = sortDir === 'asc' ? Infinity : -Infinity
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [timeFiltered, merke, sortCol, sortDir])

  const stats = useMemo(() => {
    if (!timeFiltered.length) return {}
    const withPrices = timeFiltered.filter(r => r.laveste_pris)
    const avgLow = withPrices.reduce((s,r) => s + Number(r.laveste_pris), 0) / (withPrices.length || 1)
    const avgHigh = withPrices.reduce((s,r) => s + Number(r.hoyeste_pris), 0) / (withPrices.length || 1)
    const coverage = retailers.map(r => ({
      ...r,
      count: timeFiltered.filter(row => row[r.key] !== null && row[r.key] !== undefined).length
    }))
    return { avgLow, avgHigh, coverage, total: timeFiltered.length }
  }, [timeFiltered, retailers])

  // --- Graph data ---

  // Average price per retailer
  const avgByRetailer = useMemo(() => {
    if (!sorted.length) return []
    return retailers.map(r => {
      const vals = sorted.map(row => row[r.key]).filter(v => v != null).map(Number)
      return {
        name: r.label,
        snitt: vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : 0,
        color: r.color,
      }
    })
  }, [sorted, retailers])

  // Cheapest retailer distribution
  const cheapestDist = useMemo(() => {
    if (!sorted.length) return []
    const counts = {}
    retailers.forEach(r => { counts[r.label] = 0 })
    sorted.forEach(row => {
      let min = Infinity, winner = null
      retailers.forEach(r => {
        if (row[r.key] != null && Number(row[r.key]) < min) {
          min = Number(row[r.key]); winner = r.label
        }
      })
      if (winner) counts[winner]++
    })
    return retailers.map(r => ({ name: r.label, value: counts[r.label], color: r.color })).filter(e => e.value > 0)
  }, [sorted, retailers])

  // Price range distribution (histogram-like)
  const priceDistribution = useMemo(() => {
    if (!sorted.length) return []
    const prices = sorted.map(r => r.laveste_pris).filter(v => v != null).map(Number)
    if (!prices.length) return []
    const min = Math.floor(Math.min(...prices))
    const max = Math.ceil(Math.max(...prices))
    const step = Math.max(1, Math.ceil((max - min) / 8))
    const buckets = []
    for (let i = min; i < max; i += step) {
      const lo = i
      const hi = i + step
      const count = prices.filter(p => p >= lo && p < hi).length
      buckets.push({ range: `${fmtShort(lo)}-${fmtShort(hi)}`, count, lo, hi })
    }
    return buckets
  }, [sorted])

  // Category comparison radar
  const categoryRadar = useMemo(() => {
    if (!sorted.length) return []
    const cats = [...new Set(sorted.map(r => r.kategori).filter(Boolean))]
    return cats.map(cat => {
      const catRows = sorted.filter(r => r.kategori === cat)
      const result = { kategori: cat }
      retailers.forEach(r => {
        const vals = catRows.map(row => row[r.key]).filter(v => v != null).map(Number)
        result[r.key] = vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : 0
      })
      return result
    })
  }, [sorted, retailers])

  // Spread distribution by category
  const spreadByCategory = useMemo(() => {
    if (!sorted.length) return []
    const cats = [...new Set(sorted.map(r => r.kategori).filter(Boolean))]
    return cats.map(cat => {
      const catRows = sorted.filter(r => r.kategori === cat)
      const spreads = catRows.map(row => {
        const prices = retailers.map(r => row[r.key]).filter(v => v != null).map(Number)
        if (prices.length < 2) return 0
        return Math.max(...prices) - Math.min(...prices)
      }).filter(s => s > 0)
      const avgSpread = spreads.length ? +(spreads.reduce((s, v) => s + v, 0) / spreads.length).toFixed(2) : 0
      const maxSpread = spreads.length ? +Math.max(...spreads).toFixed(2) : 0
      return { name: cat, snittSpread: avgSpread, maxSpread }
    }).sort((a, b) => b.snittSpread - a.snittSpread)
  }, [sorted, retailers])

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const renderSortIcon = (col) => {
    if (sortCol !== col) return <span style={{opacity:0.3}}>↕</span>
    return <span>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function downloadExcel() {
    const rows = sorted.map(row => {
      const prices = retailers.map(r => row[r.key]).filter(v => v != null)
      const min = prices.length ? Math.min(...prices) : null
      const max = prices.length ? Math.max(...prices) : null
      const obj = {
        Produkt: row.produkt,
        Merke: row.merke,
        Varenummer: row.varenummer,
        Kategori: row.kategori,
      }
      retailers.forEach(r => { obj[r.label] = row[r.key] ?? null })
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
        {lastUpdated && (
          <div className="header-meta-mobile">
            <span className="header-dot"></span>
            {`Oppdatert ${lastUpdated.toLocaleDateString('nb-NO', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`}
          </div>
        )}
        <button className="mobile-nav-toggle" onClick={() => setMobileNav(!mobileNav)} aria-label="Meny">
          <span></span><span></span><span></span>
        </button>
        <div className={`header-right ${mobileNav ? 'open' : ''}`}>
          <nav className="header-nav">
            <span className="nav-link active">Tabell</span>
            <Link href="/historikk" className="nav-link" onClick={() => setMobileNav(false)}>Historikk</Link>
            <Link href="/grafer" className="nav-link" onClick={() => setMobileNav(false)}>Grafer</Link>
            <Link href="/produkter" className="nav-link" onClick={() => setMobileNav(false)}>Produkter</Link>
            <Link href="/sammenlign" className="nav-link" onClick={() => setMobileNav(false)}>Sammenlign</Link>
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
          <span className="search-icon">&#x1F50D;</span>
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

      {/* Time period filter */}
      <div className="time-filter-bar">
        <span className="time-filter-label">Tidsperiode:</span>
        <div className="filter-tabs">
          {TIME_PERIODS.map(tp => (
            <button
              key={tp.value}
              className={`tab ${timePeriod === tp.value ? 'active' : ''}`}
              onClick={() => setTimePeriod(tp.value)}
            >
              {tp.label}
            </button>
          ))}
        </div>
        <button
          className={`tab tab-toggle ${showGraphs ? 'active' : ''}`}
          onClick={() => setShowGraphs(!showGraphs)}
        >
          {showGraphs ? 'Skjul grafer' : 'Vis grafer'}
        </button>
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

      {/* Summary Graphs */}
      {showGraphs && !loading && sorted.length > 0 && (
        <div className="charts-grid table-charts">
          {/* Average price per retailer */}
          <div className="chart-card">
            <h3 className="chart-title">Snittpris per apotek</h3>
            <p className="chart-desc">Gjennomsnittlig pris basert på {sorted.length} produkter</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={avgByRetailer} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg)' }} />
                <Bar dataKey="snitt" name="Snittpris" radius={[4, 4, 0, 0]}>
                  {avgByRetailer.map(e => <Cell key={e.name} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cheapest retailer pie */}
          <div className="chart-card">
            <h3 className="chart-title">Billigst oftest</h3>
            <p className="chart-desc">Hvilken kjede har lavest pris flest ganger</p>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={cheapestDist}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={35}
                  label={renderPieLabel}
                  labelLine={{ stroke: 'var(--text-faint)' }}
                >
                  {cheapestDist.map(e => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Price distribution histogram */}
          {priceDistribution.length > 0 && (
            <div className="chart-card">
              <h3 className="chart-title">Prisfordeling</h3>
              <p className="chart-desc">Fordeling av laveste priser (kr)</p>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={priceDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="range" tick={{ fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v) => [`${v} produkter`, 'Antall']} labelStyle={{ fontFamily: 'DM Mono' }} />
                  <Area type="monotone" dataKey="count" name="Antall" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Spread by category */}
          {spreadByCategory.length > 1 && (
            <div className="chart-card">
              <h3 className="chart-title">Prisforskjeller per kategori</h3>
              <p className="chart-desc">Gjennomsnittlig og maks spread mellom kjedene</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={spreadByCategory} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v) => `${fmt(v)} kr`} labelStyle={{ fontFamily: 'DM Mono' }} />
                  <Bar dataKey="snittSpread" name="Snitt spread" fill="var(--amber)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="maxSpread" name="Maks spread" fill="var(--red)" radius={[4, 4, 0, 0]} opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Radar chart for category comparison */}
          {categoryRadar.length > 2 && (
            <div className="chart-card chart-card-wide">
              <h3 className="chart-title">Kategoriprofil per apotek</h3>
              <p className="chart-desc">Gjennomsnittspriser per kategori og kjede</p>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={categoryRadar} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="kategori" tick={{ fontSize: 11, fontFamily: 'DM Mono', fill: 'var(--text)' }} />
                  <PolarRadiusAxis tick={{ fontSize: 10, fontFamily: 'DM Mono' }} />
                  {retailers.map(r => (
                    <Radar key={r.key} name={r.label} dataKey={r.key} stroke={r.color} fill={r.color} fillOpacity={0.1} strokeWidth={2} />
                  ))}
                  <Tooltip formatter={(v) => `${fmt(v)} kr`} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
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
        ) : sorted.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">&#9678;</div>
            <div className="empty-text">Ingen produkter funnet{timePeriod !== 'all' ? ' i valgt tidsperiode' : ''}</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('produkt')} className={sortCol==='produkt'?'sorted':''}>
                  Produkt {renderSortIcon('produkt')}
                </th>
                <th onClick={() => handleSort('kategori')} className={`th-category ${sortCol==='kategori'?'sorted':''}`}>
                  Kategori {renderSortIcon('kategori')}
                </th>
                {retailers.map(r => (
                  <th key={r.key} onClick={() => handleSort(r.key)} className={`th-price ${sortCol===r.key?'sorted':''}`} style={{textAlign:'right'}}>
                    <div className="retailer-header" style={{justifyContent:'flex-end'}}>
                      <span className="retailer-dot" style={{background: r.color}}></span>
                      <span className="retailer-label">{r.label}</span> {renderSortIcon(r.key)}
                    </div>
                  </th>
                ))}
                <th onClick={() => handleSort('laveste_pris')} className={sortCol==='laveste_pris'?'sorted':''} style={{textAlign:'right'}}>
                  Lavest {renderSortIcon('laveste_pris')}
                </th>
                <th style={{textAlign:'right'}}>Spread</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => {
                const prices = retailers.map(r => row[r.key]).filter(v => v !== null && v !== undefined)
                const min = prices.length ? Math.min(...prices) : null
                const max = prices.length ? Math.max(...prices) : null
                const spread = min != null && max != null ? max - min : null

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
                    {retailers.map(r => {
                      const val = row[r.key]
                      const isMin = val !== null && val !== undefined && val === min && prices.length > 1
                      const isMax = val !== null && val !== undefined && val === max && prices.length > 1 && min !== max
                      return (
                        <td key={r.key} className="td-price" data-label={r.label}>
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
                    <td className="td-price" data-label="Lavest">
                      {min != null ? (
                        <span className="price-val price-lowest">{fmt(min)}</span>
                      ) : <span className="price-null">—</span>}
                    </td>
                    <td className="td-diff" data-label="Spread">
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
        <span>Karo Healthcare Norway &middot; Prisdata fra Farmasiet, Boots, Vitusapotek, Apotek 1</span>
        <span>Oppdateres daglig kl. 03:00</span>
      </footer>
    </div>
  )
}
