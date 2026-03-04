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
    fetch('/api/priser')
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

  // Chart 1: Average price per retailer by category
  const avgByCategory = useMemo(() => {
    const cats = kategori !== 'alle' ? [kategori] : categories
    return cats.map(cat => {
      const rows = (merke !== 'alle' ? filtered : data).filter(r => r.kategori === cat)
      const entry = { kategori: cat }
      RETAILERS.forEach(r => {
        const vals = rows.map(row => row[r.key]).filter(v => v != null)
        entry[r.label] = vals.length ? +(vals.reduce((s, v) => s + Number(v), 0) / vals.length).toFixed(2) : null
      })
      return entry
    })
  }, [data, filtered, categories, kategori, merke])

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
        return { name: row.produkt?.slice(0, 30), spread: +(max - min).toFixed(2), min, max }
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
            <span className="chart-tooltip-dot" style={{ background: p.color }}></span>
            {p.name}: {fmt(p.value)} kr
          </div>
        ))}
      </div>
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
            <span className="nav-link active">Grafer</span>
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
            <p className="chart-desc">Snittpris per kategori fordelt på apotek</p>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={avgByCategory} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="kategori" tick={{ fontSize: 11, fontFamily: 'DM Mono' }} angle={-20} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fontFamily: 'DM Mono' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'DM Mono' }} />
                {RETAILERS.map(r => (
                  <Bar key={r.key} dataKey={r.label} fill={r.color} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3 className="chart-title">Billigst oftest</h3>
            <p className="chart-desc">Hvilken kjede har lavest pris flest ganger</p>
            <ResponsiveContainer width="100%" height={340}>
              <PieChart>
                <Pie
                  data={cheapestDist}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label={({ name, value }) => `${name} (${value})`}
                  labelLine={{ stroke: 'var(--text-faint)' }}
                  style={{ fontSize: 11, fontFamily: 'DM Mono' }}
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
            <h3 className="chart-title">Topp 10 st&#248;rst prisforskjell</h3>
            <p className="chart-desc">Produkter med st&#248;rst differanse mellom billigst og dyrest</p>
            {topSpread.length === 0 ? (
              <div className="empty" style={{ padding: '2rem' }}>
                <div className="empty-text">For f&#229; priser &#229; sammenligne</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(300, topSpread.length * 40)}>
                <BarChart data={topSpread} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11, fontFamily: 'DM Mono' }} />
                  <YAxis dataKey="name" type="category" width={160} tick={{ fontSize: 11, fontFamily: 'DM Mono' }} />
                  <Tooltip formatter={(v) => `${fmt(v)} kr`} labelStyle={{ fontFamily: 'DM Mono' }} />
                  <Bar dataKey="spread" name="Prisforskjell" fill="var(--red)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      <footer className="footer">
        <span>Karo Healthcare Norway · Prisdata fra Farmasiet, Boots, Vitusapotek, Apotek 1</span>
        <span>Oppdateres daglig kl. 03:00</span>
      </footer>
    </div>
  )
}
