"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState, useTransition } from "react"
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  MessageCircle,
  MessageSquare,
  Search,
  Truck,
} from "lucide-react"

import { CommandPalette } from "./command-palette"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { signOutAction } from "@/app/(public)/login/actions"
import type { CurrentProfile } from "@/lib/auth"
import type { Notification } from "@/lib/notifications"
import { cn } from "@/lib/utils"

import { AvatarPickerDialog } from "./avatar-picker-dialog"
import { UserAvatar } from "./user-avatar"

const ROLE_LABEL: Record<CurrentProfile["role"], string> = {
  admin: "Admin",
  dispatcher: "Dispatcher",
  driver: "Driver",
  accounting: "Accounting",
}

const SEVERITY_DOT: Record<Notification["severity"], string> = {
  expired: "bg-red-500",
  critical: "bg-red-400",
  warning: "bg-amber-400",
  ok: "bg-emerald-400",
}

const SEVERITY_TAG: Record<Notification["severity"], string> = {
  expired: "bg-red-500/25 text-red-100",
  critical: "bg-red-500/20 text-red-100",
  warning: "bg-amber-500/20 text-amber-100",
  ok: "bg-emerald-500/20 text-emerald-100",
}

// Persisted client-side. The bell badge only counts notifications whose id is
// not already in this set — opening the popover writes the current set of ids
// here so the badge clears the next render. Cross-device sync isn't worth the
// schema cost for a transient UI affordance.
const SEEN_STORAGE_KEY = "keylink:notif-seen-ids"

