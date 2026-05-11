import Link from "next/link"
import { Plus } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

import { LoadsTable, type LoadListRow, type LoadDocPreview } from "./loads-table"

export default async function LoadsPage() {
  const me = await requireRole(["admin", "dispatcher", "accounting", "driver"])
  const canCreate = me.role === "admin" || me.role === "dispatcher"

  const supabase = await createClient()

  // RLS handles which loads each role can see; no additional WHERE needed.
  const { data: rawLoads, error } = await supabase
    .from("loads")
    .select(
      `id, load_number, status, pickup_date, delivery_date,
       origin_company, origin_city, origin_province, origin_country,
       destination_company, destination_city, destination_province, destination_country,
       total_billed_cad, customer_id, driver_id, truck_id, trailer_id,
       is_cross_border, load_type, commodity, equipment_required, notes,
       reference_number, po_number`,
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
  const truckIds = [
    ...new Set(loadsRaw.map((l) => l.truck_id).filter((v): v is string => !!v)),
  ]
  const trailerIds = [
    ...new Set(loadsRaw.map((l) => l.trailer_id).filter((v): v is string => !!v)),
  ]

  const [customersRes, driversRes, trucksRes, trailersRes] = await Promise.all([
    customerIds.length
      ? supabase.from("customers").select("id, name").in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    driverIds.length
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", driverIds)
      : Promise.resolve({ data: [], error: null }),
    truckIds.length
      ? supabase
          .from("trucks")
          .select("id, truck_number")
          .in("id", truckIds)
      : Promise.resolve({ data: [], error: null }),
    trailerIds.length
      ? supabase
          .from("trailers")
          .select("id, trailer_number")
          .in("id", trailerIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  // Pull a small preview slice of attached documents per load. Up to 4 most-
  // recent so the hover card can show a thumbnail strip without bloating the
  // initial query. Signed URLs live for 10 minutes so the table stays clickable
  // for a while; reload re-signs them.
  const loadIds = loadsRaw.map((l) => l.id)
  const { data: docRows } = loadIds.length
    ? await supabase
        .from("documents")
        .select(
          "id, load_id, type, file_path, file_name, mime_type, size_bytes, uploaded_at",
        )
        .in("load_id", loadIds)
        .order("uploaded_at", { ascending: false })
    : { data: [] as Array<{
        id: string
        load_id: string
        type: string
        file_path: string
        file_name: string
        mime_type: string
        size_bytes: number
        uploaded_at: string
      }> }

  const docsByLoad = new Map<string, LoadDocPreview[]>()
  for (const d of docRows ?? []) {
    if (!d.load_id) continue  // schema allows null but list view only cares about load-attached docs
    const list = docsByLoad.get(d.load_id) ?? []
    if (list.length >= 4) continue  // cap per load for the hover strip
    const { data: signed } = await supabase.storage
      .from("load-documents")
      .createSignedUrl(d.file_path, 600)
    list.push({
      id: d.id,
      type: d.type,
      file_name: d.file_name,
      mime_type: d.mime_type,
      size_bytes: Number(d.size_bytes),
      uploaded_at: d.uploaded_at,
      signed_url: signed?.signedUrl ?? null,
    })
    docsByLoad.set(d.load_id, list)
  }

  const customerById = new Map(
    (customersRes.data ?? []).map((c) => [c.id, c.name] as const),
  )
  const driverById = new Map(
    (driversRes.data ?? []).map((d) => [d.id, d.full_name] as const),
  )
  const truckById = new Map(
    (trucksRes.data ?? []).map((t) => [t.id, t.truck_number] as const),
  )
  const trailerById = new Map(
    (trailersRes.data ?? []).map((t) => [t.id, t.trailer_number] as const),
  )

  const loads: LoadListRow[] = loadsRaw.map((l) => ({
    id: l.id,
    load_number: l.load_number,
    status: l.status,
    pickup_date: l.pickup_date,
    delivery_date: l.delivery_date,
    origin_company: l.origin_company,
    origin_city: l.origin_city,
    origin_province: l.origin_province,
    origin_country: l.origin_country,
    destination_company: l.destination_company,
    destination_city: l.destination_city,
    destination_province: l.destination_province,
    destination_country: l.destination_country,
    total_billed_cad: l.total_billed_cad === null ? null : Number(l.total_billed_cad),
    customer_name: customerById.get(l.customer_id) ?? null,
    driver_name: l.driver_id ? driverById.get(l.driver_id) ?? null : null,
    truck_number: l.truck_id ? truckById.get(l.truck_id) ?? null : null,
    trailer_number: l.trailer_id ? trailerById.get(l.trailer_id) ?? null : null,
    is_cross_border: l.is_cross_border,
    load_type: l.load_type,
    commodity: l.commodity,
    equipment_required: l.equipment_required,
    notes: l.notes,
    reference_number: l.reference_number,
    po_number: l.po_number,
    documents: docsByLoad.get(l.id) ?? [],
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
