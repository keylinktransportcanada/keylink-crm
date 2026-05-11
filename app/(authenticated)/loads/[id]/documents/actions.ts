"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth"
import {
  DOCUMENT_TYPE_VALUES,
  MAX_DOCUMENT_BYTES,
  type DocumentType,
} from "@/lib/schemas/documents"
import { createClient } from "@/lib/supabase/server"

const BUCKET = "load-documents"

type ActionResult =
  | { ok: true; id: string; file_path: string }
  | { error: string }

function safeExtension(filename: string): string {
  const dot = filename.lastIndexOf(".")
  if (dot < 0 || dot === filename.length - 1) return ""
  const ext = filename.slice(dot + 1).toLowerCase()
  // Strip anything funky — exts should be ASCII letters/digits.
  return /^[a-z0-9]{1,8}$/.test(ext) ? `.${ext}` : ""
}

export async function uploadLoadDocument(
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireRole(["admin", "dispatcher", "accounting", "driver"])

  const loadId = formData.get("load_id")
  const type = formData.get("type")
  const file = formData.get("file")

  if (
    typeof loadId !== "string" ||
    typeof type !== "string" ||
    !(file instanceof File)
  ) {
    return { error: "Missing load id, document type, or file." }
  }

  const docType = type as DocumentType
  if (!DOCUMENT_TYPE_VALUES.includes(docType)) {
    return { error: "Unknown document type." }
  }

  if (file.size === 0) return { error: "File is empty." }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { error: `File exceeds ${MAX_DOCUMENT_BYTES / 1024 / 1024} MiB.` }
  }

  // Role-specific extra restrictions — mirror the table RLS so we fail early
  // with a friendly message instead of letting Postgres reject the insert.
  if (me.role === "accounting" && docType !== "invoice") {
    return { error: "Accounting can only upload invoices." }
  }

  const supabase = await createClient()

  // Make sure the load exists and is visible to this user — RLS on `loads`
  // enforces the same thing for the storage path policy below.
  const { data: load, error: loadErr } = await supabase
    .from("loads")
    .select("id")
    .eq("id", loadId)
    .maybeSingle()
  if (loadErr || !load) {
    return { error: "Load not found." }
  }

  // Generate the storage path: loads/<load_id>/<rand>.<ext> — keeps original
  // filename out of the path (avoids encoding issues) and lets us index per
  // load cheaply.
  const docId = crypto.randomUUID()
  const ext = safeExtension(file.name)
  const objectPath = `loads/${loadId}/${docId}${ext}`

  const arrayBuf = await file.arrayBuffer()
  const { error: storageErr } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, new Uint8Array(arrayBuf), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })
  if (storageErr) return { error: storageErr.message }

  const { data: row, error: insertErr } = await supabase
    .from("documents")
    .insert({
      id: docId,
      load_id: loadId,
      type: docType,
      file_path: objectPath,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      uploaded_by: me.id,
    })
    .select("id, file_path")
    .single()

  if (insertErr || !row) {
    // Best-effort cleanup so we don't leave orphaned objects.
    await supabase.storage.from(BUCKET).remove([objectPath])
    return { error: insertErr?.message ?? "Failed to record document." }
  }

  revalidatePath(`/loads/${loadId}`)
  revalidatePath("/loads")
  return { ok: true, id: row.id, file_path: row.file_path }
}

export async function deleteLoadDocument(
  documentId: string,
): Promise<{ ok: true } | { error: string }> {
  await requireRole(["admin", "dispatcher"])

  const supabase = await createClient()

  const { data: doc, error: fetchErr } = await supabase
    .from("documents")
    .select("id, load_id, file_path")
    .eq("id", documentId)
    .maybeSingle()

  if (fetchErr || !doc) return { error: "Document not found." }

  const { error: storageErr } = await supabase.storage
    .from("load-documents")
    .remove([doc.file_path])
  if (storageErr) return { error: storageErr.message }

  const { error: dbErr } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
  if (dbErr) return { error: dbErr.message }

  if (doc.load_id) {
    revalidatePath(`/loads/${doc.load_id}`)
    revalidatePath("/loads")
  }
  return { ok: true }
}

// Issues a short-lived signed URL for downloading or previewing a document.
// 60s is enough for a click-to-download or a thumbnail render; longer leaks
// nothing extra but invites browser caching of the URL itself.
export async function getDocumentSignedUrl(
  filePath: string,
): Promise<{ url: string } | { error: string }> {
  await requireRole(["admin", "dispatcher", "accounting", "driver"])
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from("load-documents")
    .createSignedUrl(filePath, 60)
  if (error || !data) return { error: error?.message ?? "Sign failed." }
  return { url: data.signedUrl }
}
