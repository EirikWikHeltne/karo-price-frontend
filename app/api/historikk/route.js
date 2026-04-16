import { getSupabase } from '@/lib/supabaseServer'
import { fetchAllRows } from '@/lib/fetchAllRows'

export const dynamic = 'force-dynamic'

// Possible column names for the retailer identifier in a normalized/long table
const RETAILER_ID_COLS = ['kilde', 'apotek', 'kjede', 'retailer', 'butikk', 'pharmacy']
// Possible column names for the price value in a normalized/long table
const PRICE_VAL_COLS = ['pris', 'price', 'verdi', 'value']

/**
 * Detect if data is in long/normalized format (one row per retailer per date)
 * and pivot to wide format (one row per date, retailer prices as columns).
 */
function maybeNormalize(rows) {
  if (!rows?.length) return rows
  const first = rows[0]

  const retailerCol = RETAILER_ID_COLS.find(c => first[c] != null)
  const priceCol = PRICE_VAL_COLS.find(c => first[c] != null)

  // Not long format — already has separate retailer columns (wide format)
  if (!retailerCol || !priceCol) return rows

  // Normalize retailer names to match prissammenligning column names
  function normalizeKey(name) {
    const n = String(name).toLowerCase().trim()
    if (n.includes('apotek 1') || n === 'apotek1') return 'apotek1'
    if (n.includes('farmasiet')) return 'farmasiet'
    if (n.includes('boots')) return 'boots'
    if (n.includes('vitusapotek') || n.includes('vitus apotek')) return 'vitusapotek'
    return n.replace(/\s+/g, '_')
  }

  // Pivot: group by (dato, varenummer) → spread retailer prices into columns
  const grouped = {}
  rows.forEach(row => {
    const date = row.dato?.slice?.(0, 10) || ''
    const vn = row.varenummer || ''
    const key = `${date}|${vn}`
    if (!grouped[key]) {
      grouped[key] = { dato: date, varenummer: vn, produkt: row.produkt }
    }
    const rKey = normalizeKey(row[retailerCol])
    const price = Number(row[priceCol])
    if (rKey && !isNaN(price)) {
      grouped[key][rKey] = price
    }
  })

  return Object.values(grouped).sort((a, b) => (a.dato || '').localeCompare(b.dato || ''))
}

export async function GET(request) {
  let supabase
  try {
    supabase = getSupabase()
  } catch {
    return Response.json({ error: 'Server misconfiguration: missing env vars' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const produkt = searchParams.get('produkt')
  const varenummer = searchParams.get('varenummer')
  const dager = parseInt(searchParams.get('dager') || '30', 10)

  // Try fetching from prishistorikk table
  let query = supabase
    .from('prishistorikk')
    .select('*')
    .order('dato', { ascending: true })

  if (varenummer) {
    query = query.eq('varenummer', varenummer)
  } else if (produkt) {
    const safe = produkt.replace(/[(),.\\*"%_]/g, '')
    if (safe) {
      query = query.ilike('produkt', `%${safe}%`)
    }
  }

  if (dager > 0) {
    const since = new Date()
    since.setDate(since.getDate() - dager)
    query = query.gte('dato', since.toISOString().slice(0, 10))
  }

  const { data, error } = await fetchAllRows(query)

  if (error) {
    // If the table doesn't exist, fall back to current prices from prissammenligning
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      try {
        let fallbackQuery = supabase
          .from('prissammenligning')
          .select('*')

        if (varenummer) {
          fallbackQuery = fallbackQuery.eq('varenummer', varenummer)
        } else if (produkt) {
          const safe = produkt.replace(/[(),.\\*"%_]/g, '')
          if (safe) fallbackQuery = fallbackQuery.ilike('produkt', `%${safe}%`)
        }

        const { data: fbData } = await fallbackQuery
        if (fbData?.length) {
          // Convert current prices to history-like format
          const NON_PRICE_COLS = new Set(['id', 'produkt', 'merke', 'varenummer', 'kategori', 'sist_oppdatert', 'laveste_pris', 'hoyeste_pris'])
          const rows = fbData.map(row => {
            const entry = {
              dato: row.sist_oppdatert?.slice(0, 10) || new Date().toISOString().slice(0, 10),
              varenummer: row.varenummer,
              produkt: row.produkt,
            }
            Object.keys(row).forEach(k => {
              if (!NON_PRICE_COLS.has(k)) entry[k] = row[k]
            })
            return entry
          })
          return Response.json(rows, {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate',
              'Pragma': 'no-cache',
            },
          })
        }
      } catch (_) { /* ignore fallback errors */ }

      return Response.json(
        { error: 'Prishistorikk-tabellen finnes ikke ennå', code: 'TABLE_NOT_FOUND' },
        {
          status: 404,
          headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        }
      )
    }
    console.error('Supabase error:', error)
    return Response.json({ error: 'Failed to fetch data' }, { status: 500 })
  }

  // If prishistorikk exists but has no data for this product, fall back to prissammenligning
  if (!data?.length) {
    let fallbackQuery = supabase
      .from('prissammenligning')
      .select('*')

    if (varenummer) {
      fallbackQuery = fallbackQuery.eq('varenummer', varenummer)
    } else if (produkt) {
      const safe = produkt.replace(/[(),.\\*"%_]/g, '')
      if (safe) fallbackQuery = fallbackQuery.ilike('produkt', `%${safe}%`)
    }

    const { data: fbData } = await fallbackQuery
    if (fbData?.length) {
      const NON_PRICE_COLS = new Set(['id', 'produkt', 'merke', 'varenummer', 'kategori', 'sist_oppdatert', 'laveste_pris', 'hoyeste_pris'])
      const rows = fbData.map(row => {
        const entry = {
          dato: row.sist_oppdatert?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          varenummer: row.varenummer,
          produkt: row.produkt,
        }
        Object.keys(row).forEach(k => {
          if (!NON_PRICE_COLS.has(k)) entry[k] = row[k]
        })
        return entry
      })
      return Response.json(rows, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
        },
      })
    }
  }

  const normalized = maybeNormalize(data)
  return Response.json(normalized, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
