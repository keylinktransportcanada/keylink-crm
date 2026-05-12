import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { LoadInput } from "@/lib/schemas/loads"
import { trucksWithMaintenanceWarnings } from "@/lib/maintenance/load-form-trucks"

import { LoadForm, type LoadFormOptions } from "../../load-form"
import type { ExistingDocument } from "@/components/loads/load-documents-section"

export default async function EditLoadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole(["admin", "dispatcher"])
  const { id } = await params
  const supabase = await createClient()

  const { data: load } = await supabase
    .from("loads")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (!load) notFound()

  // Documents already attached to this load — passed into the form so the
  // user can see what's there, delete, or add more.
  const { data: docRows } = await supabase
    .from("documents")
    .select(
      "id, type, file_path, file_name, mime_type, size_bytes, uploaded_at",
    )
    .eq("load_id", id)
    .order("uploaded_at", { ascending: false })

  const docs = await Promise.all(
    (docRows ?? []).map(async (d) => {
      const { data: signed } = await supabase.storage
        .from("load-documents")
        .createSignedUrl(d.file_path, 600)
      return {
        id: d.id,
        type: d.type as ExistingDocument["type"],
        file_name: d.file_name,
        mime_type: d.mime_type,
        size_bytes: Number(d.size_bytes),
        uploaded_at: d.uploaded_at,
        signed_url: signed?.signedUrl ?? null,
      }
    }),
  )

  const [customersRes, driversRes, trucksRes, trailersRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, active")
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "driver")
      .eq("active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("trucks")
      .select("id, truck_number")
      .neq("status", "retired")
      .order("truck_number", { ascending: true }),
    supabase
      .from("trailers")
      .select("id, trailer_number")
      .neq("status", "retired")
      .order("trailer_number", { ascending: true }),
  ])

  const trucks = await trucksWithMaintenanceWarnings(
    supabase,
    trucksRes.data ?? [],
  )

  const options: LoadFormOptions = {
    customers: customersRes.data ?? [],
    drivers: driversRes.data ?? [],
    trucks,
    trailers: trailersRes.data ?? [],
  }

  // Reverse the CAD normalization so the form shows what the dispatcher
  // originally entered.
  const fxRate = Number(load.fx_rate_to_cad ?? 1)
  const fromCad = (v: number | string | null) =>
    v === null ? null : Number(v) / fxRate

  const initialValues: LoadInput = {
    customer_id: load.customer_id,
    driver_id: load.driver_id,
    truck_id: load.truck_id,
    trailer_id: load.trailer_id,

    reference_number: load.reference_number ?? "",
    po_number: load.po_number ?? "",

    origin_company: load.origin_company ?? "",
    origin_address: load.origin_address ?? "",
    origin_city: load.origin_city ?? "",
    origin_province: load.origin_province ?? "",
    origin_country: load.origin_country ?? "CA",

    destination_company: load.destination_company ?? "",
    destination_address: load.destination_address ?? "",
    destination_city: load.destination_city ?? "",
    destination_province: load.destination_province ?? "",
    destination_country: load.destination_country ?? "CA",

    pickup_date: load.pickup_date ?? "",
    delivery_date: load.delivery_date ?? "",

    load_type: load.load_type,
    commodity: load.commodity ?? "",
    weight_kg: load.weight_kg === null ? null : Number(load.weight_kg),
    pieces: load.pieces,
    equipment_required:
      (load.equipment_required as LoadInput["equipment_required"]) ?? "none",

    currency: load.currency,
    rate: fromCad(load.rate_cad),
    fuel_surcharge: fromCad(load.fuel_surcharge_cad),
    accessorial_charges: fromCad(load.accessorial_charges_cad),

    is_cross_border: load.is_cross_border,
    customs_broker: load.customs_broker ?? "",
    pars_pass_number: load.pars_pass_number ?? "",
    aci_aces_number: load.aci_aces_number ?? "",

    notes: load.notes ?? "",
    internal_notes: load.internal_notes ?? "",

    status: load.status,
    tax_rate_pct: load.tax_rate_pct === null ? null : Number(load.tax_rate_pct),
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/loads/${load.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to load
        </Link>
      </div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit{" "}
          <span className="font-mono">{load.load_number}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Normal status changes still happen on the load detail page. The
          status override below is for correcting mistakes.
        </p>
      </header>

      <LoadForm
        options={options}
        mode={{
          kind: "edit",
          loadId: load.id,
          initialValues,
          documents: docs,
        }}
      />
    </div>
  )
}
