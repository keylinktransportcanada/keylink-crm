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
// or creates one. Idempotent: repeated calls with the same pair return the
// same thread id.
export async function getOrCreateDirectThread(
  otherProfileId: string,
): Promise<Result<{ thread_id: string }>> {
  const me = await requireRole(["admin", "dispatcher", "driver", "accounting"])
  if (me.id === otherProfileId) {
    return { error: "Cannot start a chat with yourself." }
  }

  const supabase = await createClient()

  // Confirm the target profile exists and is active.
  const { data: other, error: otherErr } = await supabase
    .from("profiles")
    .select("id, active")
    .eq("id", otherProfileId)
    .maybeSingle()
  if (otherErr || !other) return { error: "Teammate not found." }
  if (!other.active) return { error: "Teammate is inactive." }

  // Find an existing direct thread where both of us are members.
  const { data: mine } = await supabase
    .from("chat_thread_members")
    .select("thread_id, chat_threads!inner(type)")
    .eq("profile_id", me.id)
  const myThreadIds = (
    mine as
      | Array<{
          thread_id: string
          chat_threads: { type: string } | { type: string }[]
        }>
      | null
  )
    ?.filter((r) => {
      const t = Array.isArray(r.chat_threads) ? r.chat_threads[0] : r.chat_threads
      return t?.type === "direct"
    })
    .map((r) => r.thread_id) ?? []

  if (myThreadIds.length > 0) {
    const { data: shared } = await supabase
      .from("chat_thread_members")
      .select("thread_id")
      .eq("profile_id", otherProfileId)
      .in("thread_id", myThreadIds)
      .limit(1)
      .maybeSingle()
    if (shared) {
      return { ok: true, thread_id: shared.thread_id }
    }
  }

  // None exists — create the thread and add both members.
  const { data: thread, error: tErr } = await supabase
    .from("chat_threads")
    .insert({ type: "direct", created_by: me.id })
    .select("id")
    .single()
  if (tErr || !thread) {
    return { error: tErr?.message ?? "Failed to create thread." }
  }

  const { error: mErr } = await supabase.from("chat_thread_members").insert([
    { thread_id: thread.id, profile_id: me.id },
    { thread_id: thread.id, profile_id: otherProfileId },
  ])
  if (mErr) {
    // Best-effort cleanup
    await supabase.from("chat_threads").delete().eq("id", thread.id)
    return { error: mErr.message }
  }

  revalidatePath("/messages")
  return { ok: true, thread_id: thread.id }
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