export function AppTopbar({
  profile,
  notifications,
  chatUnreadCount = 0,
}: {
  profile: CurrentProfile
  notifications: Notification[]
  chatUnreadCount?: number
}) {
  const [pending, startTransition] = useTransition()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  // null until hydrated — keeps the SSR markup deterministic (no badge) and
  // avoids a hydration mismatch on the count.
  const [seenIds, setSeenIds] = useState<Set<string> | null>(null)

  // Global Cmd+K / Ctrl+K toggles the command palette.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SEEN_STORAGE_KEY)
      setSeenIds(new Set(raw ? (JSON.parse(raw) as string[]) : []))
    } catch {
      setSeenIds(new Set())
    }
  }, [])

  // Snapshot every visible notification id when the popover opens — that's
  // the "checked" moment.
  useEffect(() => {
    if (!popoverOpen) return
    const ids = notifications.map((n) => n.id)
    setSeenIds(new Set(ids))
    try {
      window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(ids))
    } catch {
      // localStorage unavailable (private mode etc.) — badge will clear in
      // memory for the session, just won't survive a reload.
    }
  }, [popoverOpen, notifications])

  // Mark inspection-message ids as seen when the chat popover opens. Shares
  // the same seen-set as the bell so opening either one clears the message
  // count on both.
  useEffect(() => {
    if (!chatOpen || !seenIds) return
    const next = new Set(seenIds)
    let added = false
    for (const n of notifications) {
      if (n.id.startsWith("inspection-message:") && !next.has(n.id)) {
        next.add(n.id)
        added = true
      }
    }
    if (!added) return
    setSeenIds(next)
    try {
      window.localStorage.setItem(
        SEEN_STORAGE_KEY,
        JSON.stringify(Array.from(next)),
      )
    } catch {
      // ignore
    }
  }, [chatOpen, notifications, seenIds])

  const {
    inspections,
    inspectionMessages,
    expiries,
    statusEvents,
    urgentCount,
    totalCount,
    unseenCount,
    unseenUrgent,
    unseenChatCount,
  } = useMemo(() => {
    const ins = notifications
      .filter(
        (n) =>
          n.kind === "inspection" && !n.id.startsWith("inspection-message:"),
      )
      .sort((a, b) => b.rank - a.rank)
    const messages = notifications
      .filter(
        (n) => n.kind === "inspection" && n.id.startsWith("inspection-message:"),
      )
      .sort((a, b) => b.rank - a.rank)
    const ex = notifications
      .filter((n) => n.kind === "expiry")
      .sort((a, b) => b.rank - a.rank)
    const ev = notifications
      .filter((n) => n.kind === "status")
      .sort((a, b) => b.rank - a.rank)
    const urgent =
      ins.length +
      ex.filter(
        (n) => n.severity === "expired" || n.severity === "critical",
      ).length

    let unseen = 0
    let unseenUrg = 0
    let unseenChat = 0
    if (seenIds) {
      for (const n of notifications) {
        if (seenIds.has(n.id)) continue
        unseen++
        if (
          n.kind === "inspection" ||
          (n.kind === "expiry" &&
            (n.severity === "expired" || n.severity === "critical"))
        ) {
          unseenUrg++
        }
        if (
          n.kind === "inspection" &&
          n.id.startsWith("inspection-message:")
        ) {
          unseenChat++
        }
      }
    }

    return {
      inspections: ins,
      inspectionMessages: messages,
      expiries: ex,
      statusEvents: ev,
      urgentCount: urgent,
      totalCount: notifications.length,
      unseenCount: unseen,
      unseenUrgent: unseenUrg,
      unseenChatCount: unseenChat,
    }
  }, [notifications, seenIds])

  return (
    <header
      className={cn(
        // Sticky on mobile/tablet so the topbar (and the nav pill row that
        // sits directly below it) stays glued to the top while scrolling.
        // On desktop, drop the sticky behavior but keep the element
        // positioned (relative, not static) so z-40 still wins against the
        // fixed sidebar rail (z-30). Without that, the rail visually
        // overlaps the top-left of the topbar.
        "sticky top-0 z-40 flex items-center justify-between px-4 py-3 lg:relative lg:top-auto lg:px-6",
        "border-b border-white/10 bg-brand-midnight/70 backdrop-blur-2xl backdrop-saturate-150",
        "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.12),0_4px_16px_-8px_rgba(10,14,26,0.45)]",
      )}
    >
      <div className="flex items-center gap-3">
        <Image
          src="/logo-keylink.png"
          alt="Keylink Transport"
          width={140}
          height={36}
          priority
          className="h-7 w-auto"
        />
        <AnimatedTagline text="Fleet Management System" />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Open search"
          className={cn(
            "group hidden h-8 items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-2.5 text-xs text-brand-cloud/70 transition-colors hover:bg-white/10 hover:text-brand-cloud sm:inline-flex",
          )}
        >
          <Search className="size-3.5 shrink-0" />
          <span className="hidden md:inline">Search…</span>
          <kbd className="ml-1 hidden rounded border border-white/15 bg-white/[0.06] px-1 py-0.5 text-[9px] font-medium text-brand-cloud/60 md:inline">
            ⌘K
          </kbd>
        </button>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Open search"
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-md border border-white/15 bg-transparent text-brand-cloud transition-colors hover:bg-white/5 sm:hidden",
          )}
        >
          <Search className="size-4" />
        </button>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={
                  unseenCount > 0
                    ? `Notifications: ${unseenCount} unread of ${totalCount}`
                    : totalCount > 0
                      ? `Notifications: ${totalCount}`
                      : "Notifications"
                }
                className="relative border-white/15 bg-transparent text-brand-cloud hover:bg-white/5 hover:text-brand-cloud"
              />
            }
          >
            <Bell className="size-4" />
            {unseenCount > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none ring-2 ring-brand-midnight",
                  unseenUrgent > 0
                    ? "bg-red-500 text-white"
                    : "bg-brand-gold text-brand-navy",
                )}
              >
                {unseenCount > 99 ? "99+" : unseenCount}
              </span>
            ) : null}
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className={cn(
              "w-[360px] overflow-hidden p-0 text-brand-cloud",
              "border border-white/10 bg-brand-midnight/85 backdrop-blur-2xl backdrop-saturate-150",
              "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.12),0_24px_48px_-16px_rgba(10,14,26,0.45),0_4px_16px_-4px_rgba(10,14,26,0.25)]",
            )}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Notifications</h3>
                {totalCount > 0 ? (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                    {totalCount}
                  </span>
                ) : null}
              </div>
              {urgentCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-100">
                  <AlertTriangle className="size-3" />
                  {urgentCount} urgent
                </span>
              ) : null}
            </div>

            <div className="max-h-[480px] overflow-y-auto">
              {totalCount === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                  <CheckCircle2
                    className="size-7 text-brand-cloud/40"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium">You&apos;re all caught up</p>
                  <p className="max-w-[240px] text-xs text-brand-cloud/55">
                    No expiring compliance and no recent load activity from
                    other people.
                  </p>
                </div>
              ) : (
                <>
                  {inspections.length > 0 ? (
                    <SectionHeader
                      icon={<AlertTriangle className="size-3.5" />}
                      label="Out-of-service trucks"
                      count={inspections.length}
                    />
                  ) : null}
                  {inspections.map((n) => (
                    <NotificationRow
                      key={n.id}
                      notification={n}
                      seen={seenIds?.has(n.id) ?? false}
                      onNavigate={() => setPopoverOpen(false)}
                    />
                  ))}

                  {expiries.length > 0 ? (
                    <SectionHeader
                      icon={<CalendarClock className="size-3.5" />}
                      label="Expiring soon"
                      count={expiries.length}
                    />
                  ) : null}
                  {expiries.map((n) => (
                    <NotificationRow
                      key={n.id}
                      notification={n}
                      seen={seenIds?.has(n.id) ?? false}
                      onNavigate={() => setPopoverOpen(false)}
                    />
                  ))}

                  {statusEvents.length > 0 ? (
                    <SectionHeader
                      icon={<Truck className="size-3.5" />}
                      label="Recent load activity"
                      count={statusEvents.length}
                    />
                  ) : null}
                  {statusEvents.map((n) => (
                    <NotificationRow
                      key={n.id}
                      notification={n}
                      seen={seenIds?.has(n.id) ?? false}
                      onNavigate={() => setPopoverOpen(false)}
                    />
                  ))}
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={chatOpen} onOpenChange={setChatOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={
                  unseenChatCount > 0
                    ? `Inspection messages: ${unseenChatCount} unread`
                    : "Inspection messages"
                }
                className="relative border-white/15 bg-transparent text-brand-cloud hover:bg-white/5 hover:text-brand-cloud"
              />
            }
          >
            <MessageSquare className="size-4" />
            {unseenChatCount > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-brand-midnight",
                )}
              >
                {unseenChatCount > 99 ? "99+" : unseenChatCount}
              </span>
            ) : null}
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className={cn(
              "w-[360px] overflow-hidden p-0 text-brand-cloud",
              "border border-white/10 bg-brand-midnight/85 backdrop-blur-2xl backdrop-saturate-150",
              "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.12),0_24px_48px_-16px_rgba(10,14,26,0.45),0_4px_16px_-4px_rgba(10,14,26,0.25)]",
            )}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Inspection messages</h3>
                {inspectionMessages.length > 0 ? (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                    {inspectionMessages.length}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {inspectionMessages.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                  <MessageSquare
                    className="size-7 text-brand-cloud/40"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium">No new replies</p>
                  <p className="max-w-[240px] text-xs text-brand-cloud/55">
                    When someone replies on an inspection thread, it shows up
                    here.
                  </p>
                </div>
              ) : (
                <>
                  {inspectionMessages.map((n) => (
                    <NotificationRow
                      key={n.id}
                      notification={n}
                      seen={seenIds?.has(n.id) ?? false}
                      onNavigate={() => setChatOpen(false)}
                    />
                  ))}
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Link
          href="/messages"
          aria-label={
            chatUnreadCount > 0
              ? `Team chat: ${chatUnreadCount} unread`
              : "Team chat"
          }
          title={
            chatUnreadCount > 0
              ? `Team chat — ${chatUnreadCount} unread`
              : "Team chat"
          }
          className={cn(
            "relative inline-flex h-8 items-center gap-1.5 rounded-md border border-white/15 bg-transparent px-2.5 text-brand-cloud transition-colors",
            "hover:bg-white/5 hover:border-white/25",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal-light",
          )}
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
            Chat
          </span>
          {chatUnreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-brand-midnight"
            >
              {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
            </span>
          ) : null}
        </Link>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-label="Change avatar"
          title="Change avatar"
          className="rounded-full transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal-light focus-visible:ring-offset-2 focus-visible:ring-offset-brand-midnight"
        >
          <UserAvatar
            url={profile.avatar_url}
            seed={profile.id}
            name={profile.full_name}
            size="md"
          />
        </button>

        <div className="hidden flex-col items-end gap-0.5 leading-tight sm:flex">
          <span className="text-sm font-medium text-brand-cloud">
            {profile.full_name || "Unnamed"}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-brand-cloud/55">
              {profile.employee_id ?? "No ID"}
            </span>
            <Badge className="border-transparent bg-brand-teal/20 text-[10px] font-semibold uppercase tracking-wider text-brand-teal-light">
              {ROLE_LABEL[profile.role]}
            </Badge>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(() => signOutAction())}
          className="border-white/15 bg-transparent text-brand-cloud hover:bg-white/5 hover:text-brand-cloud"
        >
          {pending ? "Signing out…" : "Sign out"}
        </Button>
      </div>

      <AvatarPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        currentUserId={profile.id}
        currentName={profile.full_name}
        currentUrl={profile.avatar_url}
      />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  )
}

