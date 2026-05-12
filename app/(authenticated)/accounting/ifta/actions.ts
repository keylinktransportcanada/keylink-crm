"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth"
import {
  fuelRecordSchema,
  tripDistanceSchema,
  type FuelRecordInput,
  type TripDistanceInput,
} from "@/lib/schemas/ifta"
import { createClient } from "@/lib/supabase/server"

type FieldErrors = Partial<Record<string, string[]>>
type Result = { ok: true; id: string } | { error: FieldErrors }
type SimpleResult = { ok: true } | { error: string }

export async function createFuelRecord(
  input: FuelRecordInput,
): Promise<Result> {
  const me = await requireRole(["admin", "dispatcher", "accounting", "driver"])

  const parsed = fuelRecordSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // A driver may only file fuel against their own driver_id. Server enforces.
  if (me.role === "driver" && parsed.data.driver_id !== me.id) {
    return {
      error: { _form: ["Driver fuel entries must be filed under your own id."] },
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("fuel_records")
    .insert({
      truck_id: parsed.data.truck_id,
      driver_id: parsed.data.driver_id,
      purchase_date: parsed.data.purchase_date,
      jurisdiction: parsed.data.jurisdiction,
      litres: parsed.data.litres,
      total_cad: parsed.data.total_cad,
      odometer_km: parsed.data.odometer_km,
      vendor: parsed.data.vendor || null,
      created_by: me.id,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { error: { _form: [error?.message ?? "Insert failed."] } }
  }

  revalidatePath("/accounting/ifta")
  return { ok: true, id: data.id }
}

export async function deleteFuelRecord(id: string): Promise<SimpleResult> {
  await requireRole(["admin", "accounting", "dispatcher"])
  const supabase = await createClient()
  const { error } = await supabase.from("fuel_records").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/accounting/ifta")
  return { ok: true }
}

export async function createTripDistance(
  input: TripDistanceInput,
): Promise<Result> {
  const me = await requireRole(["admin", "dispatcher", "accounting"])

  const parsed = tripDistanceSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  // Resolve the load's truck_id so we can denormalize it for reporting joins.
  const { data: load } = await supabase
    .from("loads")
    .select("truck_id")
    .eq("id", parsed.data.load_id)
    .maybeSingle()

  const { data, error } = await supabase
    .from("trip_distances")
    .insert({
      load_id: parsed.data.load_id,
      truck_id: load?.truck_id ?? null,
      jurisdiction: parsed.data.jurisdiction,
      distance_km: parsed.data.distance_km,
      entered_by: me.id,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { error: { _form: [error?.message ?? "Insert failed."] } }
  }

  revalidatePath("/accounting/ifta")
  return { ok: true, id: data.id }
}

export async function deleteTripDistance(id: string): Promise<SimpleResult> {
  await requireRole(["admin", "accounting", "dispatcher"])
  const supabase = await createClient()
  const { error } = await supabase
    .from("trip_distances")
    .delete()
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/accounting/ifta")
  return { ok: true }
}
