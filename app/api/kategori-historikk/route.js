import { getSupabase } from '@/lib/supabaseServer'
import { fetchAllRows } from '@/lib/fetchAllRows'

export const dynamic = 'force-dynamic'

const RETAILER_ID_COLS = ['kilde', 'apotek', 'kjede', 'retailer', 'butikk', 'pharmacy']
const PRICE_VAL_COLS = ['pris', 'price', 'verdi', 'value']
const NON_PRICE_COLS = new Set([
  'id', 'produkt', 'merke', 'varenummer', 'kategori',
  'sist_oppdatert', 'laveste_pris', 'hoyeste_pris', 'dato',
])

function normalizeRetailerKey(name) {
  const n = String(name).toLowerCase().trim()
  if (n.includes('apotek 1') || n === 'apotek1') return 'apotek1'
  if (n.includes('farmasiet')) return 'farmasiet'
  if (n.includes('boots')) return 'boots'
  if (n.includes('vitusapotek') || n.includes('vitus apotek')) return 'vitusapotek'
  return n.replace(/\s+/g, '_')
}

/**
 * If history rows are in long/normalized format (one row per retailer per
 * date), pivot to wide format. Otherwise return as-is.
 */
function pivotIfNeeded(rows) {
  if (!rows?.length) return rows
  const first = rows[0]
  const retailerCol = RETAILER_ID_COLS.find(c => first[c] != null)
  const priceCol = PRICE_VAL_COLS.find(c => first[c] != null)
  if (!retailerCol || !priceCol) return rows

  const grouped = {}
  rows.forEach(row => {
    const date = row.dato?.slice?.(0, 10) || ''
    const vn = row.varenummer || ''
    const key = `${date}|${vn}`
    if (!grouped[key]) {
      grouped[key] = {
        dato: date,
        varenummer: vn,
        produkt: row.produkt,
        kategori: row.kategori,
        merke: row.merke,
      }
    }
    const rKey = normalizeRetailerKey(row[retailerCol])
    const price = Number(row[priceCol])
    if (rKey && !isNaN(price)) {
      grouped[key][rKey] = price
    }
  })
  return Object.values(grouped)
}

/**
 * Aggregate rows (one product per row per date) into category averages.
 * Returns one row per (dato, kategori) with averaged retailer prices and
 * an overall `snitt` field that is the cross-retailer average.
 */
function aggregateByCategoryAndDate(rows) {
  const retailerKeys = new Set()
  rows.forEach(row => {
    Object.keys(row).forEach(k => {
      if (!NON_PRICE_COLS.has(k)) {
        const v = row[k]
        if (v != null && v !== '' && !isNaN(Number(v))) retailerKeys.add(k)
      }
    })
  })

  const grouped = {}
  rows.forEach(row => {
    const date = (row.dato || row.sist_oppdatert || '').slice?.(0, 10) || ''
    const cat = row.kategori
    if (!date || !cat) return
    const gkey = `${date}|${cat}`
    if (!grouped[gkey]) grouped[gkey] = { dato: date, kategori: cat, sums: {}, counts: {}, products: new Set() }
    if (row.varenummer) grouped[gkey].products.add(row.varenummer)
    retailerKeys.forEach(rk => {
      const v = row[rk]
      if (v != null && v !== '' && !isNaN(Number(v))) {
        grouped[gkey].sums[rk] = (grouped[gkey].sums[rk] || 0) + Number(v)
        grouped[gkey].counts[rk] = (grouped[gkey].counts[rk] || 0) + 1
      }
    })
  })

  return Object.values(grouped)
    .map(g => {
      const entry = { dato: g.dato, kategori: g.kategori, antall: g.products.size }
      let allSum = 0
      let allCount = 0
      Object.keys(g.sums).forEach(rk => {
        entry[rk] = +(g.sums[rk] / g.counts[rk]).toFixed(2)
        allSum += g.sums[rk]
        allCount += g.counts[rk]
      })
      entry.snitt = allCount > 0 ? +(allSum / allCount).toFixed(2) : null
      return entry
    })
    .sort((a, b) =>
      a.dato === b.dato ? a.kategori.localeCompare(b.kategori) : a.dato.localeCompare(b.dato)
    )
}

async function loadCurrentSnapshot(supabase) {
  const { data, error } = await fetchAllRows(supabase.from('prissammenligning').select('*'))
  if (error || !data?.length) return []
  return data.map(row => ({
    ...row,
    dato: row.sist_oppdatert?.slice(0, 10) || new Date().toISOString().slice(0, 10),
  }))
}

async function enrichCategories(supabase, rows) {
  const missing = rows.filter(r => !r.kategori && r.varenummer)
  if (!missing.length) return rows
  const { data, error } = await fetchAllRows(
    supabase.from('prissammenligning').select('varenummer, kategori, merke, produkt')
  )
  if (error || !data?.length) return rows
  const byVn = {}
  data.forEach(p => { if (p.varenummer) byVn[p.varenummer] = p })
  rows.forEach(r => {
    if (!r.kategori && r.varenummer && byVn[r.varenummer]) {
      r.kategori = byVn[r.varenummer].kategori
      r.merke = r.merke || byVn[r.varenummer].merke
      r.produkt = r.produkt || byVn[r.varenummer].produkt
    }
  })
  return rows
}

export async function GET(request) {
  let supabase
  try {
    supabase = getSupabase()
  } catch {
    return Response.json({ error: 'Server misconfiguration: missing env vars' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const dager = parseInt(searchParams.get('dager') || '90', 10)

  let query = supabase.from('prishistorikk').select('*').order('dato', { ascending: true })

  if (dager > 0) {
    const since = new Date()
    since.setDate(since.getDate() - dager)
    query = query.gte('dato', since.toISOString().slice(0, 10))
  }

  const { data, error } = await fetchAllRows(query)

  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      const snapshot = await loadCurrentSnapshot(supabase)
      if (snapshot.length) {
        return Response.json(aggregateByCategoryAndDate(snapshot), {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'X-Source': 'snapshot',
          },
        })
      }
      return Response.json(
        { error: 'Prishistorikk-tabellen finnes ikke ennå', code: 'TABLE_NOT_FOUND' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    console.error('Supabase error:', error)
    return Response.json({ error: 'Failed to fetch data' }, { status: 500 })
  }

  let pivoted = pivotIfNeeded(data || [])

  if (!pivoted.length) {
    const snapshot = await loadCurrentSnapshot(supabase)
    pivoted = snapshot
  } else {
    pivoted = await enrichCategories(supabase, pivoted)
  }

  return Response.json(aggregateByCategoryAndDate(pivoted), {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