function SectionHeader({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode
  label: string
  count: number
}) {
  return (
    <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.03] px-4 py-2">
      <span className="text-brand-cloud/55">{icon}</span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-cloud/65">
        {label}
      </span>
      <span className="ml-auto rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-brand-cloud/80">
        {count}
      </span>
    </div>
  )
}

// Client-side relative time. The server's timeAgo() runs once at request
// time, so a value rendered there goes stale as the popover sits open; this
// version recomputes on every render of the row.
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  // Past the bell's 7-day window — fall back to a date stamp.
  try {
    return new Date(iso).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
    })
  } catch {
    return `${days}d ago`
  }
}

function NotificationRow({
  notification,
  seen = false,
  onNavigate,
}: {
  notification: Notification
  seen?: boolean
  onNavigate: () => void
}) {
  return (
    <Link
      href={notification.href}
      onClick={onNavigate}
      className={cn(
        "flex items-start gap-3 border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/[0.06] last:border-b-0",
        seen && "opacity-55",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          seen ? "bg-white/20" : SEVERITY_DOT[notification.severity],
        )}
      />
      <div className="flex flex-1 flex-col gap-1 leading-tight">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-brand-cloud">
            {notification.title}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              SEVERITY_TAG[notification.severity],
            )}
          >
            {notification.tag}
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          {notification.body ? (
            <span className="line-clamp-2 text-xs text-brand-cloud/60">
              {notification.body}
            </span>
          ) : (
            <span aria-hidden="true" />
          )}
          {notification.timestamp ? (
            <span className="shrink-0 text-[10px] tabular-nums text-brand-cloud/50">
              {relativeTime(notification.timestamp)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

// Brand tagline next to the logo. Letters rise + un-blur into place with a
// staggered delay; once settled, a slow gold gradient sweeps through the text
// on a loop — subtle enough not to distract from the dashboard, lively enough
// to feel "branded".
function AnimatedTagline({ text }: { text: string }) {
  const letters = Array.from(text)
  return (
    <div
      aria-label={text}
      className="hidden items-center gap-3 sm:flex"
    >
      <span aria-hidden="true" className="h-6 w-px bg-white/15" />
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex select-none font-display text-sm uppercase tracking-[0.32em] leading-none text-brand-gold",
        )}
      >
        {letters.map((c, i) => (
          <span
            key={i}
            className="inline-block animate-keylink-rise"
            style={{ animationDelay: `${i * 28}ms` }}
          >
            {c === " " ? " " : c}
          </span>
        ))}
      </span>
    </div>
  )
}
