"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth"
import { maintenanceFormSchema } from "@/lib/schemas/maintenance"
import { createClient } from "@/lib/supabase/server"

type ActionResult = { ok: true; id: string } | { error: string }

function asNumberOrNull(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function asTextOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length === 0 ? null : t
}

export async function createMaintenanceRecord(
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireRole(["admin", "dispatcher"])

  const raw = {
    truck_id: formData.get("truck_id"),
    service_type: formData.get("service_type"),
    service_date: formData.get("service_date"),
    odometer_km: formData.get("odometer_km"),
    cost_cad: formData.get("cost_cad"),
    vendor: formData.get("vendor"),
    description: formData.get("description"),
    next_due_date: formData.get("next_due_date"),
    next_due_odometer_km: formData.get("next_due_odometer_km"),
  }

  // Coerce blanks to "" so zod's union accepts them.
  const input = {
    truck_id: typeof raw.truck_id === "string" ? raw.truck_id : "",
    service_type: typeof raw.service_type === "string" ? raw.service_type : "",
    service_date: typeof raw.service_date === "string" ? raw.service_date : "",
    odometer_km:
      typeof raw.odometer_km === "string" && raw.odometer_km.length > 0
        ? Number(raw.odometer_km)
        : ("" as const),
    cost_cad:
      typeof raw.cost_cad === "string" && raw.cost_cad.length > 0
        ? Number(raw.cost_cad)
        : ("" as const),
    vendor: typeof raw.vendor === "string" ? raw.vendor : "",
    description: typeof raw.description === "string" ? raw.description : "",
    next_due_date:
      typeof raw.next_due_date === "string" ? raw.next_due_date : "",
    next_due_odometer_km:
      typeof raw.next_due_odometer_km === "string" &&
      raw.next_due_odometer_km.length > 0
        ? Number(raw.next_due_odometer_km)
        : ("" as const),
  }

  const parsed = maintenanceFormSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("maintenance_records")
    .insert({
      truck_id: parsed.data.truck_id,
      service_type: parsed.data.service_type,
      service_date: parsed.data.service_date,
      odometer_km: asNumberOrNull(parsed.data.odometer_km),
      cost_cad: asNumberOrNull(parsed.data.cost_cad),
      vendor: asTextOrNull(parsed.data.vendor),
      description: asTextOrNull(parsed.data.description),
      next_due_date: asTextOrNull(parsed.data.next_due_date),
      next_due_odometer_km: asNumberOrNull(parsed.data.next_due_odometer_km),
      created_by: me.id,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { error: error?.message ?? "Failed to record service." }
  }

  // Refresh the truck's odometer if a higher one was entered — keeps the
  // dispatcher's "trucks available" / km-out warnings honest without a manual
  // edit step.
  const newKm = asNumberOrNull(parsed.data.odometer_km)
  if (newKm !== null) {
    const { data: truck } = await supabase
      .from("trucks")
      .select("current_odometer_km")
      .eq("id", parsed.data.truck_id)
      .maybeSingle()
    const currentKm = truck?.current_odometer_km ?? 0
    if (newKm > currentKm) {
      await supabase
        .from("trucks")
        .update({ current_odometer_km: newKm })
        .eq("id", parsed.data.truck_id)
    }
  }

  revalidatePath(`/trucks/${parsed.data.truck_id}`)
  revalidatePath("/trucks")
  revalidatePath("/dashboard")
  return { ok: true, id: data.id }
}

export async function deleteMaintenanceRecord(
  recordId: string,
): Promise<{ ok: true } | { error: string }> {
  await requireRole(["admin", "dispatcher"])

  const supabase = await createClient()

  const { data: rec, error: fetchErr } = await supabase
    .from("maintenance_records")
    .select("id, truck_id")
    .eq("id", recordId)
    .maybeSingle()
  if (fetchErr || !rec) return { error: "Record not found." }

  const { error } = await supabase
    .from("maintenance_records")
    .delete()
    .eq("id", recordId)
  if (error) return { error: error.message }

  revalidatePath(`/trucks/${rec.truck_id}`)
  revalidatePath("/trucks")
  revalidatePath("/dashboard")
  return { ok: true }
}
