import Link from "next/link"
import { Plus } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

import { LoadsTable, type LoadListRow } from "./loads-table"

export default async function LoadsPage() {
  const me = await requireRole(["admin", "dispatcher", "accounting", "driver"])
  const canCreate = me.role === "admin" || me.role === "dispatcher"

  const supabase = await createClient()

  // RLS handles which loads each role can see; no additional WHERE needed.
  const { data: rawLoads, error } = await supabase
    .from("loads")
    .select(
      `id, load_number, status, pickup_date, delivery_date,
       origin_city, origin_province, destination_city, destination_province,
       total_billed_cad, customer_id, driver_id, is_cross_border`,
    )
    .order("created_at", { ascending: false })

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Couldn&apos;t load loads: {error.message}
      </div>
    )
  }

  const loadsRaw = rawLoads ?? []
  const customerIds = [...new Set(loadsRaw.map((l) => l.customer_id))]
  const driverIds = [
    ...new Set(loadsRaw.map((l) => l.driver_id).filter((v): v is string => !!v)),
  ]

  const [customersRes, driversRes] = await Promise.all([
    customerIds.length
      ? supabase.from("customers").select("id, name").in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    driverIds.length
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", driverIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const customerById = new Map(
    (customersRes.data ?? []).map((c) => [c.id, c.name] as const),
  )
  const driverById = new Map(
    (driversRes.data ?? []).map((d) => [d.id, d.full_name] as const),
  )

  const loads: LoadListRow[] = loadsRaw.map((l) => ({
    id: l.id,
    load_number: l.load_number,
    status: l.status,
    pickup_date: l.pickup_date,
    delivery_date: l.delivery_date,
    origin_city: l.origin_city,
    origin_province: l.origin_province,
    destination_city: l.destination_city,
    destination_province: l.destination_province,
    total_billed_cad: l.total_billed_cad === null ? null : Number(l.total_billed_cad),
    customer_name: customerById.get(l.customer_id) ?? null,
    driver_name: l.driver_id ? driverById.get(l.driver_id) ?? null : null,
    is_cross_border: l.is_cross_border,
  }))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Loads</h1>
          <p className="text-sm text-muted-foreground">
            Every shipment from draft through paid. Click a load number to open
            the detail view.
          </p>
        </div>
        {canCreate ? (
          <Link href="/loads/new" className={buttonVariants({ size: "sm" })}>
            <Plus />
            New Load
          </Link>
        ) : null}
      </header>

      <LoadsTable loads={loads} />
    </div>
  )
}
