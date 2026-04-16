import { createClient } from '@supabase/supabase-js'

// Server-only client — uses service role key to bypass RLS.
// Never import this file from client components.
// Lazy-initialised so that missing env vars are caught at request time, not at import time.
let _client = null

export function getSupabase() {
  if (!_client) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase env vars')
    }
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  }
  return _client
}
