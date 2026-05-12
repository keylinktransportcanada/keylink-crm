"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth"
import { MAX_DOCUMENT_BYTES } from "@/lib/schemas/documents"
import { createClient } from "@/lib/supabase/server"

type Result<T> = ({ ok: true } & T) | { error: string }

function safeExtension(filename: string): string {
  const dot = filename.lastIndexOf(".")
  if (dot < 0 || dot === filename.length - 1) return ""
  const ext = filename.slice(dot + 1).toLowerCase()
  return /^[a-z0-9]{1,8}$/.test(ext) ? `.${ext}` : ""
}

// Returns the existing 1:1 thread between the current user and `otherProfileId`
// or creates one. Atomic via the SECURITY DEFINER `create_direct_chat` RPC
// so the thread + both member rows go in together — no RLS race between the
// inserts.
export async function getOrCreateDirectThread(
  otherProfileId: string,
): Promise<Result<{ thread_id: string }>> {
  await requireRole(["admin", "dispatcher", "driver", "accounting"])
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("create_direct_chat", {
    p_other_profile_id: otherProfileId,
  })
  if (error || !data) {
    return { error: error?.message ?? "Failed to create thread." }
  }

  revalidatePath("/messages")
  return { ok: true, thread_id: data as string }
}

export async function sendChatMessage(formData: FormData): Promise<
  Result<{ message_id: string }>
> {
  const me = await requireRole(["admin", "dispatcher", "driver", "accounting"])

  const threadId = formData.get("thread_id")
  const body = formData.get("body")
  if (typeof threadId !== "string" || typeof body !== "string") {
    return { error: "Missing thread or body." }
  }
  const trimmed = body.trim()
  if (trimmed.length === 0) return { error: "Message is empty." }
  if (trimmed.length > 10000) return { error: "Message is too long." }

  const supabase = await createClient()

  const { data: row, error } = await supabase
    .from("chat_messages")
    .insert({ thread_id: threadId, author_id: me.id, body: trimmed })
    .select("id")
    .single()
  if (error || !row) return { error: error?.message ?? "Send failed." }

  // Bump our own last_read_at so we don't see our own message as unread.
  await supabase
    .from("chat_thread_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("profile_id", me.id)

  revalidatePath("/messages")
  return { ok: true, message_id: row.id }
}

export async function uploadChatAttachment(
  formData: FormData,
): Promise<Result<{ document_id: string }>> {
  const me = await requireRole(["admin", "dispatcher", "driver", "accounting"])

  const messageId = formData.get("message_id")
  const threadId = formData.get("thread_id")
  const file = formData.get("file")
  if (
    typeof messageId !== "string" ||
    typeof threadId !== "string" ||
    !(file instanceof File)
  ) {
    return { error: "Missing message id, thread id, or file." }
  }
  if (file.size === 0) return { error: "File is empty." }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { error: `File exceeds ${MAX_DOCUMENT_BYTES / 1024 / 1024} MiB.` }
  }

  const supabase = await createClient()

  // Verify the message belongs to us and to the named thread.
  const { data: message } = await supabase
    .from("chat_messages")
    .select("id, author_id, thread_id")
    .eq("id", messageId)
    .maybeSingle()
  if (!message || message.author_id !== me.id || message.thread_id !== threadId) {
    return { error: "Message not found." }
  }

  const docId = crypto.randomUUID()
  const ext = safeExtension(file.name)
  const objectPath = `chat/${threadId}/${messageId}/${docId}${ext}`

  const arrayBuf = await file.arrayBuffer()
  const { error: storageErr } = await supabase.storage
    .from("load-documents")
    .upload(objectPath, new Uint8Array(arrayBuf), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })
  if (storageErr) return { error: storageErr.message }

  const { data: doc, error: insertErr } = await supabase
    .from("documents")
    .insert({
      id: docId,
      chat_message_id: messageId,
      type: "other",
      file_path: objectPath,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      uploaded_by: me.id,
    })
    .select("id")
    .single()

  if (insertErr || !doc) {
    await supabase.storage.from("load-documents").remove([objectPath])
    return { error: insertErr?.message ?? "Failed to record attachment." }
  }

  revalidatePath("/messages")
  return { ok: true, document_id: doc.id }
}

// Deletes a thread for everyone in it. Either party in a DM can do this.
// Purges storage attachments first so the bucket doesn't accumulate orphans
// (chat/<thread_id>/<msg_id>/<doc_id>.<ext>). Cascades on the table layer
// handle messages, members, and attachment rows.
export async function deleteChatThread(
  threadId: string,
): Promise<Result<object>> {
  await requireRole(["admin", "dispatcher", "driver", "accounting"])
  const supabase = await createClient()

  // List every object under chat/<thread_id>/ and bulk-remove. Storage RLS
  // already restricts this to thread members.
  const prefix = `chat/${threadId}`
  const objectPaths: string[] = []
  // Recurse through the bucket tree. The bucket only has 2-3 levels deep
  // (chat/<thread>/<msg>/<doc>.<ext>), so two list() calls are enough.
  const { data: msgFolders } = await supabase.storage
    .from("load-documents")
    .list(prefix, { limit: 1000 })
  for (const folder of msgFolders ?? []) {
    const folderPath = `${prefix}/${folder.name}`
    const { data: files } = await supabase.storage
      .from("load-documents")
      .list(folderPath, { limit: 1000 })
    for (const file of files ?? []) {
      objectPaths.push(`${folderPath}/${file.name}`)
    }
  }
  if (objectPaths.length > 0) {
    await supabase.storage.from("load-documents").remove(objectPaths)
  }

  const { error } = await supabase
    .from("chat_threads")
    .delete()
    .eq("id", threadId)
  if (error) return { error: error.message }

  revalidatePath("/messages")
  return { ok: true }
}

export async function markThreadRead(threadId: string): Promise<Result<object>> {
  const me = await requireRole(["admin", "dispatcher", "driver", "accounting"])
  const supabase = await createClient()
  const { error } = await supabase
    .from("chat_thread_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("profile_id", me.id)
  if (error) return { error: error.message }
  revalidatePath("/messages")
  return { ok: true }
}
