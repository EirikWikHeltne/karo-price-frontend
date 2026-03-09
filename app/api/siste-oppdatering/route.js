import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Get the most recent scan date from prishistorikk
  let dato = null

  const { data, error } = await supabase
    .from('prishistorikk')
    .select('dato')
    .order('dato', { ascending: false })
    .limit(1)

  if (!error && data?.[0]?.dato) {
    dato = data[0].dato
  } else {
    // Fall back to sist_oppdatert from prissammenligning
    const { data: fallback, error: fbErr } = await supabase
      .from('prissammenligning')
      .select('sist_oppdatert')
      .order('sist_oppdatert', { ascending: false })
      .limit(1)

    if (!fbErr && fallback?.[0]?.sist_oppdatert) {
      dato = fallback[0].sist_oppdatert.slice(0, 10)
    }
  }

  return Response.json({ dato }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
