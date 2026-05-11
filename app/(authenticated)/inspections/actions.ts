"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth"
import {
  inspectionSchema,
  type InspectionInput,
} from "@/lib/schemas/inspections"
import { createClient } from "@/lib/supabase/server"

type FieldErrors = Partial<Record<string, string[]>>
type Result =
  | { ok: true; id: string; severity: "none" | "minor" | "major" }
  | { error: FieldErrors }

export async function createInspection(
  input: InspectionInput,
): Promise<Result> {
  const me = await requireRole(["admin", "dispatcher", "driver"])

  const parsed = inspectionSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const row = {
    truck_id: parsed.data.truck_id,
    trailer_id: parsed.data.trailer_id,
    load_id: parsed.data.load_id,
    driver_id: me.id,
    inspection_type: parsed.data.inspection_type,
    severity: parsed.data.severity,
    defects_found: parsed.data.severity !== "none",
    defects_description: parsed.data.defects_description || null,
    notes: parsed.data.notes || null,
    signed_by_driver: parsed.data.signed_by_driver,
  }

  const { data, error } = await supabase
    .from("inspections")
    .insert(row)
    .select("id, severity")
    .single()

  if (error || !data) {
    return { error: { _form: [error?.message ?? "Failed to save inspection."] } }
  }

  revalidatePath("/dashboard")
  revalidatePath("/inspections")
  if (parsed.data.load_id) {
    revalidatePath(`/loads/${parsed.data.load_id}`)
  }
  return {
    ok: true,
    id: data.id,
    severity: data.severity as "none" | "minor" | "major",
  }
}

const ATTACHMENT_BUCKET = "load-documents"
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024 // 25 MiB cap matches the bucket.

function safeExt(filename: string): string {
  const dot = filename.lastIndexOf(".")
  if (dot < 0 || dot === filename.length - 1) return ""
  const ext = filename.slice(dot + 1).toLowerCase()
  return /^[a-z0-9]{1,8}$/.test(ext) ? `.${ext}` : ""
}

// Uploads a photo / file attached to an inspection. Driver-side: they pick
// files when filing the report; admin-side reads them on the truck detail
// page so the audit trail isn't just text.
export async function uploadInspectionDocument(
  formData: FormData,
): Promise<{ ok: true; id: string } | { error: string }> {
  const me = await requireRole(["admin", "dispatcher", "driver"])

  const inspectionId = formData.get("inspection_id")
  const file = formData.get("file")
  if (typeof inspectionId !== "string" || !(file instanceof File)) {
    return { error: "Missing inspection id or file." }
  }
  if (file.size === 0) return { error: "File is empty." }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { error: `File exceeds ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MiB.` }
  }

  const supabase = await createClient()

  // RLS already restricts to the driver's own inspection, but verifying here
  // gives a clean error message.
  const { data: insp, error: lookupErr } = await supabase
    .from("inspections")
    .select("id")
    .eq("id", inspectionId)
    .maybeSingle()
  if (lookupErr || !insp) return { error: "Inspection not found." }

  const docId = crypto.randomUUID()
  const ext = safeExt(file.name)
  const objectPath = `inspections/${inspectionId}/${docId}${ext}`
  const buffer = await file.arrayBuffer()

  const { error: storageErr } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(objectPath, new Uint8Array(buffer), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })
  if (storageErr) return { error: storageErr.message }

  const { data: row, error: insertErr } = await supabase
    .from("documents")
    .insert({
      id: docId,
      inspection_id: inspectionId,
      type: "inspection",
      file_path: objectPath,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      uploaded_by: me.id,
    })
    .select("id")
    .single()

  if (insertErr || !row) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([objectPath])
    return { error: insertErr?.message ?? "Failed to record attachment." }
  }

  revalidatePath("/dashboard")
  return { ok: true, id: row.id }
}

