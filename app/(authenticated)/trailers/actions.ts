"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth"
import {
  trailerSchema,
  updateTrailerSchema,
  type TrailerInput,
  type UpdateTrailerInput,
} from "@/lib/schemas/equipment"
import { createClient } from "@/lib/supabase/server"

type FieldErrors = Partial<Record<string, string[]>>
type Result = { ok: true; id: string } | { error: FieldErrors }

function toRow(input: TrailerInput) {
  return {
    trailer_number: input.trailer_number,
    type: input.type,
    status: input.status,

    plate: input.plate || null,
    plate_province: input.plate_province || null,
    plate_expiry: input.plate_expiry || null,
    vin: input.vin || null,
    last_inspection_date: input.last_inspection_date || null,
    next_inspection_due: input.next_inspection_due || null,

    notes: input.notes || null,
  }
}

export async function createTrailer(input: TrailerInput): Promise<Result> {
  await requireRole(["admin", "dispatcher"])

  const parsed = trailerSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("trailers")
    .insert(toRow(parsed.data))
    .select("id")
    .single()

  if (error) {
    return { error: { _form: [error.message] } }
  }

  revalidatePath("/trailers")
  return { ok: true, id: data.id }
}

export async function updateTrailer(
  input: UpdateTrailerInput,
): Promise<Result> {
  await requireRole(["admin", "dispatcher"])

  const parsed = updateTrailerSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("trailers")
    .update(toRow(parsed.data))
    .eq("id", parsed.data.id)

  if (error) {
    return { error: { _form: [error.message] } }
  }

  revalidatePath("/trailers")
  return { ok: true, id: parsed.data.id }
}
