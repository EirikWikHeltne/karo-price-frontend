'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts'

const RETAILERS = [
  { key: 'farmasiet',   label: 'Farmasiet',   color: '#2563EB' },
  { key: 'boots',       label: 'Boots',       color: '#E11D48' },
  { key: 'vitusapotek', label: 'Vitusapotek', color: '#059669' },
  { key: 'apotek1',     label: 'Apotek 1',    color: '#7C3AED' },
]

function fmt(val) {
  if (val === null || val === undefined) return ''
  return Number(val).toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function GraferPage() {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [kategori, setKategori] = useState('alle')
  const [merke, setMerke]     = useState('alle')

  useEffect(() => {
    fetch('/api/priser', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setData(d || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const categories = useMemo(() => {
    return [...new Set(data.map(r => r.kategori).filter(Boolean))].sort()
  }, [data])

  const brands = useMemo(() => {
    let filtered = data
    if (kategori !== 'alle') filtered = filtered.filter(r => r.kategori === kategori)
    return [...new Set(filtered.map(r => r.merke).filter(Boolean))].sort()
  }, [data, kategori])

  const filtered = useMemo(() => {
    let d = data
    if (kategori !== 'alle') d = d.filter(r => r.kategori === kategori)
    if (merke !== 'alle') d = d.filter(r => r.merke === merke)
    return d
  }, [data, kategori, merke])

  // Chart 1: Average price per retailer — one bar group per retailer
  const avgByRetailer = useMemo(() => {
    return RETAILERS.map(r => {
      const vals = filtered.map(row => row[r.key]).filter(v => v != null).map(Number)
      return {
        name: r.label,
        snitt: vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : 0,
        color: r.color,
      }
    })
  }, [filtered])

  // Chart 2: Cheapest retailer distribution (pie)
  const cheapestDist = useMemo(() => {
    const counts = {}
    RETAILERS.forEach(r => { counts[r.label] = 0 })
    filtered.forEach(row => {
      let min = Infinity, winner = null
      RETAILERS.forEach(r => {
        if (row[r.key] != null && Number(row[r.key]) < min) {
          min = Number(row[r.key]); winner = r.label
        }
      })
      if (winner) counts[winner]++
    })
    return RETAILERS.map(r => ({ name: r.label, value: counts[r.label], color: r.color })).filter(e => e.value > 0)
  }, [filtered])

  // Chart 3: Top 10 products with biggest spread
  const topSpread = useMemo(() => {
    return filtered
      .map(row => {
        const prices = RETAILERS.map(r => row[r.key]).filter(v => v != null).map(Number)
        if (prices.length < 2) return null
        const min = Math.min(...prices)
        const max = Math.max(...prices)
        const label = row.produkt || ''
        return { name: label.length > 25 ? label.slice(0, 25) + '...' : label, spread: +(max - min).toFixed(2), min, max }
      })
      .filter(Boolean)
      .sort((a, b) => b.spread - a.spread)
      .slice(0, 10)
  }, [filtered])

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-label">{label}</div>
        {payload.map(p => (
          <div key={p.name} className="chart-tooltip-row">
            <span className="chart-tooltip-dot" style={{ background: p.payload?.color || p.color }}></span>
            {fmt(p.value)} kr
          </div>
        ))}
      </div>
    )
  }

  const renderPieLabel = ({ name, value, cx, x }) => {
    const anchor = x > cx ? 'start' : 'end'
    return (
      <text x={x} y={0} textAnchor={anchor} fontSize={11} fontFamily="DM Mono" fill="var(--text)">
        {name} ({value})
      </text>
    )
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
            <Link href="/" className="nav-link">Tabell</Link>
            <Link href="/historikk" className="nav-link">Historikk</Link>
            <span className="nav-link active">Grafer</span>
            <Link href="/produkter" className="nav-link">Produkter</Link>
          </nav>
        </div>
      </header>

      <div className="controls">
        <div className="filter-tabs">
          {['alle', ...categories].map(k => (
            <button
              key={k}
              className={`tab ${kategori === k ? 'active' : ''}`}
              onClick={() => { setKategori(k); setMerke('alle') }}
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
          <span className="count-badge">{filtered.length} produkter</span>
        </div>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          Henter data...
        </div>
      ) : (
        <div className="charts-grid">
          <div className="chart-card">
            <h3 className="chart-title">Gjennomsnittspris per apotek</h3>
            <p className="chart-desc">Snittpris basert på {filtered.length} produkter</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={avgByRetailer} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fontFamily: 'DM Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fontFamily: 'DM Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg)' }} />
                <Bar dataKey="snitt" name="Snittpris" radius={[4, 4, 0, 0]}>
                  {avgByRetailer.map(e => (
                    <Cell key={e.name} fill={e.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3 className="chart-title">Billigst oftest</h3>
            <p className="chart-desc">Hvilken kjede har lavest pris flest ganger</p>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={cheapestDist}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={40}
                  label={renderPieLabel}
                  labelLine={{ stroke: 'var(--text-faint)' }}
                >
                  {cheapestDist.map(e => (
                    <Cell key={e.name} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v} produkter`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card chart-card-wide">
            <h3 className="chart-title">Topp 10 største prisforskjeller</h3>
            <p className="chart-desc">Produkter med størst differanse mellom billigst og dyrest</p>
            {topSpread.length === 0 ? (
              <div className="empty" style={{ padding: '2rem' }}>
                <div className="empty-text">For få priser å sammenligne</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(260, topSpread.length * 36)}>
                <BarChart data={topSpread} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fontFamily: 'DM Mono' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={140}
                    tick={{ fontSize: 10, fontFamily: 'DM Mono' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={(v) => `${fmt(v)} kr`} labelStyle={{ fontFamily: 'DM Mono' }} />
                  <Bar dataKey="spread" name="Prisforskjell" fill="var(--red)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      <footer className="footer">
        <span>Karo Healthcare Norway</span>
        <span>Oppdateres daglig kl. 03:00</span>
      </footer>
    </div>
  )
}