// Uploads a file attached to a specific message in an inspection thread.
// Path scheme keeps everything under inspections/<inspection_id>/... so the
// existing storage RLS for that prefix covers admin / dispatcher / driver
// (driver scoped to their own inspections via the join).
export async function uploadInspectionMessageDocument(
  formData: FormData,
): Promise<{ ok: true; id: string } | { error: string }> {
  const me = await requireRole(["admin", "dispatcher", "driver"])

  const inspectionId = formData.get("inspection_id")
  const messageId = formData.get("message_id")
  const file = formData.get("file")
  if (
    typeof inspectionId !== "string" ||
    typeof messageId !== "string" ||
    !(file instanceof File)
  ) {
    return { error: "Missing inspection / message id or file." }
  }
  if (file.size === 0) return { error: "File is empty." }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { error: `File exceeds ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MiB.` }
  }

  const supabase = await createClient()

  // Verify the message belongs to the inspection (and that the user can see
  // the inspection — RLS handles the latter via select).
  const { data: message, error: msgErr } = await supabase
    .from("inspection_messages")
    .select("id, inspection_id")
    .eq("id", messageId)
    .maybeSingle()
  if (msgErr || !message || message.inspection_id !== inspectionId) {
    return { error: "Message not found." }
  }

  const docId = crypto.randomUUID()
  const ext = safeExt(file.name)
  const objectPath = `inspections/${inspectionId}/messages/${messageId}/${docId}${ext}`
  const buffer = await file.arrayBuffer()

  const { error: storageErr } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(objectPath, new Uint8Array(buffer), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })
  if (storageErr) return { error: storageErr.message }

  const { data: row, error: insertErr } = await supabase
    .from("documents")
    .insert({
      id: docId,
      inspection_id: inspectionId,
      inspection_message_id: messageId,
      type: "inspection",
      file_path: objectPath,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      uploaded_by: me.id,
    })
    .select("id")
    .single()

  if (insertErr || !row) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([objectPath])
    return { error: insertErr?.message ?? "Failed to record attachment." }
  }

  revalidatePath("/dashboard")
  return { ok: true, id: row.id }
}

// Posts a message on an inspection thread. Anyone with access (admin /
// dispatcher / the driver who filed it) can post; RLS enforces ownership.
export async function postInspectionMessage(input: {
  inspection_id: string
  message: string
}): Promise<{ ok: true; id: string } | { error: string }> {
  const me = await requireRole(["admin", "dispatcher", "driver"])

  const message = input.message.trim()
  if (!message) return { error: "Message can't be empty." }
  if (message.length > 2000)
    return { error: "Message is too long (2000-character limit)." }

  const supabase = await createClient()
  const { data: insp, error: fetchErr } = await supabase
    .from("inspections")
    .select("id, truck_id, driver_id")
    .eq("id", input.inspection_id)
    .maybeSingle()
  if (fetchErr || !insp) return { error: "Inspection not found." }

  if (me.role === "driver" && insp.driver_id !== me.id) {
    return { error: "You can only message on your own inspections." }
  }

  const { data, error } = await supabase
    .from("inspection_messages")
    .insert({
      inspection_id: input.inspection_id,
      author_id: me.id,
      author_role: me.role,
      message,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { error: error?.message ?? "Failed to post message." }
  }

  revalidatePath("/dashboard")
  revalidatePath(`/trucks/${insp.truck_id}`)
  return { ok: true, id: data.id }
}

// Marks a major-defect inspection as corrected. The DB trigger restores the
// truck to active status if no other open major defects remain.
export async function markInspectionCorrected(input: {
  id: string
  notes?: string
}): Promise<{ ok: true } | { error: string }> {
  const me = await requireRole(["admin"])

  const supabase = await createClient()
  const { data: row, error: fetchErr } = await supabase
    .from("inspections")
    .select("id, truck_id")
    .eq("id", input.id)
    .maybeSingle()
  if (fetchErr || !row) return { error: "Inspection not found." }

  const { error } = await supabase
    .from("inspections")
    .update({
      corrected_at: new Date().toISOString(),
      corrected_by: me.id,
      corrected_notes: input.notes?.trim() || null,
    })
    .eq("id", input.id)

  if (error) return { error: error.message }

  revalidatePath("/dashboard")
  revalidatePath("/trucks")
  revalidatePath(`/trucks/${row.truck_id}`)
  return { ok: true }
}
