import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  daysBetween,
  severityFor,
  todayInToronto,
  type Severity,
} from "@/lib/expiry"

// Single aggregator for "what's expiring soon?" — used by the weekly
// compliance digest email and (eventually) any other off-dashboard
// touchpoint. Uses the admin client so it can be called from API routes
// or scheduled functions without an active user session.
//
// The dashboard widget computes the same data inline against the
// user-session client; that's fine — they coexist.

export type DigestEntityType = "truck" | "trailer" | "driver" | "document"

export type DigestItem = {
  id: string
  href: string // absolute path within the CRM
  entity: string
  entityType: DigestEntityType
  field: string
  date: string // ISO yyyy-mm-dd
  daysUntil: number
  severity: Severity
}

export type ComplianceDigest = {
  today: string
  windowEndISO: string
  totalCount: number
  // Already past today.
  expired: DigestItem[]
  // 0–14 days out.
  critical: DigestItem[]
  // 15–30 days out.
  warning: DigestItem[]
}

function isoDaysAhead(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function getComplianceDigest(): Promise<ComplianceDigest> {
  const admin = createAdminClient()
  const today = todayInToronto()
  // Digest window: anything expiring in the next 30 days OR expired
  // within the last 14 days (still actionable / needs to be chased).
  const windowStart = isoDaysAhead(today, -14)
  const windowEnd = isoDaysAhead(today, 30)

  const [trucksExp, trailersExp, driverProfilesExp, docsExp] =
    await Promise.all([
      admin
        .from("trucks")
        .select(
          `id, truck_number, plate_expiry, insurance_expiry,
           ifta_decal_expiry, safety_sticker_expiry, cvor_certificate_expiry`,
        ),
      admin
        .from("trailers")
        .select("id, trailer_number, plate_expiry, next_inspection_due"),
      admin
        .from("driver_profiles")
        .select(
          `profile_id, licence_expiry, medical_cert_expiry, fast_card_expiry,
           profiles:profiles!driver_profiles_profile_id_fkey(full_name)`,
        ),
      admin
        .from("documents")
        .select(
          `id, type, file_name, expiry_date,
           load_id, truck_id, driver_id, trailer_id,
           trucks:trucks(truck_number),
           profiles:profiles!documents_driver_id_fkey(full_name),
           trailers:trailers(trailer_number)`,
        )
        .not("expiry_date", "is", null)
        .gte("expiry_date", windowStart)
        .lte("expiry_date", windowEnd),
    ])

  const items: DigestItem[] = []
  const push = (
    keyId: string,
    href: string,
    entity: string,
    entityType: DigestEntityType,
    field: string,
    date: string | null,
  ) => {
    if (!date) return
    if (date < windowStart || date > windowEnd) return
    const days = daysBetween(today, date)
    items.push({
      id: `${entityType}:${keyId}:${field}`,
      href,
      entity,
      entityType,
      field,
      date,
      daysUntil: days,
      severity: severityFor(days),
    })
  }

  for (const t of trucksExp.data ?? []) {
    const href = `/trucks/${t.id}`
    push(t.id, href, t.truck_number, "truck", "Plate", t.plate_expiry)
    push(t.id, href, t.truck_number, "truck", "Insurance", t.insurance_expiry)
    push(t.id, href, t.truck_number, "truck", "IFTA decal", t.ifta_decal_expiry)
    push(
      t.id,
      href,
      t.truck_number,
      "truck",
      "Safety sticker",
      t.safety_sticker_expiry,
    )
    push(
      t.id,
      href,
      t.truck_number,
      "truck",
      "CVOR certificate",
      t.cvor_certificate_expiry,
    )
  }
  for (const tr of trailersExp.data ?? []) {
    const href = `/trailers`
    push(tr.id, href, tr.trailer_number, "trailer", "Plate", tr.plate_expiry)
    push(
      tr.id,
      href,
      tr.trailer_number,
      "trailer",
      "Inspection due",
      tr.next_inspection_due,
    )
  }

  type DPRow = {
    profile_id: string
    licence_expiry: string | null
    medical_cert_expiry: string | null
    fast_card_expiry: string | null
    profiles:
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null
  }
  for (const dp of (driverProfilesExp.data ?? []) as DPRow[]) {
    const profile = Array.isArray(dp.profiles) ? dp.profiles[0] : dp.profiles
    const name = profile?.full_name ?? "Unnamed driver"
    const href = `/drivers/${dp.profile_id}`
    push(dp.profile_id, href, name, "driver", "Driver licence", dp.licence_expiry)
    push(
      dp.profile_id,
      href,
      name,
      "driver",
      "Medical cert",
      dp.medical_cert_expiry,
    )
    push(dp.profile_id, href, name, "driver", "FAST card", dp.fast_card_expiry)
  }

  type DocRow = {
    id: string
    type: string
    file_name: string
    expiry_date: string | null
    load_id: string | null
    truck_id: string | null
    driver_id: string | null
    trailer_id: string | null
    trucks: { truck_number: string } | { truck_number: string }[] | null
    profiles:
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null
    trailers:
      | { trailer_number: string }
      | { trailer_number: string }[]
      | null
  }
  const labelByDocType: Record<string, string> = {
    insurance: "Insurance certificate",
    registration: "Registration",
    inspection: "Inspection",
    driver_licence: "Driver licence",
    medical: "Medical cert",
    fast_card: "FAST card",
    maintenance: "Maintenance record",
  }
  for (const d of (docsExp.data ?? []) as DocRow[]) {
    if (!d.expiry_date) continue
    const truck = Array.isArray(d.trucks) ? d.trucks[0] : d.trucks
    const driver = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles
    const trailer = Array.isArray(d.trailers) ? d.trailers[0] : d.trailers
    let entity = d.file_name
    let href = "/dashboard"
    if (d.truck_id) {
      entity = truck?.truck_number ?? "Truck doc"
      href = `/trucks/${d.truck_id}`
    } else if (d.driver_id) {
      entity = driver?.full_name ?? "Driver doc"
      href = `/drivers/${d.driver_id}`
    } else if (d.trailer_id) {
      entity = trailer?.trailer_number ?? "Trailer doc"
      href = `/trailers`
    } else if (d.load_id) {
      entity = "Load doc"
      href = `/loads/${d.load_id}`
    }
    const field = labelByDocType[d.type] ?? "Document"
    push(d.id, href, entity, "document", field, d.expiry_date)
  }

  items.sort((a, b) => a.daysUntil - b.daysUntil)

  const expired = items.filter((i) => i.daysUntil < 0)
  const critical = items.filter((i) => i.daysUntil >= 0 && i.daysUntil <= 14)
  const warning = items.filter((i) => i.daysUntil > 14 && i.daysUntil <= 30)

  return {
    today,
    windowEndISO: windowEnd,
    totalCount: items.length,
    expired,
    critical,
    warning,
  }
}
