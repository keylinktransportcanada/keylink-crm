// Recent load activity feed for the dashboard. Renders the latest status
// transitions across the company so dispatch can glance at what's moving.
import Link from "next/link"
import {
  CheckCircle2,
  Clock,
  Package,
  PackageCheck,
  PackageOpen,
  Truck,
  XCircle,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { LOAD_STATUS_LABEL } from "@/lib/schemas/loads"
import type { LoadStatus } from "@/lib/supabase/types"

export type ActivityItem = {
  id: string
  loadId: string
  loadNumber: string
  status: LoadStatus
  customerName: string | null
  createdAt: string
}

const STATUS_ICON: Record<LoadStatus, LucideIcon> = {
  draft: Package,
  assigned: Truck,
  dispatched: Truck,
  at_pickup: PackageOpen,
  loaded: Package,
  in_transit: Truck,
  at_delivery: PackageOpen,
  delivered: PackageCheck,
  invoiced: CheckCircle2,
  paid: CheckCircle2,
  cancelled: XCircle,
}

import { LOAD_STATUS_TONE as STATUS_TONE } from "@/lib/load-status-colors"

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return "yesterday"
  return `${days}d ago`
}

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  // Cap the visible list so this card has the same density as its row
  // neighbours (Revenue chart, Live Load Board, Load Status). Extras roll up
  // into the "View all" link.
  const visible = items.slice(0, 6)
  return (
    <section className="flex h-full flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="size-1.5 rounded-full bg-brand-gold"
            aria-hidden="true"
          />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
            Recent activity
          </h2>
        </div>
        <Link
          href="/loads"
          className="text-xs font-medium text-brand-teal hover:underline"
        >
          View all activity →
        </Link>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 p-6 text-center">
          <Clock
            className="mx-auto size-6 text-muted-foreground/50"
            aria-hidden="true"
          />
          <p className="mt-2 text-sm text-muted-foreground">
            No status changes yet. Activity will appear here as loads progress.
          </p>
        </div>
      ) : (
        <ul className="dash-rows flex flex-1 flex-col gap-1 overflow-hidden">
          {visible.map((item) => {
            const Icon = STATUS_ICON[item.status]
            return (
              <li key={item.id}>
                <Link
                  href={`/loads/${item.loadId}`}
                  className={cn(
                    "flex items-start gap-3 rounded-md p-2 transition-colors",
                    "hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
                      STATUS_TONE[item.status],
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="flex flex-1 flex-col gap-0.5 leading-tight">
                    <p className="text-sm">
                      <span className="font-mono font-medium">
                        {item.loadNumber}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        {LOAD_STATUS_LABEL[item.status].toLowerCase()}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.customerName ?? "—"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {timeAgo(item.createdAt)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
