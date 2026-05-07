import "server-only"

import {
  daysBetween,
  relativeExpiryLabel,
  severityFor,
  todayInToronto,
  type Severity,
} from "@/lib/expiry"
import { LOAD_STATUS_LABEL } from "@/lib/schemas/loads"
import type { LoadStatus } from "@/lib/supabase/types"
import type { Role } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export type NotificationKind = "expiry" | "status"

export type Notification = {
  id: string
  kind: NotificationKind
  severity: Severity
  title: string
  body: string
  href: string
  // Sort key — higher = more urgent. Expiries: bigger when fewer days remain
  // (or already expired). Status events: epoch millis of created_at, so newer
  // wins among status entries within the same severity tier.
  rank: number
  // Display tag: how this entry should be labeled in the bell.
  tag: string
}

const STATUS_TAG: Partial<Record<LoadStatus, string>> = {
  draft: "New draft",
  assigned: "Assigned",
  dispatched: "Dispatched",
  at_pickup: "At pickup",
  loaded: "Loaded",
  in_transit: "In transit",
  at_delivery: "At delivery",
  delivered: "Delivered",
  invoiced: "Invoiced",
  paid: "Paid",
  cancelled: "Cancelled",
}

const STATUS_DAYS_BACK = 7
const EXPIRY_HORIZON_DAYS = 30

function isoDaysAgo(today: string, n: number): string {
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

export async function getNotificationsFor(
  userId: string,
  role: Role,
): Promise<Notification[]> {
  const supabase = await createClient()
  const today = todayInToronto()
  const horizonStart = isoDaysAgo(today, STATUS_DAYS_BACK)

  const out: Notification[] = []

  // ------------------------------------------------------------------
  // Compliance expiries — trucks + trailers. Drivers come in Phase 4.
  // ------------------------------------------------------------------
  // Drivers don't manage equipment; skip the expiry feed for them so the
  // bell isn't full of items they can't action.
  if (role !== "driver") {
    const [{ data: trucks }, { data: trailers }] = await Promise.all([
      supabase
        .from("trucks")
        .select(
          `id, truck_number, plate_expiry, insurance_expiry,
           ifta_decal_expiry, safety_sticker_expiry, cvor_certificate_expiry`,
        )
        .neq("status", "retired"),
      supabase
        .from("trailers")
        .select("id, trailer_number, plate_expiry, next_inspection_due")
        .neq("status", "retired"),
    ])

    const truckChecks: Array<{ key: string; label: string }> = [
      { key: "plate_expiry", label: "Plate" },
      { key: "insurance_expiry", label: "Insurance" },
      { key: "ifta_decal_expiry", label: "IFTA decal" },
      { key: "safety_sticker_expiry", label: "Safety sticker" },
      { key: "cvor_certificate_expiry", label: "CVOR certificate" },
    ]
    for (const t of trucks ?? []) {
      for (const c of truckChecks) {
        const date = t[c.key as keyof typeof t] as string | null
        if (!date) continue
        const days = daysBetween(today, date)
        if (days > EXPIRY_HORIZON_DAYS) continue
        const sev = severityFor(days)
        out.push({
          id: `truck:${t.id}:${c.key}`,
          kind: "expiry",
          severity: sev,
          tag: c.label,
          title:
            days < 0
              ? `${c.label} expired ${relativeExpiryLabel(days)}`
              : `${c.label} expires ${relativeExpiryLabel(days)}`,
          body: `Truck ${t.truck_number} · ${date}`,
          href: `/trucks/${t.id}`,
          rank: 1_000_000 - days, // expired (negative days) ranks highest
        })
      }
    }

    const trailerChecks: Array<{ key: string; label: string }> = [
      { key: "plate_expiry", label: "Plate" },
      { key: "next_inspection_due", label: "Inspection" },
    ]
    for (const tr of trailers ?? []) {
      for (const c of trailerChecks) {
        const date = tr[c.key as keyof typeof tr] as string | null
        if (!date) continue
        const days = daysBetween(today, date)
        if (days > EXPIRY_HORIZON_DAYS) continue
        const sev = severityFor(days)
        out.push({
          id: `trailer:${tr.id}:${c.key}`,
          kind: "expiry",
          severity: sev,
          tag: c.label,
          title:
            days < 0
              ? `${c.label} expired ${relativeExpiryLabel(days)}`
              : `${c.label} expires ${relativeExpiryLabel(days)}`,
          body: `Trailer ${tr.trailer_number} · ${date}`,
          // Trailer detail page doesn't exist; deep-link to the list with
          // the trailer dialog open later. For now the list is fine.
          href: `/trailers`,
          rank: 1_000_000 - days,
        })
      }
    }
  }

  // ------------------------------------------------------------------
  // Recent load status transitions — last 7 days, exclude the user's own
  // clicks so they don't get pinged for their own work. RLS already
  // restricts a driver to events for their own loads.
  // ------------------------------------------------------------------
  const { data: events } = await supabase
    .from("load_status_events")
    .select("id, load_id, status, created_at, created_by")
    .gte("created_at", `${horizonStart}T00:00:00Z`)
    .neq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(40)

  if (events && events.length > 0) {
    const loadIds = [...new Set(events.map((e) => e.load_id))]
    const { data: loads } = await supabase
      .from("loads")
      .select("id, load_number")
      .in("id", loadIds)
    const loadById = new Map(
      (loads ?? []).map((l) => [l.id, l.load_number] as const),
    )

    for (const e of events) {
      const loadNumber = loadById.get(e.load_id)
      // RLS may hide a load (driver who got reassigned, etc.); skip those.
      if (!loadNumber) continue
      const sev: Severity =
        e.status === "cancelled"
          ? "critical"
          : e.status === "delivered" ||
              e.status === "invoiced" ||
              e.status === "paid"
            ? "ok"
            : "warning"
      out.push({
        id: `event:${e.id}`,
        kind: "status",
        severity: sev,
        tag: STATUS_TAG[e.status as LoadStatus] ?? LOAD_STATUS_LABEL[e.status],
        title: `${loadNumber} → ${LOAD_STATUS_LABEL[e.status]}`,
        body: timeAgo(e.created_at),
        href: `/loads/${e.load_id}`,
        rank: new Date(e.created_at).getTime() / 1000,
      })
    }
  }

  // Sort: expiries by urgency first, then status events by recency. We use
  // distinct rank ranges (expiries up around 1,000,000+; events around the
  // unix-seconds scale ~1.7B) so they naturally interleave correctly when
  // we group by kind in the UI.
  return out
}

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
