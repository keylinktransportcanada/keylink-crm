"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireRole } from "@/lib/auth"
import { getUsdToCadRate } from "@/lib/fx"
import {
  loadSchema,
  transitionStatusSchema,
  updateLoadSchema,
  type LoadInput,
  type TransitionStatusInput,
  type UpdateLoadInput,
} from "@/lib/schemas/loads"
import { createClient } from "@/lib/supabase/server"

type FieldErrors = Partial<Record<string, string[]>>
type CreateResult = { ok: true; id: string } | { error: FieldErrors }
type SimpleResult = { ok: true } | { error: string }

const MULTIPLIER = 1_000_000 // round CAD to 6 decimal places of the rate

function toCadAmount(
  entered: number | null,
  fxRate: number,
): number | null {
  if (entered === null) return null
  // Two decimals after multiplication; banker rounding isn't needed at this
  // scale of money, plain Math.round is fine.
  return Math.round(entered * fxRate * 100) / 100
}

async function buildRow(input: LoadInput, actorId: string) {
  const fxRate = input.currency === "USD" ? await getUsdToCadRate() : 1
  const rateCad = toCadAmount(input.rate, fxRate)
  const fuelCad = toCadAmount(input.fuel_surcharge, fxRate)
  const accCad = toCadAmount(input.accessorial_charges, fxRate)
  const totalCad =
    rateCad === null && fuelCad === null && accCad === null
      ? null
      : (rateCad ?? 0) + (fuelCad ?? 0) + (accCad ?? 0)

  return {
    customer_id: input.customer_id,
    driver_id: input.driver_id,
    truck_id: input.truck_id,
    trailer_id: input.trailer_id,

    reference_number: input.reference_number || null,
    po_number: input.po_number || null,

    origin_company: input.origin_company || null,
    origin_address: input.origin_address || null,
    origin_city: input.origin_city || null,
    origin_province: input.origin_province || null,
    origin_country: input.origin_country || "CA",

    destination_company: input.destination_company || null,
    destination_address: input.destination_address || null,
    destination_city: input.destination_city || null,
    destination_province: input.destination_province || null,
    destination_country: input.destination_country || "CA",

    pickup_date: input.pickup_date || null,
    delivery_date: input.delivery_date || null,

    load_type: input.load_type,
    commodity: input.commodity || null,
    weight_kg: input.weight_kg,
    pieces: input.pieces,
    equipment_required:
      input.equipment_required === "none" ? null : input.equipment_required,

    currency: input.currency,
    fx_rate_to_cad: Math.round(fxRate * MULTIPLIER) / MULTIPLIER,
    rate_cad: rateCad,
    fuel_surcharge_cad: fuelCad,
    accessorial_charges_cad: accCad,
    total_billed_cad: totalCad,

    is_cross_border: input.is_cross_border,
    customs_broker: input.customs_broker || null,
    pars_pass_number: input.pars_pass_number || null,
    aci_aces_number: input.aci_aces_number || null,

    notes: input.notes || null,
    internal_notes: input.internal_notes || null,

    created_by: actorId,
    // status auto-derives below for create; preserved on update.
  }
}

export async function createLoad(input: LoadInput): Promise<CreateResult> {
  const me = await requireRole(["admin", "dispatcher"])

  const parsed = loadSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const row = await buildRow(parsed.data, me.id)
  // A load with a driver attached at creation skips draft and goes straight
  // to assigned. Otherwise it sits in draft until dispatch assigns one.
  const initialStatus = parsed.data.driver_id ? "assigned" : "draft"

  const supabase = await createClient()
  const { data: inserted, error } = await supabase
    .from("loads")
    // load_number is filled by the BEFORE INSERT trigger when blank.
    .insert({ ...row, status: initialStatus, load_number: "" })
    .select("id")
    .single()

  if (error || !inserted) {
    return { error: { _form: [error?.message ?? "Insert failed."] } }
  }

  // Seed the timeline with the initial status.
  await supabase.from("load_status_events").insert({
    load_id: inserted.id,
    status: initialStatus,
    created_by: me.id,
  })

  revalidatePath("/loads")
  revalidatePath("/dashboard")
  return { ok: true, id: inserted.id }
}

export async function updateLoad(
  input: UpdateLoadInput,
): Promise<CreateResult> {
  const me = await requireRole(["admin", "dispatcher"])

  const parsed = updateLoadSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const row = await buildRow(parsed.data, me.id)
  // created_by is set on insert and shouldn't change on update.
  const { created_by: _ignored, ...updateRowBase } = row
  void _ignored

  const supabase = await createClient()

  // Look up the existing status so we can detect a manual override and emit a
  // timeline event when it changes.
  const { data: prior } = await supabase
    .from("loads")
    .select("status")
    .eq("id", parsed.data.id)
    .maybeSingle()

  const overrideStatus =
    parsed.data.status && prior && parsed.data.status !== prior.status
      ? parsed.data.status
      : null

  const updateRow = overrideStatus
    ? { ...updateRowBase, status: overrideStatus }
    : updateRowBase

  const { error } = await supabase
    .from("loads")
    .update(updateRow)
    .eq("id", parsed.data.id)

  if (error) {
    return { error: { _form: [error.message] } }
  }

  if (overrideStatus) {
    await supabase.from("load_status_events").insert({
      load_id: parsed.data.id,
      status: overrideStatus,
      location_note: "Status manually corrected via edit form",
      created_by: me.id,
    })
  }

  revalidatePath("/loads")
  revalidatePath(`/loads/${parsed.data.id}`)
  revalidatePath("/dashboard")
  return { ok: true, id: parsed.data.id }
}

export async function transitionLoadStatus(
  input: TransitionStatusInput,
): Promise<SimpleResult> {
  const me = await requireRole(["admin", "dispatcher", "driver", "accounting"])

  const parsed = transitionStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Invalid input." }
  }

  // Role gates: accounting can only set invoiced/paid; driver can only set
  // operational statuses on their own loads (RLS already enforces ownership).
  if (
    me.role === "accounting" &&
    parsed.data.status !== "invoiced" &&
    parsed.data.status !== "paid"
  ) {
    return { error: "Accounting can only mark loads invoiced or paid." }
  }

  const operationalForDriver = new Set([
    "at_pickup",
    "loaded",
    "in_transit",
    "at_delivery",
    "delivered",
  ])
  if (
    me.role === "driver" &&
    !operationalForDriver.has(parsed.data.status)
  ) {
    return { error: "Drivers can only update operational statuses." }
  }

  const supabase = await createClient()

  const { error: updateErr } = await supabase
    .from("loads")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
  if (updateErr) return { error: updateErr.message }

  const { error: eventErr } = await supabase.from("load_status_events").insert({
    load_id: parsed.data.id,
    status: parsed.data.status,
    location_note: parsed.data.location_note || null,
    created_by: me.id,
  })
  if (eventErr) return { error: eventErr.message }

  revalidatePath("/loads")
  revalidatePath(`/loads/${parsed.data.id}`)
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function deleteLoad(id: string): Promise<SimpleResult> {
  await requireRole(["admin", "dispatcher"])

  const supabase = await createClient()
  const { error } = await supabase.from("loads").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/loads")
  revalidatePath("/dashboard")
  redirect("/loads")
}
