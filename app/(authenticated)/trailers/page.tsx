import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

import { TrailersTable, type TrailerRow } from "./trailers-table"

export default async function TrailersPage() {
  const me = await requireRole(["admin", "dispatcher", "accounting"])
  const canEdit = me.role === "admin" || me.role === "dispatcher"

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("trailers")
    .select("id, trailer_number, type, status, notes")
    .order("trailer_number", { ascending: true })

  const trailers: TrailerRow[] = data ?? []

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trailers</h1>
          <p className="text-sm text-muted-foreground">
            Trailer pool. Phase 3 adds plates, VIN, and inspection tracking.
          </p>
        </div>
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn&apos;t load trailers: {error.message}
        </div>
      ) : (
        <TrailersTable trailers={trailers} canEdit={canEdit} />
      )}
    </div>
  )
}
