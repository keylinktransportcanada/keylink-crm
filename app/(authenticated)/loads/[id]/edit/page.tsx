import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { LoadInput } from "@/lib/schemas/loads"

import { LoadForm, type LoadFormOptions } from "../../load-form"

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

  const options: LoadFormOptions = {
    customers: customersRes.data ?? [],
    drivers: driversRes.data ?? [],
    trucks: trucksRes.data ?? [],
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
          Status changes happen on the load detail page — this form covers
          everything else.
        </p>
      </header>

      <LoadForm
        options={options}
        mode={{
          kind: "edit",
          loadId: load.id,
          initialValues,
        }}
      />
    </div>
  )
}
