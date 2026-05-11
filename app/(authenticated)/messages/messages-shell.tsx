"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format, formatDistanceToNow, parseISO } from "date-fns"
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  Send,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ROLE_META } from "@/components/shared/role-badge"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

import {
  getOrCreateDirectThread,
  markThreadRead,
  sendChatMessage,
  uploadChatAttachment,
} from "./actions"
import type { ChatThreadMessage, ChatAttachment } from "./page"

export type ChatPerson = {
  id: string
  full_name: string
  role: "admin" | "dispatcher" | "driver" | "accounting"
  employee_id: string | null
  avatar_url: string | null
}
export type ChatThreadSummary = {
  id: string
  type: "direct" | "group"
  title: string
  others: ChatPerson[]
  lastMessage: { body: string; created_at: string; author_id: string } | null
  unreadCount: number
  updatedAt: string
}

export function MessagesShell({
  me,
  people,
  threads,
  activeThreadId,
  initialMessages,
  requestedWith,
}: {
  me: ChatPerson
  people: ChatPerson[]
  threads: ChatThreadSummary[]
  activeThreadId: string | null
  initialMessages: ChatThreadMessage[]
  requestedWith: string | null
}) {
  const router = useRouter()
  const search = useSearchParams()
  const [busy, startTransition] = useTransition()
  const [body, setBody] = useState("")
  const [showPeoplePicker, setShowPeoplePicker] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId],
  )

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [initialMessages.length])

  // Mark thread as read when the user opens it.
  useEffect(() => {
    if (!activeThreadId) return
    markThreadRead(activeThreadId)
  }, [activeThreadId])

  // Subscribe to chat_messages for the active thread so messages appear
  // live. The global RealtimeRefresher already triggers a server refresh
  // on any chat_messages event; this scoped listener is just for the
  // composer-side acknowledgement when our own message lands.
  useEffect(() => {
    if (!activeThreadId) return
    const supabase = createClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function attach() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }
      channel = supabase
        .channel(`chat-thread-${activeThreadId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `thread_id=eq.${activeThreadId}`,
          },
          () => {
            router.refresh()
          },
        )
        .subscribe()
    }

    attach()
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [activeThreadId, router])

  const openThread = (threadId: string) => {
    const params = new URLSearchParams(search.toString())
    params.set("thread", threadId)
    params.delete("with")
    router.push(`/messages?${params.toString()}`)
  }

  const startChatWith = (personId: string) => {
    setShowPeoplePicker(false)
    startTransition(async () => {
      const result = await getOrCreateDirectThread(personId)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      const params = new URLSearchParams()
      params.set("thread", result.thread_id)
      router.push(`/messages?${params.toString()}`)
      router.refresh()
    })
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeThreadId) return
    const trimmed = body.trim()
    if (trimmed.length === 0) return
    const fileToUpload = fileInputRef.current?.files?.[0] ?? null

    startTransition(async () => {
      const fd = new FormData()
      fd.set("thread_id", activeThreadId)
      fd.set("body", trimmed)
      const result = await sendChatMessage(fd)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      if (fileToUpload) {
        const upFd = new FormData()
        upFd.set("message_id", result.message_id)
        upFd.set("thread_id", activeThreadId)
        upFd.set("file", fileToUpload)
        const upResult = await uploadChatAttachment(upFd)
        if ("error" in upResult) {
          toast.error(`Attachment failed: ${upResult.error}`)
        }
      }
      setBody("")
      if (fileInputRef.current) fileInputRef.current.value = ""
      router.refresh()
    })
  }

  // Pre-populate the right pane when the URL says ?with= and we don't yet
  // have a thread — open the picker and bounce through the create flow.
  useEffect(() => {
    if (!requestedWith) return
    startChatWith(requestedWith)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedWith])

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Real-time chat with everyone on the team. Files and timestamps
            included.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setShowPeoplePicker((v) => !v)}
        >
          <MessageSquarePlus className="size-4" />
          New chat
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
        {/* Left rail — threads + people */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-border/60">
          <div className="border-b border-border/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
            Conversations
          </div>
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <div className="px-4 py-6 text-xs text-muted-foreground">
                No chats yet. Click <strong>New chat</strong> to start one.
              </div>
            ) : (
              <ul className="flex flex-col">
                {threads.map((t) => (
                  <ThreadRow
                    key={t.id}
                    thread={t}
                    active={t.id === activeThreadId}
                    onClick={() => openThread(t.id)}
                  />
                ))}
              </ul>
            )}
          </div>

          {showPeoplePicker ? (
            <div className="border-t border-border/60">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
                  Start a chat with…
                </span>
                <button
                  type="button"
                  onClick={() => setShowPeoplePicker(false)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close picker"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <ul className="flex max-h-64 flex-col overflow-y-auto">
                {people.length === 0 ? (
                  <li className="px-4 py-3 text-xs italic text-muted-foreground">
                    No teammates available.
                  </li>
                ) : (
                  people.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startChatWith(p.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40 disabled:opacity-60"
                      >
                        <UserAvatar
                          url={p.avatar_url}
                          seed={p.id}
                          name={p.full_name}
                          size="sm"
                        />
                        <div className="flex flex-1 flex-col leading-tight overflow-hidden">
                          <span className="truncate text-sm font-medium">
                            {p.full_name}
                          </span>
                          <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                            {ROLE_META[p.role]?.label ?? p.role}
                            {p.employee_id ? ` · ${p.employee_id}` : ""}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}
        </aside>

        {/* Right pane — active thread */}
        <section className="flex min-w-0 flex-1 flex-col">
          {activeThread ? (
            <>
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                {activeThread.type === "direct" && activeThread.others[0] ? (
                  <UserAvatar
                    url={activeThread.others[0].avatar_url}
                    seed={activeThread.others[0].id}
                    name={activeThread.others[0].full_name}
                    size="md"
                  />
                ) : (
                  <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                    <Users className="size-4 text-muted-foreground" />
                  </span>
                )}
                <div className="flex flex-1 flex-col leading-tight">
                  <span className="text-sm font-semibold">
                    {activeThread.title}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {activeThread.type === "direct"
                      ? (activeThread.others[0]?.role
                          ? ROLE_META[activeThread.others[0].role]?.label
                          : "") || "Direct"
                      : `${activeThread.others.length + 1} members`}
                  </span>
                </div>
              </div>
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto bg-muted/10 px-4 py-3"
              >
                {initialMessages.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                    No messages yet. Send the first one below.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {initialMessages.map((m) => (
                      <MessageBubble key={m.id} message={m} />
                    ))}
                  </ul>
                )}
              </div>
              <form
                onSubmit={submit}
                className="flex items-end gap-2 border-t border-border/60 bg-card p-3"
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Attach a file"
                  aria-label="Attach a file"
                  disabled={busy}
                >
                  <Paperclip className="size-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      submit(e as unknown as React.FormEvent)
                    }
                  }}
                  rows={1}
                  placeholder="Type a message…"
                  className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal-light"
                  disabled={busy}
                />
                <Button type="submit" disabled={busy || body.trim().length === 0}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Send
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <Users className="size-7 text-muted-foreground" />
              <p className="text-sm font-medium">Pick a conversation</p>
              <p className="max-w-[280px] text-xs text-muted-foreground">
                Choose a thread on the left, or start a new one with someone
                from your team.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowPeoplePicker(true)}
                className="mt-2"
              >
                <MessageSquarePlus className="size-4" />
                New chat
              </Button>
            </div>
          )}
        </section>
      </div>

      {/* Hide me away from layout, keep for accessibility */}
      <span className="sr-only">Signed in as {me.full_name}</span>
    </div>
  )
}

function ThreadRow({
  thread,
  active,
  onClick,
}: {
  thread: ChatThreadSummary
  active: boolean
  onClick: () => void
}) {
  const other = thread.others[0]
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2 border-b border-border/30 px-3 py-2 text-left transition-colors",
          active ? "bg-brand-teal/10" : "hover:bg-muted/40",
        )}
      >
        {thread.type === "direct" && other ? (
          <UserAvatar
            url={other.avatar_url}
            seed={other.id}
            name={other.full_name}
            size="sm"
          />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <Users className="size-4 text-muted-foreground" />
          </span>
        )}
        <div className="flex flex-1 flex-col leading-tight overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{thread.title}</span>
            {thread.lastMessage ? (
              <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                {formatDistanceToNow(parseISO(thread.lastMessage.created_at), {
                  addSuffix: false,
                })}
              </span>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] text-muted-foreground">
              {thread.lastMessage ? thread.lastMessage.body : "No messages yet"}
            </span>
            {thread.unreadCount > 0 ? (
              <span className="shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                {thread.unreadCount}
              </span>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  )
}

function MessageBubble({ message }: { message: ChatThreadMessage }) {
  return (
    <li
      className={cn(
        "flex flex-col gap-1",
        message.isMine ? "items-end" : "items-start",
      )}
    >
      {!message.isMine ? (
        <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {message.author_name}
        </span>
      ) : null}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
          message.isMine
            ? "bg-brand-teal text-white"
            : "bg-card border border-border/60 text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        {message.attachments.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1.5">
            {message.attachments.map((a) => (
              <Attachment key={a.id} attachment={a} mine={message.isMine} />
            ))}
          </ul>
        ) : null}
      </div>
      <span className="px-2 text-[10px] text-muted-foreground tabular-nums">
        {format(parseISO(message.created_at), "MMM d · h:mm a")}
      </span>
    </li>
  )
}

function Attachment({
  attachment,
  mine,
}: {
  attachment: ChatAttachment
  mine: boolean
}) {
  const isImage = attachment.mime_type.startsWith("image/")
  if (isImage && attachment.signed_url) {
    return (
      <li>
        <a
          href={attachment.signed_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-md border border-white/20"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.signed_url}
            alt={attachment.file_name}
            className="max-h-64 object-cover"
          />
        </a>
      </li>
    )
  }
  return (
    <li>
      <a
        href={attachment.signed_url ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs",
          mine
            ? "border-white/30 bg-white/10"
            : "border-border bg-muted/30",
        )}
      >
        {isImage ? (
          <ImageIcon className="size-3.5" />
        ) : (
          <FileText className="size-3.5" />
        )}
        <span className="max-w-[180px] truncate">{attachment.file_name}</span>
      </a>
    </li>
  )
}
