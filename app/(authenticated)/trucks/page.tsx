import Link from "next/link"
import { Plus } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

import { TrucksTable, type TruckRow } from "./trucks-table"

export default async function TrucksPage() {
  const me = await requireRole(["admin", "dispatcher", "accounting"])
  const canEdit = me.role === "admin" || me.role === "dispatcher"

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("trucks")
    .select(
      `id, truck_number, make, model, year, status, plate, plate_province,
       plate_expiry, insurance_expiry, ifta_decal_expiry,
       safety_sticker_expiry, cvor_certificate_expiry, notes`,
    )
    .order("truck_number", { ascending: true })

  const trucks: TruckRow[] = data ?? []

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trucks</h1>
          <p className="text-sm text-muted-foreground">
            Plates, insurance, IFTA decals, safety stickers, and CVOR
            certificates. Click a truck to see the full record.
          </p>
        </div>
        {canEdit ? (
          <Link
            href="/trucks/new"
            className={buttonVariants({ size: "sm" })}
          >
            <Plus />
            Add Truck
          </Link>
        ) : null}
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn&apos;t load trucks: {error.message}
        </div>
      ) : (
        <TrucksTable trucks={trucks} />
      )}
    </div>
  )
}
