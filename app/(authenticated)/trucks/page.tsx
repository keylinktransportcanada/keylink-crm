import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

import { TrucksTable, type TruckRow } from "./trucks-table"

export default async function TrucksPage() {
  const me = await requireRole(["admin", "dispatcher", "accounting"])
  const canEdit = me.role === "admin" || me.role === "dispatcher"

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("trucks")
    .select("id, truck_number, make, model, year, status, notes")
    .order("truck_number", { ascending: true })

  const trucks: TruckRow[] = data ?? []

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trucks</h1>
          <p className="text-sm text-muted-foreground">
            The fleet that pulls loads. Phase 3 adds plate, insurance, IFTA,
            and CVOR tracking with expiry alerts.
          </p>
        </div>
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn&apos;t load trucks: {error.message}
        </div>
      ) : (
        <TrucksTable trucks={trucks} canEdit={canEdit} />
      )}
    </div>
  )
}
