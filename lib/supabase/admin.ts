import "server-only"

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./types"

let cached: SupabaseClient<Database> | null = null

export function createAdminClient(): SupabaseClient<Database> {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    )
  }

  cached = createSupabaseClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return cached
}
