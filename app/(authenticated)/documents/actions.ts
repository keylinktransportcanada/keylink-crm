"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth"
import {
  DOCUMENT_TYPE_VALUES,
  MAX_DOCUMENT_BYTES,
  type DocumentType,
} from "@/lib/schemas/documents"
import { createClient } from "@/lib/supabase/server"
import type { TablesInsert } from "@/lib/supabase/types"

const BUCKET = "load-documents"

export type DocumentScope = "truck" | "driver" | "trailer"

type ActionResult =
  | { ok: true; id: string; file_path: string }
  | { error: string }

function safeExtension(filename: string): string {
  const dot = filename.lastIndexOf(".")
  if (dot < 0 || dot === filename.length - 1) return ""
  const ext = filename.slice(dot + 1).toLowerCase()
  return /^[a-z0-9]{1,8}$/.test(ext) ? `.${ext}` : ""
}

function pathPrefixFor(scope: DocumentScope): string {
  switch (scope) {
    case "truck": return "trucks"
    case "driver": return "drivers"
    case "trailer": return "trailers"
  }
}

function revalidateScope(scope: DocumentScope, entityId: string) {
  switch (scope) {
    case "truck":
      revalidatePath(`/trucks/${entityId}`)
      revalidatePath("/trucks")
      break
    case "driver":
      revalidatePath(`/drivers/${entityId}`)
      revalidatePath("/drivers")
      revalidatePath("/dashboard")
      break
    case "trailer":
      revalidatePath("/trailers")
      break
  }
  revalidatePath("/dashboard")
}

export async function uploadEntityDocument(
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireRole(["admin", "dispatcher"])

  const scope = formData.get("scope")
  const entityId = formData.get("entity_id")
  const type = formData.get("type")
  const file = formData.get("file")
  const expiryRaw = formData.get("expiry_date")

  if (
    typeof scope !== "string" ||
    !["truck", "driver", "trailer"].includes(scope) ||
    typeof entityId !== "string" ||
    typeof type !== "string" ||
    !(file instanceof File)
  ) {
    return { error: "Missing scope, entity, type, or file." }
  }

  const docType = type as DocumentType
  if (!DOCUMENT_TYPE_VALUES.includes(docType)) {
    return { error: "Unknown document type." }
  }

  if (file.size === 0) return { error: "File is empty." }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { error: `File exceeds ${MAX_DOCUMENT_BYTES / 1024 / 1024} MiB.` }
  }

  let expiry: string | null = null
  if (typeof expiryRaw === "string" && expiryRaw.trim().length > 0) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryRaw)) {
      return { error: "Invalid expiry date." }
    }
    expiry = expiryRaw
  }

  const docScope = scope as DocumentScope
  const supabase = await createClient()
  const docId = crypto.randomUUID()
  const ext = safeExtension(file.name)
  const objectPath = `${pathPrefixFor(docScope)}/${entityId}/${docId}${ext}`

  const arrayBuf = await file.arrayBuffer()
  const { error: storageErr } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, new Uint8Array(arrayBuf), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })
  if (storageErr) return { error: storageErr.message }

  const insertRow: TablesInsert<"documents"> = {
    id: docId,
    type: docType,
    file_path: objectPath,
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    expiry_date: expiry,
    uploaded_by: me.id,
    truck_id: docScope === "truck" ? entityId : null,
    driver_id: docScope === "driver" ? entityId : null,
    trailer_id: docScope === "trailer" ? entityId : null,
  }

  const { data: row, error: insertErr } = await supabase
    .from("documents")
    .insert(insertRow)
    .select("id, file_path")
    .single()

  if (insertErr || !row) {
    await supabase.storage.from(BUCKET).remove([objectPath])
    return { error: insertErr?.message ?? "Failed to record document." }
  }

  revalidateScope(docScope, entityId)
  return { ok: true, id: row.id, file_path: row.file_path }
}

export async function deleteEntityDocument(
  documentId: string,
): Promise<{ ok: true } | { error: string }> {
  await requireRole(["admin", "dispatcher"])

  const supabase = await createClient()

  const { data: doc, error: fetchErr } = await supabase
    .from("documents")
    .select("id, truck_id, driver_id, trailer_id, file_path")
    .eq("id", documentId)
    .maybeSingle()

  if (fetchErr || !doc) return { error: "Document not found." }

  const { error: storageErr } = await supabase.storage
    .from(BUCKET)
    .remove([doc.file_path])
  if (storageErr) return { error: storageErr.message }

  const { error: dbErr } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
  if (dbErr) return { error: dbErr.message }

  if (doc.truck_id) revalidateScope("truck", doc.truck_id)
  if (doc.driver_id) revalidateScope("driver", doc.driver_id)
  if (doc.trailer_id) revalidateScope("trailer", doc.trailer_id)
  return { ok: true }
}

export async function getEntityDocumentSignedUrl(
  filePath: string,
): Promise<{ url: string } | { error: string }> {
  await requireRole(["admin", "dispatcher", "accounting", "driver"])
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60)
  if (error || !data) return { error: error?.message ?? "Sign failed." }
  return { url: data.signedUrl }
}
