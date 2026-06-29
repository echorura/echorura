import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_MEMFIRE_URL!,
    process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY!
  )
}
