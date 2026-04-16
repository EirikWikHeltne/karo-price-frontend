'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { deriveRetailers } from '@/lib/retailers'
import { fmt } from '@/lib/format'

const TIME_RANGES = [
  { label: '7 dager', value: 7 },
  { label: '30 dager', value: 30 },
  { label: '90 dager', value: 90 },
  { label: 'Alt', value: 0 },
]

function HistoryTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">
        {new Date(label).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
      {payload.map(p => (
        <div key={p.name} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: p.color }}></span>
          {p.name}: {fmt(p.value)} kr
        </div>
      ))}
    </div>
  )
}

export default function HistorikkPage() {
  const [products, setProducts] = useState([])
  const [historyData, setHistoryData] = useState([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [dager, setDager] = useState(30)
  const [kategori, setKategori] = useState('alle')
  const [search, setSearch] = useState('')
  const [tableNotFound, setTableNotFound] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  // Load product list and last updated date
  useEffect(() => {
    Promise.all([
      fetch('/api/produkter', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
      fetch('/api/siste-oppdatering', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
    ]).then(([productData, updData]) => {
      setProducts(productData || [])
      setLoading(false)
      if (updData?.dato) {
        setLastUpdated(new Date(updData.dato + 'T12:00:00'))
      } else if (productData?.length) {
        const dates = productData.map(r => r.sist_oppdatert).filter(Boolean).sort()
        if (dates.length) setLastUpdated(new Date(dates[dates.length - 1]))
      }
    })
  }, [])

  // Fetch history when product is selected
  const fetchHistory = useCallback(async (product) => {
    if (!product) return
    setHistoryLoading(true)
    setTableNotFound(false)
    setHistoryError(null)
    try {
      const params = new URLSearchParams()
      if (product.varenummer) params.set('varenummer', product.varenummer)
      else params.set('produkt', product.produkt)
      params.set('dager', dager.toString())

      const res = await fetch(`/api/historikk?${params}`, { cache: 'no-store' })
      const json = await res.json()

      if (json.code === 'TABLE_NOT_FOUND') {
        setTableNotFound(true)
        setHistoryData([])
      } else if (Array.isArray(json)) {
        setHistoryData(json)
      } else {
        setHistoryError(json.error || 'Kunne ikke hente prishistorikk')
        setHistoryData([])
      }
    } catch {
      setHistoryError('Kunne ikke hente prishistorikk. Prøv igjen.')
      setHistoryData([])
    }
    setHistoryLoading(false)
  }, [dager])

  useEffect(() => {
    if (selectedProduct) fetchHistory(selectedProduct)
  }, [selectedProduct, fetchHistory])

  const retailers = useMemo(() => {
    const all = [...products, ...historyData]
    return deriveRetailers(all)
  }, [products, historyData])

  const categories = useMemo(() => {
    return [...new Set(products.map(r => r.kategori).filter(Boolean))].sort()
  }, [products])

  const filteredProducts = useMemo(() => {
    let d = products
    if (kategori !== 'alle') d = d.filter(r => r.kategori === kategori)
    if (search) {
      const s = search.toLowerCase()
      d = d.filter(r =>
        (r.produkt || '').toLowerCase().includes(s) ||
        (r.merke || '').toLowerCase().includes(s) ||
        (r.varenummer || '').toLowerCase().includes(s)
      )
    }
    return d
  }, [products, kategori, search])

  // Format history data for the chart
  const chartData = useMemo(() => {
    if (!historyData.length) return []
    const byDate = {}
    historyData.forEach(row => {
      const date = row.dato?.slice(0, 10) || row.sist_oppdatert?.slice(0, 10)
      if (!date) return
      if (!byDate[date]) byDate[date] = { dato: date }
      retailers.forEach(r => {
        if (row[r.key] != null) byDate[date][r.key] = Number(row[r.key])
      })
    })
    return Object.values(byDate).sort((a, b) => a.dato.localeCompare(b.dato))
  }, [historyData, retailers])

  function handleProductSelect(p) {
    setSelectedProduct(p)
    // On mobile, collapse sidebar after selection
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setSidebarOpen(false)
    }
  }

  return (
    <div className="app">
      <Header active="/historikk" lastUpdated={lastUpdated} />

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
      </div>

      <div className="historikk-layout">
        {/* Product list sidebar */}
        <div className={`historikk-sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
          <button className="historikk-sidebar-header" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)' }}>
              Velg produkt ({filteredProducts.length})
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>{sidebarOpen ? '▲' : '▼'}</span>
          </button>
          {sidebarOpen && (
            <>
              {loading ? (
                <div className="loading"><div className="spinner"></div> Laster...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="empty" style={{ padding: '2rem' }}>
                  <div className="empty-text">Ingen produkter funnet</div>
                </div>
              ) : (
                <div className="historikk-product-list">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      className={`historikk-product-item ${selectedProduct?.id === p.id ? 'active' : ''}`}
                      onClick={() => handleProductSelect(p)}
                    >
                      <div className="product-name">{p.produkt}</div>
                      <div className="product-brand">{p.merke}</div>
                      <div className="product-vn">{p.varenummer}</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Chart area */}
        <div className="historikk-main">
          {!selectedProduct ? (
            <div className="empty" style={{ padding: '4rem' }}>
              <div className="empty-icon">&#9716;</div>
              <div className="empty-text">Velg et produkt fra listen for å se prishistorikk</div>
            </div>
          ) : (
            <>
              <div className="historikk-chart-header">
                <div>
                  <h2 className="chart-title">{selectedProduct.produkt}</h2>
                  <p className="chart-desc">{selectedProduct.merke} &middot; {selectedProduct.varenummer} &middot; {selectedProduct.kategori}</p>
                </div>
                <div className="filter-tabs">
                  {TIME_RANGES.map(r => (
                    <button
                      key={r.value}
                      className={`tab ${dager === r.value ? 'active' : ''}`}
                      onClick={() => setDager(r.value)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current prices card */}
              <div className="historikk-current-prices">
                <div className="historikk-prices-label">Nåværende priser</div>
                <div className="historikk-prices-grid">
                  {retailers.map(r => (
                    <div key={r.key} className="historikk-price-card">
                      <span className="retailer-dot" style={{ background: r.color }}></span>
                      <span className="historikk-price-retailer">{r.label}</span>
                      <span className="historikk-price-value">
                        {selectedProduct[r.key] != null
                          ? `${fmt(selectedProduct[r.key])} kr`
                          : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {historyError ? (
                <div className="chart-card" style={{ marginTop: '1rem' }}>
                  <div className="empty" style={{ padding: '3rem' }}>
                    <div className="empty-icon">&#9888;</div>
                    <div className="empty-text">{historyError}</div>
                    <button
                      className="tab active"
                      style={{ marginTop: '1rem' }}
                      onClick={() => fetchHistory(selectedProduct)}
                    >
                      Prøv igjen
                    </button>
                  </div>
                </div>
              ) : tableNotFound ? (
                <div className="chart-card" style={{ marginTop: '1rem' }}>
                  <div className="empty" style={{ padding: '3rem' }}>
                    <div className="empty-icon">&#128202;</div>
                    <div className="empty-text">Prishistorikk er ikke tilgjengelig ennå</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                      Historiske prisdata vil vises her når data er tilgjengelig.
                    </p>
                  </div>
                </div>
              ) : historyLoading ? (
                <div className="loading" style={{ padding: '4rem' }}>
                  <div className="spinner"></div> Henter prishistorikk...
                </div>
              ) : chartData.length === 0 ? (
                <div className="chart-card" style={{ marginTop: '1rem' }}>
                  <div className="empty" style={{ padding: '3rem' }}>
                    <div className="empty-icon">&#128202;</div>
                    <div className="empty-text">Ingen historiske data for dette produktet</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                      Det finnes ingen prishistorikk for den valgte perioden.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="chart-card" style={{ marginTop: '1rem' }}>
                  <h3 className="chart-title">Prisutvikling</h3>
                  <p className="chart-desc">{chartData.length} datapunkter i perioden</p>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="dato"
                        tick={{ fontSize: 10, fontFamily: 'DM Mono' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v => new Date(v).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fontFamily: 'DM Mono' }}
                        axisLine={false}
                        tickLine={false}
                        width={55}
                        tickFormatter={v => `${v} kr`}
                      />
                      <Tooltip content={<HistoryTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: '0.75rem', fontFamily: 'DM Mono' }}
                      />
                      {retailers.map(r => (
                        <Line
                          key={r.key}
                          type="monotone"
                          dataKey={r.key}
                          name={r.label}
                          stroke={r.color}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                  {chartData.length === 1 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.75rem', textAlign: 'center' }}>
                      Kun nåværende priser tilgjengelig — historiske data vil bygges opp over tid.
                    </p>
                  )}
                </div>
              )}

              {/* History table */}
              {chartData.length > 0 && (
                <div className="chart-card" style={{ marginTop: '1rem' }}>
                  <h3 className="chart-title">Prisdata</h3>
                  <div className="table-wrap" style={{ padding: 0 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Dato</th>
                          {retailers.map(r => (
                            <th key={r.key} style={{ textAlign: 'right' }}>
                              <div className="retailer-header" style={{ justifyContent: 'flex-end' }}>
                                <span className="retailer-dot" style={{ background: r.color }}></span>
                                <span className="retailer-label">{r.label}</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...chartData].reverse().map(row => (
                          <tr key={row.dato}>
                            <td>{new Date(row.dato).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                            {retailers.map(r => (
                              <td key={r.key} className="td-price">
                                {row[r.key] != null
                                  ? <span className="price-val">{fmt(row[r.key])}</span>
                                  : <span className="price-null">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
