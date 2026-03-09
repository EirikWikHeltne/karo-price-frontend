import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 1000

async function fetchAllRows(query) {
  const allRows = []
  let from = 0
  while (true) {
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    allRows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return { data: allRows, error: null }
}

export async function GET(request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Server misconfiguration: missing env vars' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

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
    const safe = produkt.replace(/[(),.\\*"]/g, '')
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
          .select('varenummer, produkt, farmasiet, boots, vitusapotek, apotek1, sist_oppdatert')

        if (varenummer) {
          fallbackQuery = fallbackQuery.eq('varenummer', varenummer)
        } else if (produkt) {
          const safe = produkt.replace(/[(),.\\*"]/g, '')
          if (safe) fallbackQuery = fallbackQuery.ilike('produkt', `%${safe}%`)
        }

        const { data: fbData } = await fallbackQuery
        if (fbData?.length) {
          // Convert current prices to history-like format
          const rows = fbData.map(row => ({
            dato: row.sist_oppdatert?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            varenummer: row.varenummer,
            produkt: row.produkt,
            farmasiet: row.farmasiet,
            boots: row.boots,
            vitusapotek: row.vitusapotek,
            apotek1: row.apotek1,
          }))
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
      .select('varenummer, produkt, farmasiet, boots, vitusapotek, apotek1, sist_oppdatert')

    if (varenummer) {
      fallbackQuery = fallbackQuery.eq('varenummer', varenummer)
    } else if (produkt) {
      const safe = produkt.replace(/[(),.\\*"]/g, '')
      if (safe) fallbackQuery = fallbackQuery.ilike('produkt', `%${safe}%`)
    }

    const { data: fbData } = await fallbackQuery
    if (fbData?.length) {
      const rows = fbData.map(row => ({
        dato: row.sist_oppdatert?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        varenummer: row.varenummer,
        produkt: row.produkt,
        farmasiet: row.farmasiet,
        boots: row.boots,
        vitusapotek: row.vitusapotek,
        apotek1: row.apotek1,
      }))
      return Response.json(rows, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
        },
      })
    }
  }

  return Response.json(data, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
