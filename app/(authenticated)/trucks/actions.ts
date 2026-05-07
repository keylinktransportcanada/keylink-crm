"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth"
import {
  truckSchema,
  updateTruckSchema,
  type TruckInput,
  type UpdateTruckInput,
} from "@/lib/schemas/equipment"
import { createClient } from "@/lib/supabase/server"

type FieldErrors = Partial<Record<string, string[]>>
type Result = { ok: true; id: string } | { error: FieldErrors }

function toRow(input: TruckInput) {
  return {
    truck_number: input.truck_number,
    make: input.make || null,
    model: input.model || null,
    year: input.year,
    status: input.status,

    plate: input.plate || null,
    plate_province: input.plate_province || null,
    plate_expiry: input.plate_expiry || null,
    vin: input.vin || null,
    current_odometer_km: input.current_odometer_km,

    insurance_policy: input.insurance_policy || null,
    insurance_expiry: input.insurance_expiry || null,
    ifta_decal_year: input.ifta_decal_year,
    ifta_decal_expiry: input.ifta_decal_expiry || null,
    safety_sticker_expiry: input.safety_sticker_expiry || null,
    cvor_certificate_expiry: input.cvor_certificate_expiry || null,

    notes: input.notes || null,
  }
}

export async function createTruck(input: TruckInput): Promise<Result> {
  await requireRole(["admin", "dispatcher"])

  const parsed = truckSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("trucks")
    .insert(toRow(parsed.data))
    .select("id")
    .single()

  if (error) {
    return { error: { _form: [error.message] } }
  }

  revalidatePath("/trucks")
  return { ok: true, id: data.id }
}

export async function updateTruck(input: UpdateTruckInput): Promise<Result> {
  await requireRole(["admin", "dispatcher"])

  const parsed = updateTruckSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("trucks")
    .update(toRow(parsed.data))
    .eq("id", parsed.data.id)

  if (error) {
    return { error: { _form: [error.message] } }
  }

  revalidatePath("/trucks")
  revalidatePath(`/trucks/${parsed.data.id}`)
  return { ok: true, id: parsed.data.id }
}
