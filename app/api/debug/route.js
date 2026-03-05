import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const info = {
    env: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) + '…',
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set (' + process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 8) + '…)' : 'MISSING',
    }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(info)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Test 1: check table and get exact row count
  const { count, error: tablesError } = await supabase
    .from('prissammenligning')
    .select('*', { count: 'exact', head: true })

  info.tableCheck = {
    totalRows: count,
    error: tablesError?.message || null,
    errorCode: tablesError?.code || null,
  }

  // Test 2: grab one raw row
  const { data: sample, error: sampleError } = await supabase
    .from('prissammenligning')
    .select('*')
    .limit(1)

  info.sampleRow = {
    data: sample,
    error: sampleError?.message || null,
  }

  return Response.json(info)
}
