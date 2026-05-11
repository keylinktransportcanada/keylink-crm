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

export type NotificationKind = "expiry" | "status" | "inspection"

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
  // Inspection thread messages — bell entries for messages the user did NOT
  // author. Drivers see messages from admin/dispatcher on their own
  // inspections; admin/dispatcher see messages from drivers on any
  // inspection.
  // ------------------------------------------------------------------
  if (role === "admin" || role === "dispatcher" || role === "driver") {
    const sinceIso = `${horizonStart}T00:00:00Z`

    // Step 1: pull recent messages the user can see, with the author's role
    // and the inspection's truck reference.
    const messagesQuery = supabase
      .from("inspection_messages")
      .select(
        `id, inspection_id, author_id, author_role, message, created_at,
         inspections!inner(truck_id, driver_id, trucks!inner(truck_number))`,
      )
      .gte("created_at", sinceIso)
      .neq("author_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)

    const { data: msgRows } =
      role === "driver"
        ? // Drivers should only see messages on inspections they own. The
          // foreign-table .eq syntax requires the join to be `inner`.
          await messagesQuery.eq("inspections.driver_id", userId)
        : await messagesQuery

    type Insp = { truck_id: string; driver_id: string; trucks: { truck_number: string } | { truck_number: string }[] | null }
    type Msg = {
      id: string
      inspection_id: string
      author_id: string
      author_role: "admin" | "dispatcher" | "driver" | "accounting"
      message: string
      created_at: string
      inspections: Insp | Insp[] | null
    }

    const authorIds = [
      ...new Set(((msgRows as Msg[] | null) ?? []).map((m) => m.author_id)),
    ]
    const { data: authorProfiles } = authorIds.length
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", authorIds)
      : { data: [] }
    const authorNameById = new Map(
      (authorProfiles ?? []).map(
        (p) => [p.id, p.full_name ?? "Member"] as const,
      ),
    )

    for (const m of (msgRows as Msg[] | null) ?? []) {
      const insp = Array.isArray(m.inspections) ? m.inspections[0] : m.inspections
      if (!insp) continue
      const truck = Array.isArray(insp.trucks) ? insp.trucks[0] : insp.trucks
      const authorName = authorNameById.get(m.author_id) ?? "Member"
      // Driver-side: still skip messages that the driver themselves authored
      // (they'd already be filtered by .neq above, but belt and suspenders).
      const truckLabel = truck?.truck_number ?? "Truck"
      // Driver-side: drivers don't have access to the trucks pages, and the
      // inspection they care about is already on their dashboard. Anchor to
      // the specific row so the click jumps right to it.
      const href =
        role === "driver"
          ? `/dashboard#inspection-${m.inspection_id}`
          : `/trucks/${insp.truck_id}#inspection-${m.inspection_id}`
      out.push({
        id: `inspection-message:${m.id}`,
        kind: "inspection",
        severity: "warning",
        tag: m.author_role === "driver" ? "Driver reply" : "Admin reply",
        title: `${authorName} · ${truckLabel}`,
        body: m.message,
        href,
        rank: 1_700_000 + new Date(m.created_at).getTime() / 1000,
      })
    }
  }

  // ------------------------------------------------------------------
  // Recently-corrected inspections — driver-only feed so they learn that
  // admin has signed off the issue and the truck is back in service. Last
  // 7 days only, otherwise the bell would never empty.
  // ------------------------------------------------------------------
  if (role === "driver") {
    const correctedSinceIso = `${horizonStart}T00:00:00Z`
    const { data: corrected } = await supabase
      .from("inspections")
      .select(
        `id, truck_id, inspection_type, corrected_at, corrected_by, corrected_notes,
         trucks!inner(truck_number)`,
      )
      .eq("driver_id", userId)
      .eq("severity", "major")
      .not("corrected_at", "is", null)
      .gte("corrected_at", correctedSinceIso)
      .order("corrected_at", { ascending: false })
      .limit(20)

    // Resolve corrector names in a separate batch query — same FK
    // disambiguation issue as on the dashboard.
    const correctorIds = [
      ...new Set(
        (corrected ?? [])
          .map((c) => c.corrected_by)
          .filter((v): v is string => !!v),
      ),
    ]
    const { data: correctorProfiles } = correctorIds.length
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", correctorIds)
      : { data: [] }
    const nameById = new Map(
      (correctorProfiles ?? []).map(
        (p) => [p.id, p.full_name ?? "Admin"] as const,
      ),
    )

    type CorRow = {
      id: string
      truck_id: string
      inspection_type: "pre_trip" | "post_trip" | "en_route"
      corrected_at: string | null
      corrected_by: string | null
      corrected_notes: string | null
      trucks: { truck_number: string } | { truck_number: string }[] | null
    }
    for (const c of (corrected as CorRow[] | null) ?? []) {
      if (!c.corrected_at) continue
      const truck = Array.isArray(c.trucks) ? c.trucks[0] : c.trucks
      const correctorName = c.corrected_by
        ? nameById.get(c.corrected_by) ?? "Admin"
        : "Admin"
      out.push({
        id: `inspection-corrected:${c.id}`,
        kind: "inspection",
        severity: "ok",
        tag: "Approved",
        title: `${truck?.truck_number ?? "Truck"} approved back in service`,
        body:
          (c.corrected_notes?.trim() ||
            "Admin signed off on your inspection.") +
          ` · ${correctorName}`,
        href: `/trucks/${c.truck_id}`,
        // Slightly below open-major rank so unresolved items still lead the
        // bell, but above expiries.
        rank: 1_500_000 + new Date(c.corrected_at).getTime() / 1000,
      })
    }
  }

  // ------------------------------------------------------------------
  // Open major-defect inspections (DVIR). Admin/dispatcher see all open
  // ones across the fleet; drivers see their own (so it lingers in their
  // bell until the truck is back in service).
  // ------------------------------------------------------------------
  if (role === "admin" || role === "dispatcher" || role === "driver") {
    const inspectionsQuery = supabase
      .from("inspections")
      .select(
        `id, truck_id, driver_id, severity, inspection_type, inspection_date,
         defects_description,
         trucks!inner(truck_number),
         profiles!inspections_driver_id_fkey(full_name)`,
      )
      .eq("severity", "major")
      .is("corrected_at", null)
      .order("inspection_date", { ascending: false })
      .limit(20)

    const { data: openMajors } =
      role === "driver"
        ? await inspectionsQuery.eq("driver_id", userId)
        : await inspectionsQuery

    type InspRow = {
      id: string
      truck_id: string
      driver_id: string
      severity: "major"
      inspection_type: "pre_trip" | "post_trip" | "en_route"
      inspection_date: string
      defects_description: string | null
      trucks: { truck_number: string } | { truck_number: string }[] | null
      profiles: { full_name: string | null } | { full_name: string | null }[] | null
    }
    for (const i of (openMajors as InspRow[] | null) ?? []) {
      const truck = Array.isArray(i.trucks) ? i.trucks[0] : i.trucks
      const driver = Array.isArray(i.profiles) ? i.profiles[0] : i.profiles
      const truckLabel = truck?.truck_number ?? "Truck"
      const driverLabel = driver?.full_name ?? "Driver"
      out.push({
        id: `inspection:${i.id}`,
        kind: "inspection",
        severity: "expired", // re-uses the red "urgent" tone for the bell
        tag: "Major defect",
        title: `${truckLabel} out of service — major defect`,
        body:
          (i.defects_description?.trim() || "Defect logged on inspection.") +
          ` · ${driverLabel}`,
        href: `/trucks/${i.truck_id}`,
        // Push above expiry items so OOS trucks lead the bell.
        rank: 2_000_000 + new Date(i.inspection_date).getTime() / 1000,
      })
    }
  }

  // ------------------------------------------------------------------
  // Compliance expiries — trucks, trailers, and drivers. Drivers see their
  // own compliance items but not the equipment feed.
  // ------------------------------------------------------------------
  // Driver-side compliance (licence, medical, FAST). Driver sees their own
  // row only; admin/dispatcher see everyone.
  {
    const driversQuery = supabase
      .from("driver_profiles")
      .select(
        `profile_id, licence_expiry, medical_cert_expiry, fast_card_expiry,
         profiles!inner(full_name, role, active)`,
      )
      .eq("profiles.role", "driver")
      .eq("profiles.active", true)
    const { data: drivers } =
      role === "driver"
        ? await driversQuery.eq("profile_id", userId)
        : await driversQuery

    const driverChecks: Array<{ key: string; label: string }> = [
      { key: "licence_expiry", label: "Driver licence" },
      { key: "medical_cert_expiry", label: "Medical cert" },
      { key: "fast_card_expiry", label: "FAST card" },
    ]
    type DriverRow = {
      profile_id: string
      licence_expiry: string | null
      medical_cert_expiry: string | null
      fast_card_expiry: string | null
      profiles: { full_name: string | null }
        | { full_name: string | null }[]
        | null
    }
    for (const d of (drivers as DriverRow[] | null) ?? []) {
      // Supabase returns the joined relation as an array even for inner-join
      // 1:1 relationships; pick the first row.
      const linked = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles
      const driverName = linked?.full_name ?? "Driver"
      for (const c of driverChecks) {
        const date = d[c.key as "licence_expiry" | "medical_cert_expiry" | "fast_card_expiry"]
        if (!date) continue
        const days = daysBetween(today, date)
        if (days > EXPIRY_HORIZON_DAYS) continue
        const sev = severityFor(days)
        out.push({
          id: `driver:${d.profile_id}:${c.key}`,
          kind: "expiry",
          severity: sev,
          tag: c.label,
          title:
            days < 0
              ? `${c.label} expired ${relativeExpiryLabel(days)}`
              : `${c.label} expires ${relativeExpiryLabel(days)}`,
          body: `${driverName} · ${date}`,
          href:
            role === "driver"
              ? "/account"
              : `/drivers/${d.profile_id}`,
          rank: 1_000_000 - days,
        })
      }
    }
  }

  // Drivers don't manage equipment; skip the equipment feed for them so the
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
  // Recent load status transitions — last 7 days. Includes the user's own
  // clicks so they get audit-trail confirmation that the transition landed.
  // RLS already restricts a driver to events for their own loads.
  // ------------------------------------------------------------------
  const { data: events } = await supabase
    .from("load_status_events")
    .select("id, load_id, status, created_at, created_by")
    .gte("created_at", `${horizonStart}T00:00:00Z`)
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
