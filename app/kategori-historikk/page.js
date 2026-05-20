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
import { CAT_CLASS } from '@/lib/categories'

const TIME_RANGES = [
  { label: '7 dager', value: 7 },
  { label: '30 dager', value: 30 },
  { label: '90 dager', value: 90 },
  { label: '1 år', value: 365 },
  { label: 'Alt', value: 0 },
]

const CATEGORY_COLORS = [
  '#2563EB', '#E11D48', '#059669', '#7C3AED',
  '#D97706', '#0891B2', '#BE185D', '#65A30D',
]

function CategoryTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">
        {new Date(label).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
      {payload.map(p => (
        <div key={p.name || p.dataKey} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: p.color }}></span>
          {p.name}: {fmt(p.value)} kr
        </div>
      ))}
    </div>
  )
}

export default function KategoriHistorikkPage() {
  const [data, setData]                       = useState([])
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState(null)
  const [tableNotFound, setTableNotFound]     = useState(false)
  const [dager, setDager]                     = useState(90)
  const [retailerKey, setRetailerKey]         = useState('snitt')
  const [hiddenCategories, setHiddenCategories] = useState(() => new Set())
  const [lastUpdated, setLastUpdated]         = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    setTableNotFound(false)
    try {
      const params = new URLSearchParams()
      params.set('dager', String(dager))
      const [res, updRes] = await Promise.all([
        fetch(`/api/kategori-historikk?${params}`, { cache: 'no-store' }),
        fetch('/api/siste-oppdatering', { cache: 'no-store' }).catch(() => null),
      ])

      if (!res.ok && res.status !== 404) {
        throw new Error(`Server error: ${res.status}`)
      }
      const json = await res.json()
      if (json?.code === 'TABLE_NOT_FOUND') {
        setTableNotFound(true)
        setData([])
      } else if (Array.isArray(json)) {
        setData(json)
      } else {
        setError(json?.error || 'Kunne ikke hente data')
        setData([])
      }

      if (updRes?.ok) {
        try {
          const { dato } = await updRes.json()
          if (dato) setLastUpdated(new Date(dato + 'T12:00:00'))
        } catch (_) { /* noop */ }
      }
    } catch (e) {
      console.error(e)
      setError('Kunne ikke hente data. Prøv igjen.')
      setData([])
    }
    setLoading(false)
  }, [dager])

  useEffect(() => { fetchData() }, [fetchData])

  const retailers = useMemo(() => deriveRetailers(data), [data])

  const categories = useMemo(() => {
    return [...new Set(data.map(r => r.kategori).filter(Boolean))].sort()
  }, [data])

  const categoryColors = useMemo(() => {
    const map = {}
    categories.forEach((c, i) => { map[c] = CATEGORY_COLORS[i % CATEGORY_COLORS.length] })
    return map
  }, [categories])

  const retailerOptions = useMemo(() => {
    return [{ key: 'snitt', label: 'Snitt (alle apotek)', color: 'var(--accent)' }, ...retailers]
  }, [retailers])

  const visibleCategories = useMemo(
    () => categories.filter(c => !hiddenCategories.has(c)),
    [categories, hiddenCategories]
  )

  // Comparison chart data: one row per date with a numeric column per category
  const compareChart = useMemo(() => {
    if (!data.length) return []
    const byDate = {}
    data.forEach(r => {
      if (!r.dato || !r.kategori) return
      if (!byDate[r.dato]) byDate[r.dato] = { dato: r.dato }
      const val = r[retailerKey]
      if (val != null) byDate[r.dato][r.kategori] = Number(val)
    })
    return Object.values(byDate).sort((a, b) => a.dato.localeCompare(b.dato))
  }, [data, retailerKey])

  // Per-category mini-chart series for breakdown grid (all retailers)
  const breakdownByCategory = useMemo(() => {
    const out = {}
    visibleCategories.forEach(cat => {
      out[cat] = data
        .filter(r => r.kategori === cat)
        .sort((a, b) => (a.dato || '').localeCompare(b.dato || ''))
    })
    return out
  }, [data, visibleCategories])

  // Summary stats for the active retailer
  const summary = useMemo(() => {
    return categories.map(cat => {
      const rows = data
        .filter(r => r.kategori === cat && r[retailerKey] != null)
        .sort((a, b) => (a.dato || '').localeCompare(b.dato || ''))
      if (!rows.length) {
        return { kategori: cat, current: null, first: null, change: null, changePct: null, min: null, max: null, points: 0 }
      }
      const first = Number(rows[0][retailerKey])
      const current = Number(rows[rows.length - 1][retailerKey])
      const change = current - first
      const changePct = first ? (change / first) * 100 : null
      const vals = rows.map(r => Number(r[retailerKey]))
      return {
        kategori: cat,
        current,
        first,
        change,
        changePct,
        min: Math.min(...vals),
        max: Math.max(...vals),
        points: rows.length,
        antall: rows[rows.length - 1].antall ?? null,
      }
    })
  }, [data, categories, retailerKey])

  function toggleCategoryVisibility(cat) {
    setHiddenCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const activeRetailerLabel =
    retailerOptions.find(r => r.key === retailerKey)?.label || 'Snitt'

  const onlyOneDate = compareChart.length === 1

  return (
    <div className="app">
      <Header active="/kategori-historikk" lastUpdated={lastUpdated} />

      <div className="controls">
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
        <select
          className="brand-select"
          value={retailerKey}
          onChange={e => setRetailerKey(e.target.value)}
        >
          {retailerOptions.map(r => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
        <div className="controls-right">
          <span className="count-badge">{categories.length} kategorier</span>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="time-filter-bar">
          <span className="time-filter-label">Kategorier:</span>
          <div className="filter-tabs">
            {categories.map(cat => {
              const hidden = hiddenCategories.has(cat)
              return (
                <button
                  key={cat}
                  className={`tab ${!hidden ? 'active' : ''}`}
                  style={
                    !hidden
                      ? {
                          background: categoryColors[cat],
                          borderColor: categoryColors[cat],
                          color: 'white',
                        }
                      : undefined
                  }
                  onClick={() => toggleCategoryVisibility(cat)}
                  title={hidden ? `Vis ${cat}` : `Skjul ${cat}`}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner"></div> Henter prishistorikk...</div>
      ) : error ? (
        <div className="empty">
          <div className="empty-icon">&#9888;</div>
          <div className="empty-text">{error}</div>
          <button className="tab active" style={{ marginTop: '1rem' }} onClick={fetchData}>
            Prøv igjen
          </button>
        </div>
      ) : tableNotFound ? (
        <div className="empty">
          <div className="empty-icon">&#128202;</div>
          <div className="empty-text">Prishistorikk er ikke tilgjengelig ennå</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem', maxWidth: 420 }}>
            Historiske prisdata vil vises her når data er tilgjengelig.
          </p>
        </div>
      ) : categories.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">&#9678;</div>
          <div className="empty-text">Ingen data å vise for valgt periode</div>
        </div>
      ) : (
        <>
          {/* Per-category summary cards */}
          <div className="stats-bar">
            {summary.map(s => {
              const dir = s.change == null ? 0 : s.change > 0 ? 1 : s.change < 0 ? -1 : 0
              const arrow = dir > 0 ? '↑' : dir < 0 ? '↓' : '→'
              const changeColor =
                dir > 0 ? 'var(--red)' : dir < 0 ? 'var(--green)' : 'var(--text-faint)'
              return (
                <div key={s.kategori} className="stat" style={{ minWidth: 140 }}>
                  <span className="stat-label" style={{ color: categoryColors[s.kategori] }}>
                    {s.kategori}
                  </span>
                  <span className="stat-value">
                    {s.current != null ? `${fmt(s.current)} kr` : '—'}
                  </span>
                  <span className="stat-sub" style={{ color: changeColor }}>
                    {s.change == null
                      ? '—'
                      : `${arrow} ${fmt(Math.abs(s.change))} kr${
                          s.changePct != null
                            ? ` (${s.changePct > 0 ? '+' : ''}${s.changePct.toFixed(1)}%)`
                            : ''
                        }`}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="charts-grid">
            {/* Main comparison line chart */}
            <div className="chart-card chart-card-wide">
              <h3 className="chart-title">Prisutvikling per kategori</h3>
              <p className="chart-desc">
                Snittpris ({activeRetailerLabel.toLowerCase()}) over tid — klikk på kategori for å skjule
              </p>
              {compareChart.length === 0 ? (
                <div className="empty" style={{ padding: '3rem' }}>
                  <div className="empty-text">Ingen data for valgt apotek</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={380}>
                  <LineChart data={compareChart} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
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
                    <Tooltip content={<CategoryTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '0.75rem', fontFamily: 'DM Mono' }} />
                    {visibleCategories.map(cat => (
                      <Line
                        key={cat}
                        type="monotone"
                        dataKey={cat}
                        name={cat}
                        stroke={categoryColors[cat]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
              {onlyOneDate && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.75rem', textAlign: 'center' }}>
                  Kun ett datapunkt tilgjengelig — historiske data vil bygges opp over tid.
                </p>
              )}
            </div>

            {/* Per-category breakdown: each category's all-retailer chart */}
            {visibleCategories.map(cat => {
              const series = breakdownByCategory[cat] || []
              if (!series.length) return null
              return (
                <div key={cat} className="chart-card">
                  <h3 className="chart-title">
                    <span className={`cat-pill ${CAT_CLASS[cat] || ''}`} style={{ marginRight: 8 }}>
                      {cat}
                    </span>
                  </h3>
                  <p className="chart-desc">Snitt per apotek &middot; {series.length} datapunkter</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="dato"
                        tick={{ fontSize: 10, fontFamily: 'DM Mono' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v => new Date(v).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fontFamily: 'DM Mono' }}
                        axisLine={false}
                        tickLine={false}
                        width={45}
                        tickFormatter={v => `${v}`}
                      />
                      <Tooltip content={<CategoryTooltip />} />
                      {retailers.map(r => (
                        <Line
                          key={r.key}
                          type="monotone"
                          dataKey={r.key}
                          name={r.label}
                          stroke={r.color}
                          strokeWidth={1.5}
                          dot={false}
                          activeDot={{ r: 4 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )
            })}
          </div>

          {/* Summary table */}
          <div className="table-wrap">
            <h3 className="chart-title" style={{ marginBottom: '0.5rem' }}>Oppsummering</h3>
            <p className="chart-desc">Prisutvikling for {activeRetailerLabel.toLowerCase()} i valgt periode</p>
            <table>
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th style={{ textAlign: 'right' }}>Antall produkter</th>
                  <th style={{ textAlign: 'right' }}>Start</th>
                  <th style={{ textAlign: 'right' }}>Nå</th>
                  <th style={{ textAlign: 'right' }}>Endring</th>
                  <th style={{ textAlign: 'right' }}>%</th>
                  <th style={{ textAlign: 'right' }}>Min</th>
                  <th style={{ textAlign: 'right' }}>Maks</th>
                </tr>
              </thead>
              <tbody>
                {summary.map(s => {
                  const isUp = s.change != null && s.change > 0
                  const isDown = s.change != null && s.change < 0
                  return (
                    <tr key={s.kategori}>
                      <td>
                        <span className={`cat-pill ${CAT_CLASS[s.kategori] || ''}`}>{s.kategori}</span>
                      </td>
                      <td className="td-price">{s.antall ?? '—'}</td>
                      <td className="td-price">{s.first != null ? fmt(s.first) : '—'}</td>
                      <td className="td-price">
                        {s.current != null ? <strong>{fmt(s.current)}</strong> : '—'}
                      </td>
                      <td className="td-price" style={{ color: isUp ? 'var(--red)' : isDown ? 'var(--green)' : 'var(--text-faint)' }}>
                        {s.change == null ? '—' : `${isUp ? '+' : ''}${fmt(s.change)}`}
                      </td>
                      <td className="td-price" style={{ color: isUp ? 'var(--red)' : isDown ? 'var(--green)' : 'var(--text-faint)' }}>
                        {s.changePct == null ? '—' : `${s.changePct > 0 ? '+' : ''}${s.changePct.toFixed(1)}%`}
                      </td>
                      <td className="td-price">{s.min != null ? fmt(s.min) : '—'}</td>
                      <td className="td-price">{s.max != null ? fmt(s.max) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Footer />
    </div>
  )
}
