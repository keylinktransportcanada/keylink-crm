import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

import { MessagesShell, type ChatPerson, type ChatThreadSummary } from "./messages-shell"

export const dynamic = "force-dynamic"

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string; with?: string }>
}) {
  const me = await requireRole(["admin", "dispatcher", "driver", "accounting"])
  const sp = await searchParams
  const supabase = await createClient()

  // Everyone (other than me) that can be DM'd. Drivers can't initiate chats
  // with each other in v1 — they can only message admin / dispatcher.
  let peopleQuery = supabase
    .from("profiles")
    .select("id, full_name, role, employee_id, avatar_url, active")
    .eq("active", true)
    .neq("id", me.id)
    .order("full_name", { ascending: true })
  if (me.role === "driver") {
    peopleQuery = peopleQuery.in("role", ["admin", "dispatcher"])
  }
  const { data: rawPeople } = await peopleQuery
  const people: ChatPerson[] = (rawPeople ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    role: p.role,
    employee_id: p.employee_id,
    avatar_url: p.avatar_url,
  }))

  // My threads — read members + last message via separate queries so we
  // don't fight with Postgrest relation hints.
  const { data: myMemberships } = await supabase
    .from("chat_thread_members")
    .select("thread_id, last_read_at")
    .eq("profile_id", me.id)
  const threadIds = (myMemberships ?? []).map((m) => m.thread_id)
  const readByThread = new Map(
    (myMemberships ?? []).map((m) => [m.thread_id, m.last_read_at] as const),
  )

  const { data: threadsRaw } = threadIds.length
    ? await supabase
        .from("chat_threads")
        .select("id, type, title, updated_at")
        .in("id", threadIds)
        .order("updated_at", { ascending: false })
    : { data: [] }

  // All members across my threads (for direct-thread participant resolution
  // and any group thread roster display).
  const { data: allMembers } = threadIds.length
    ? await supabase
        .from("chat_thread_members")
        .select("thread_id, profile_id")
        .in("thread_id", threadIds)
    : { data: [] }

  const peopleById = new Map(people.map((p) => [p.id, p] as const))

  // Pull profile rows for everyone we haven't already cached (e.g. inactive
  // peers, or peers outside the visible "people" list for drivers).
  const knownIds = new Set<string>([me.id, ...people.map((p) => p.id)])
  const extraIds = Array.from(
    new Set(
      (allMembers ?? [])
        .map((m) => m.profile_id)
        .filter((id) => !knownIds.has(id)),
    ),
  )
  if (extraIds.length > 0) {
    const { data: extras } = await supabase
      .from("profiles")
      .select("id, full_name, role, employee_id, avatar_url")
      .in("id", extraIds)
    for (const p of extras ?? []) {
      peopleById.set(p.id, {
        id: p.id,
        full_name: p.full_name,
        role: p.role,
        employee_id: p.employee_id,
        avatar_url: p.avatar_url,
      })
    }
  }

  // Most recent message per thread for the conversation-list preview.
  const { data: latestMsgs } = threadIds.length
    ? await supabase
        .from("chat_messages")
        .select("id, thread_id, author_id, body, created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false })
    : { data: [] }
  const latestByThread = new Map<
    string,
    { author_id: string; body: string; created_at: string }
  >()
  for (const m of latestMsgs ?? []) {
    if (!latestByThread.has(m.thread_id)) {
      latestByThread.set(m.thread_id, {
        author_id: m.author_id,
        body: m.body,
        created_at: m.created_at,
      })
    }
  }

  // Unread count = messages in thread newer than my last_read_at, not by me.
  const unreadByThread = new Map<string, number>()
  for (const m of latestMsgs ?? []) {
    if (m.author_id === me.id) continue
    const myRead = readByThread.get(m.thread_id) ?? "1970-01-01T00:00:00Z"
    if (m.created_at > myRead) {
      unreadByThread.set(m.thread_id, (unreadByThread.get(m.thread_id) ?? 0) + 1)
    }
  }

  const threads: ChatThreadSummary[] = (threadsRaw ?? []).map((t) => {
    const memberIds = (allMembers ?? [])
      .filter((m) => m.thread_id === t.id)
      .map((m) => m.profile_id)
    const otherIds = memberIds.filter((id) => id !== me.id)
    const others = otherIds
      .map((id) => peopleById.get(id))
      .filter((p): p is ChatPerson => !!p)
    const last = latestByThread.get(t.id)
    return {
      id: t.id,
      type: t.type,
      title:
        t.type === "group"
          ? t.title ?? "Group chat"
          : others[0]?.full_name ?? "Unknown",
      others,
      lastMessage: last
        ? { body: last.body, created_at: last.created_at, author_id: last.author_id }
        : null,
      unreadCount: unreadByThread.get(t.id) ?? 0,
      updatedAt: t.updated_at,
    }
  })

  // If the URL says `?with=<profileId>` and we don't already have a thread
  // with that person, pre-populate the right-pane "new chat" state.
  const requestedWith = sp.with ?? null
  const requestedThread = sp.thread ?? null

  // Resolve the initially-open thread: explicit ?thread= wins, then the
  // newest thread we're in, then null (empty state).
  const activeThreadId =
    requestedThread && threadIds.includes(requestedThread)
      ? requestedThread
      : threads[0]?.id ?? null

  // Pull messages for the active thread on the server so first paint has
  // content. The client component subscribes to realtime for updates.
  let initialMessages: ChatThreadMessage[] = []
  if (activeThreadId) {
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("id, thread_id, author_id, body, created_at")
      .eq("thread_id", activeThreadId)
      .order("created_at", { ascending: true })

    // Sign URLs for any attachments on those messages.
    const messageIds = (msgs ?? []).map((m) => m.id)
    const { data: rawAttachments } = messageIds.length
      ? await supabase
          .from("documents")
          .select(
            "id, chat_message_id, file_path, file_name, mime_type, size_bytes",
          )
          .in("chat_message_id", messageIds)
      : { data: [] }
    const attachmentsByMsg = new Map<string, ChatAttachment[]>()
    for (const att of rawAttachments ?? []) {
      if (!att.chat_message_id) continue
      const { data: signed } = await supabase.storage
        .from("load-documents")
        .createSignedUrl(att.file_path, 600)
      const list = attachmentsByMsg.get(att.chat_message_id) ?? []
      list.push({
        id: att.id,
        file_name: att.file_name,
        mime_type: att.mime_type,
        size_bytes: Number(att.size_bytes),
        signed_url: signed?.signedUrl ?? null,
      })
      attachmentsByMsg.set(att.chat_message_id, list)
    }

    initialMessages = (msgs ?? []).map((m) => ({
      id: m.id,
      author_id: m.author_id,
      author_name: peopleById.get(m.author_id)?.full_name ?? (m.author_id === me.id ? me.full_name : "Unknown"),
      body: m.body,
      created_at: m.created_at,
      isMine: m.author_id === me.id,
      attachments: attachmentsByMsg.get(m.id) ?? [],
    }))
  }

  return (
    <MessagesShell
      me={{
        id: me.id,
        full_name: me.full_name,
        role: me.role,
        employee_id: me.employee_id,
        avatar_url: me.avatar_url,
      }}
      people={people}
      threads={threads}
      activeThreadId={activeThreadId}
      initialMessages={initialMessages}
      requestedWith={requestedWith}
    />
  )
}

export type ChatThreadMessage = {
  id: string
  author_id: string
  author_name: string
  body: string
  created_at: string
  isMine: boolean
  attachments: ChatAttachment[]
}
export type ChatAttachment = {
  id: string
  file_name: string
  mime_type: string
  size_bytes: number
  signed_url: string | null
}
