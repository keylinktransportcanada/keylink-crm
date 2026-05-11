"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth"
import {
  driverEmergencyContactSchema,
  driverProfileSchema,
  type DriverEmergencyContactInput,
  type DriverProfileInput,
} from "@/lib/schemas/driver-profile"
import { createClient } from "@/lib/supabase/server"

type FieldErrors = Partial<Record<string, string[]>>
type Result = { ok: true } | { error: FieldErrors }

// Convert empty-string date inputs to null so Postgres stores them as NULL
// rather than rejecting an invalid date literal.
function emptyToNull<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row }
  for (const key of Object.keys(out) as Array<keyof T>) {
    const v = out[key]
    if (typeof v === "string" && v === "") {
      out[key] = null as T[keyof T]
    }
  }
  return out
}

export async function updateDriverProfile(
  input: DriverProfileInput,
): Promise<Result> {
  await requireRole(["admin"])

  const parsed = driverProfileSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { profile_id, ...rest } = parsed.data
  const row = emptyToNull(rest)

  const supabase = await createClient()
  const { error } = await supabase
    .from("driver_profiles")
    .update(row)
    .eq("profile_id", profile_id)

  if (error) {
    return { error: { _form: [error.message] } }
  }

  revalidatePath("/drivers")
  revalidatePath(`/drivers/${profile_id}`)
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function updateMyEmergencyContact(
  input: DriverEmergencyContactInput,
): Promise<Result> {
  const me = await requireRole(["driver"])

  const parsed = driverEmergencyContactSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("driver_profiles")
    .update(emptyToNull(parsed.data))
    .eq("profile_id", me.id)

  if (error) {
    return { error: { _form: [error.message] } }
  }

  revalidatePath("/dashboard")
  return { ok: true }
}
