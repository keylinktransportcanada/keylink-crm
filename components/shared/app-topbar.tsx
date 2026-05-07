"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  Truck,
} from "lucide-react"

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

export function AppTopbar({
  profile,
  notifications,
}: {
  profile: CurrentProfile
  notifications: Notification[]
}) {
  const [pending, startTransition] = useTransition()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

  const { expiries, statusEvents, urgentCount, totalCount } = useMemo(() => {
    const ex = notifications
      .filter((n) => n.kind === "expiry")
      .sort((a, b) => b.rank - a.rank)
    const ev = notifications
      .filter((n) => n.kind === "status")
      .sort((a, b) => b.rank - a.rank)
    const urgent = ex.filter(
      (n) => n.severity === "expired" || n.severity === "critical",
    ).length
    return {
      expiries: ex,
      statusEvents: ev,
      urgentCount: urgent,
      totalCount: notifications.length,
    }
  }, [notifications])

  return (
    <header
      className={cn(
        "flex items-center justify-between px-4 py-3 lg:px-6",
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
      </div>

      <div className="flex items-center gap-3">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={
                  totalCount > 0
                    ? `Notifications: ${totalCount}`
                    : "Notifications"
                }
                className="relative border-white/15 bg-transparent text-brand-cloud hover:bg-white/5 hover:text-brand-cloud"
              />
            }
          >
            <Bell className="size-4" />
            {totalCount > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none ring-2 ring-brand-midnight",
                  urgentCount > 0
                    ? "bg-red-500 text-white"
                    : "bg-brand-gold text-brand-navy",
                )}
              >
                {totalCount > 99 ? "99+" : totalCount}
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
                      onNavigate={() => setPopoverOpen(false)}
                    />
                  ))}
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

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

function NotificationRow({
  notification,
  onNavigate,
}: {
  notification: Notification
  onNavigate: () => void
}) {
  return (
    <Link
      href={notification.href}
      onClick={onNavigate}
      className="flex items-start gap-3 border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/[0.06] last:border-b-0"
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          SEVERITY_DOT[notification.severity],
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
        <span className="text-xs text-brand-cloud/60">{notification.body}</span>
      </div>
    </Link>
  )
}
