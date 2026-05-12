import Link from "next/link"
import { format, parseISO } from "date-fns"
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Building2,
  CalendarClock,
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  Clock,
  Container,
  FileText,
  ListChecks,
  Package,
  PackageCheck,
  Plus,
  ShieldAlert,
  TrendingUp,
  Truck as TruckIcon,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@/components/ui/preview-card"
import { ROLE_META } from "@/components/shared/role-badge"
import { requireRole, type CurrentProfile } from "@/lib/auth"
import {
  daysBetween,
  relativeExpiryLabel,
  SEVERITY_TONE,
  severityFor,
} from "@/lib/expiry"
import { geocodeCity } from "@/lib/geo/geocode"
import { ROLE_VALUES } from "@/lib/schemas/employees"
import {
  LOAD_STATUS_LABEL,
  type LOAD_STATUS_VALUES,
} from "@/lib/schemas/loads"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

import {
  OperationsChart,
  type ChartPoint,
} from "./operations-chart"
import { OperationsMap, type MapPoint } from "./operations-map"
import { LoadStatusDonut, type StatusBucket } from "./load-status-donut"
import { RecentActivity, type ActivityItem } from "./recent-activity"
import {
  DriverCorrectionToast,
  type RecentCorrection,
} from "./driver-correction-toast"
import { MessageThread } from "@/app/(authenticated)/trucks/[id]/inspection-history"

type LoadStatus = (typeof LOAD_STATUS_VALUES)[number]

const ACTIVE_STATUSES: LoadStatus[] = [
  "assigned",
  "dispatched",
  "at_pickup",
  "loaded",
  "in_transit",
  "at_delivery",
]

const STATUS_TONE: Record<LoadStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  assigned: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  dispatched: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  at_pickup: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  loaded: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  in_transit: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  at_delivery: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  invoiced: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  paid: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-300",
}

const formatCAD = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0,
      }).format(value)

function todayInToronto(): string {
  // YYYY-MM-DD in America/Toronto, matching the DB pickup_date format.
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Toronto",
  })
}

function startOfMonthInToronto(): string {
  const today = todayInToronto()
  return `${today.slice(0, 7)}-01`
}

const DELIVERED_STATUSES = new Set<LoadStatus>(["delivered", "invoiced", "paid"])

function isoDaysAgo(today: string, n: number): string {
  // Subtract n days from a YYYY-MM-DD without crossing into Date timezone weirdness.
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function isoDaysAhead(today: string, n: number): string {
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function torontoDateOf(iso: string): string {
  // Convert a UTC timestamp into YYYY-MM-DD in America/Toronto. en-CA emits
  // exactly that format.
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "America/Toronto",
  })
}

type DeliveredRow = {
  delivery_date: string | null
  total_billed_cad: number | string | null
  status: LoadStatus
}

function buildDailySeries(
  rows: DeliveredRow[],
  startDate: string,
  days: number,
): ChartPoint[] {
  const buckets = new Map<string, { revenue: number; count: number }>()
  for (let i = 0; i < days; i++) {
    const d = isoDaysAgo(startDate, days - 1 - i)
    buckets.set(d, { revenue: 0, count: 0 })
  }
  for (const r of rows) {
    if (!r.delivery_date || !DELIVERED_STATUSES.has(r.status)) continue
    const bucket = buckets.get(r.delivery_date)
    if (!bucket) continue
    bucket.revenue += Number(r.total_billed_cad ?? 0)
    bucket.count += 1
  }
  return Array.from(buckets.entries()).map(([date, v]) => ({
    date,
    revenue: v.revenue,
    count: v.count,
  }))
}

function totalsForRange(
  rows: DeliveredRow[],
  fromInclusive: string,
  toInclusive: string,
): { revenue: number; count: number } {
  let revenue = 0
  let count = 0
  for (const r of rows) {
    if (!r.delivery_date || !DELIVERED_STATUSES.has(r.status)) continue
    if (r.delivery_date < fromInclusive || r.delivery_date > toInclusive)
      continue
    revenue += Number(r.total_billed_cad ?? 0)
    count += 1
  }
  return { revenue, count }
}

export default async function DashboardPage() {
  const profile = await requireRole([
    "admin",
    "dispatcher",
    "driver",
    "accounting",
  ])

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-sans text-[1.75rem] font-bold tracking-tight text-brand-navy sm:text-[2rem] lg:text-[2.25rem] lg:leading-[1.15]">
            Welcome back
            {profile.full_name
              ? `, ${profile.full_name.split(" ")[0]}!`
              : "!"}
            <span aria-hidden="true" className="ml-2 inline-block">
              👋
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your fleet today.
          </p>
        </div>
        {profile.role === "admin" || profile.role === "dispatcher" ? (
          <Link href="/loads/new" className={buttonVariants({ size: "sm" })}>
            <Plus />
            New Load
          </Link>
        ) : null}
      </header>

      {profile.role === "admin" || profile.role === "dispatcher" ? (
        <DispatchView showEmployees={profile.role === "admin"} />
      ) : profile.role === "accounting" ? (
        <AccountingView />
      ) : (
        <DriverView profile={profile} />
      )}
    </div>
  )
}

async function DispatchView({
  showEmployees,
}: {
  showEmployees: boolean
}) {
  const supabase = await createClient()
  const today = todayInToronto()
  const sixtyDaysAgo = isoDaysAgo(today, 59)
  const thirtyDaysAgo = isoDaysAgo(today, 29)
  const sixtyDaysAgoStart = isoDaysAgo(today, 59)
  const thirtyOneDaysAgo = isoDaysAgo(today, 30)

  const [
    { data: loads },
    { count: activeDriversCount },
    { count: availableTrucksCount },
    { data: customerRows, count: customersCount },
    employeesAgg,
    { data: deliveredEvents },
  ] = await Promise.all([
    supabase
      .from("loads")
      .select(
        `id, load_number, status, pickup_date, delivery_date,
         origin_city, origin_province, destination_city, destination_province,
         customer_id, driver_id, total_billed_cad, is_cross_border, created_at`,
      )
      .order("pickup_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "driver")
      .eq("active", true),
    supabase
      .from("trucks")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("customers")
      .select(
        "id, name, contact_name, phone, payment_terms_days, credit_limit_cad",
        { count: "exact" },
      )
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(8),
    showEmployees
      ? supabase
          .from("profiles")
          .select("role")
          .eq("active", true)
      : Promise.resolve({ data: null }),
    supabase
      .from("load_status_events")
      .select("load_id, created_at")
      .eq("status", "delivered")
      .gte("created_at", `${sixtyDaysAgo}T00:00:00Z`)
      .order("created_at", { ascending: true }),
  ])

  const all = loads ?? []
  const inProgress = all.filter((l) =>
    ACTIVE_STATUSES.includes(l.status),
  )
  const unassigned = all.filter(
    (l) => l.status === "draft" || l.driver_id === null,
  )
  const pickupsToday = all.filter((l) => l.pickup_date === today)
  const deliveredToday = all.filter(
    (l) => l.status === "delivered" && l.delivery_date === today,
  )
  const crossingsToday = all.filter(
    (l) => l.is_cross_border && l.pickup_date === today,
  )

  // Revenue / deliveries trend (last 30 days, with previous 30 for delta).
  // Drives off the actual "delivered" status-event timestamps, not the load's
  // planned delivery_date — that way a load delivered today shows up today
  // even if its planned delivery_date was a week ago or never set.
  const loadById = new Map(all.map((l) => [l.id, l]))
  const seenLoad = new Set<string>()
  const deliveredRows: DeliveredRow[] = []
  for (const e of deliveredEvents ?? []) {
    if (seenLoad.has(e.load_id)) continue
    seenLoad.add(e.load_id)
    const l = loadById.get(e.load_id)
    if (!l) continue
    deliveredRows.push({
      delivery_date: torontoDateOf(e.created_at),
      total_billed_cad: l.total_billed_cad,
      status: l.status,
    })
  }
  const series = buildDailySeries(deliveredRows, today, 30)
  const previous = totalsForRange(
    deliveredRows,
    sixtyDaysAgoStart,
    thirtyOneDaysAgo,
  )
  void thirtyDaysAgo

  // Build the live board: top ~12 active loads sorted by pickup date.
  const boardLoads = inProgress.slice(0, 12)

  // Map shows anything the dispatcher can usefully see today: every active
  // load plus loads with a pickup within the next 7 days. Client-side filter
  // chips (Active / Today / Week) narrow this set further.
  const weekTo = isoDaysAhead(today, 6)
  const mapEligible = all.filter(
    (l) =>
      ACTIVE_STATUSES.includes(l.status) ||
      (l.pickup_date !== null &&
        l.pickup_date >= today &&
        l.pickup_date <= weekTo),
  )

  const customerIds = [
    ...new Set([
      ...boardLoads.map((l) => l.customer_id),
      ...mapEligible.map((l) => l.customer_id),
    ]),
  ]
  const driverIds = [
    ...new Set(
      [
        ...boardLoads.map((l) => l.driver_id),
        ...mapEligible.map((l) => l.driver_id),
      ].filter((v): v is string => !!v),
    ),
  ]
  const [customersRes, driversRes] = await Promise.all([
    customerIds.length
      ? supabase.from("customers").select("id, name").in("id", customerIds)
      : Promise.resolve({ data: [] }),
    driverIds.length
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", driverIds)
      : Promise.resolve({ data: [] }),
  ])
  const customerById = new Map(
    (customersRes.data ?? []).map((c) => [c.id, c.name] as const),
  )
  const driverById = new Map(
    (driversRes.data ?? []).map((d) => [d.id, d.full_name] as const),
  )

  // Geocode each map-eligible load. Loads where either origin or destination
  // city isn't in the dictionary fall through silently — surfaced to the
  // operator as the "N hidden" hint inside the map header.
  const mapPoints: MapPoint[] = []
  for (const l of mapEligible) {
    const origin = geocodeCity(l.origin_city, l.origin_province)
    const destination = geocodeCity(
      l.destination_city,
      l.destination_province,
    )
    if (!origin || !destination) continue
    mapPoints.push({
      id: l.id,
      loadNumber: l.load_number,
      status: l.status,
      origin,
      destination,
      isCrossBorder: l.is_cross_border ?? false,
      customerName: customerById.get(l.customer_id) ?? null,
      driverName: l.driver_id ? driverById.get(l.driver_id) ?? null : null,
      pickupDate: l.pickup_date,
      totalBilledCad:
        l.total_billed_cad === null ? null : Number(l.total_billed_cad),
      originLabel: [l.origin_city, l.origin_province]
        .filter(Boolean)
        .join(", "),
      destinationLabel: [l.destination_city, l.destination_province]
        .filter(Boolean)
        .join(", "),
    })
  }

  // Status buckets for the donut chart. Group operationally so the chart
  // reads at a glance — In transit / At pickup / Loaded / Delivered /
  // Unassigned (= draft + null driver). Cancelled is intentionally omitted
  // from the chart since it bloats the "long ago" tail.
  const inTransit = all.filter((l) =>
    ["in_transit", "at_delivery"].includes(l.status),
  ).length
  const atPickup = all.filter((l) => l.status === "at_pickup").length
  const loaded = all.filter((l) => l.status === "loaded").length
  const delivered = all.filter((l) =>
    ["delivered", "invoiced", "paid"].includes(l.status),
  ).length
  const unassignedCount = unassigned.length
  const statusBuckets: StatusBucket[] = [
    { key: "delivered", label: "Delivered", count: delivered, color: "#10b981" },
    { key: "in_transit", label: "In transit", count: inTransit, color: "#6366f1" },
    { key: "at_pickup", label: "At pickup", count: atPickup, color: "#f59e0b" },
    { key: "loaded", label: "Loaded", count: loaded, color: "#fb923c" },
    { key: "unassigned", label: "Unassigned", count: unassignedCount, color: "#ef4444" },
  ]
  const statusBucketTotal = statusBuckets.reduce((s, b) => s + b.count, 0)

  // Recent activity — latest status-event rows, joined back to load number
  // and customer name for the feed.
  const { data: recentEvents } = await supabase
    .from("load_status_events")
    .select("id, load_id, status, created_at")
    .order("created_at", { ascending: false })
    .limit(8)

  const recentLoadIds = [...new Set((recentEvents ?? []).map((e) => e.load_id))]
  const recentLoads = recentLoadIds
    .map((id) => loadById.get(id))
    .filter((l): l is NonNullable<typeof l> => !!l)
  const extraCustomerIds = recentLoads
    .map((l) => l.customer_id)
    .filter((id) => !customerById.has(id))
  if (extraCustomerIds.length > 0) {
    const { data: extraCustomers } = await supabase
      .from("customers")
      .select("id, name")
      .in("id", extraCustomerIds)
    for (const c of extraCustomers ?? []) {
      customerById.set(c.id, c.name)
    }
  }

  const activityItems: ActivityItem[] = (recentEvents ?? [])
    .map((e) => {
      const l = loadById.get(e.load_id)
      if (!l) return null
      return {
        id: String(e.id),
        loadId: e.load_id,
        loadNumber: l.load_number,
        status: e.status,
        customerName: customerById.get(l.customer_id) ?? null,
        createdAt: e.created_at,
      } satisfies ActivityItem
    })
    .filter((x): x is ActivityItem => !!x)

  // Open major-defect inspections — surfaces an inspection-alert card so
  // dispatch sees these without having to drill into trucks.
  const { data: openInspectionsData } = await supabase
    .from("inspections")
    .select(
      `id, truck_id, driver_id, inspection_type, inspection_date,
       defects_description,
       trucks!inner(truck_number),
       profiles!inspections_driver_id_fkey(full_name)`,
    )
    .eq("severity", "major")
    .is("corrected_at", null)
    .order("inspection_date", { ascending: false })
    .limit(5)
  type OpenInspectionRow = {
    id: string
    truck_id: string
    driver_id: string
    inspection_type: "pre_trip" | "post_trip" | "en_route"
    inspection_date: string
    defects_description: string | null
    trucks: { truck_number: string } | { truck_number: string }[] | null
    profiles: { full_name: string | null } | { full_name: string | null }[] | null
  }
  const openInspections = (openInspectionsData as OpenInspectionRow[] | null) ?? []
  const openInspectionItems = openInspections.map((i) => {
    const truck = Array.isArray(i.trucks) ? i.trucks[0] : i.trucks
    const driver = Array.isArray(i.profiles) ? i.profiles[0] : i.profiles
    return {
      id: i.id,
      truckId: i.truck_id,
      truckNumber: truck?.truck_number ?? "—",
      driverName: driver?.full_name ?? "Unknown driver",
      inspectionType: i.inspection_type,
      inspectionDate: i.inspection_date,
      defectsDescription: i.defects_description,
    }
  })

  // Compliance / expiry alerts feed — pulls every dated field that can lapse
  // off the carrier (truck plates, insurance, IFTA, safety, CVOR; trailer
  // plates + inspections; driver licence, medical, FAST card) plus uploaded
  // documents that carry their own expiry. Anything within 90 days of today,
  // or already expired in the last 60, ends up on the dashboard widget.
  const expiryWindowEnd = isoDaysAhead(today, 90)
  const expiryWindowStart = isoDaysAgo(today, 60)
  const [
    trucksExp,
    trailersExp,
    driverProfilesExp,
    expiringDocsRes,
    maintenanceDueRes,
  ] = await Promise.all([
    supabase
      .from("trucks")
      .select(
        `id, truck_number, current_odometer_km, plate_expiry, insurance_expiry,
         ifta_decal_expiry, safety_sticker_expiry, cvor_certificate_expiry`,
      ),
    supabase
      .from("trailers")
      .select("id, trailer_number, plate_expiry, next_inspection_due"),
    supabase
      .from("driver_profiles")
      .select(
        `profile_id, licence_expiry, medical_cert_expiry, fast_card_expiry,
         profiles:profiles!driver_profiles_profile_id_fkey(full_name)`,
      ),
    supabase
      .from("documents")
      .select(
        `id, type, file_name, expiry_date,
         load_id, truck_id, driver_id, trailer_id,
         trucks:trucks(truck_number),
         profiles:profiles!documents_driver_id_fkey(full_name),
         trailers:trailers(trailer_number)`,
      )
      .not("expiry_date", "is", null)
      .gte("expiry_date", expiryWindowStart)
      .lte("expiry_date", expiryWindowEnd),
    supabase
      .from("maintenance_records")
      .select(
        `id, service_type, truck_id, next_due_date, next_due_odometer_km,
         trucks:trucks(truck_number, current_odometer_km)`,
      )
      .or(
        `next_due_date.not.is.null,next_due_odometer_km.not.is.null`,
      ),
  ])

  type ExpiryAlertItem = {
    id: string
    href: string
    entity: string
    entityType: "truck" | "trailer" | "driver" | "document"
    field: string
    date: string
    daysUntil: number
    severity: ReturnType<typeof severityFor>
  }

  const expiryAlerts: ExpiryAlertItem[] = []

  function pushIfNear(
    keyId: string,
    href: string,
    entity: string,
    entityType: ExpiryAlertItem["entityType"],
    field: string,
    date: string | null,
  ) {
    if (!date) return
    if (date < expiryWindowStart || date > expiryWindowEnd) return
    const days = daysBetween(today, date)
    expiryAlerts.push({
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
    pushIfNear(t.id, href, t.truck_number, "truck", "Plate", t.plate_expiry)
    pushIfNear(t.id, href, t.truck_number, "truck", "Insurance", t.insurance_expiry)
    pushIfNear(t.id, href, t.truck_number, "truck", "IFTA decal", t.ifta_decal_expiry)
    pushIfNear(t.id, href, t.truck_number, "truck", "Safety sticker", t.safety_sticker_expiry)
    pushIfNear(t.id, href, t.truck_number, "truck", "CVOR certificate", t.cvor_certificate_expiry)
  }
  for (const tr of trailersExp.data ?? []) {
    const href = `/trailers`
    pushIfNear(tr.id, href, tr.trailer_number, "trailer", "Plate", tr.plate_expiry)
    pushIfNear(tr.id, href, tr.trailer_number, "trailer", "Inspection due", tr.next_inspection_due)
  }
  type DriverProfileRow = {
    profile_id: string
    licence_expiry: string | null
    medical_cert_expiry: string | null
    fast_card_expiry: string | null
    profiles:
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null
  }
  for (const dp of (driverProfilesExp.data ?? []) as DriverProfileRow[]) {
    const profile = Array.isArray(dp.profiles) ? dp.profiles[0] : dp.profiles
    const name = profile?.full_name ?? "Unnamed driver"
    const href = `/drivers/${dp.profile_id}`
    pushIfNear(dp.profile_id, href, name, "driver", "Driver licence", dp.licence_expiry)
    pushIfNear(dp.profile_id, href, name, "driver", "Medical cert", dp.medical_cert_expiry)
    pushIfNear(dp.profile_id, href, name, "driver", "FAST card", dp.fast_card_expiry)
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
    profiles: { full_name: string | null } | { full_name: string | null }[] | null
    trailers: { trailer_number: string } | { trailer_number: string }[] | null
  }
  for (const d of (expiringDocsRes.data ?? []) as DocRow[]) {
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
    const labelByType: Record<string, string> = {
      insurance: "Insurance certificate",
      registration: "Registration",
      inspection: "Inspection",
      driver_licence: "Driver licence",
      medical: "Medical cert",
      fast_card: "FAST card",
      maintenance: "Maintenance record",
    }
    const field = labelByType[d.type] ?? "Document"
    pushIfNear(d.id, href, entity, "document", field, d.expiry_date)
  }

  expiryAlerts.sort((a, b) => a.daysUntil - b.daysUntil)
  const topExpiryAlerts = expiryAlerts.slice(0, 12)

  // Maintenance-due feed — every record with a next-due target where either
  // (a) the date is within 30 days or already past, or (b) the odometer
  // target is within 5,000 km of the truck's current reading or already past.
  type MaintenanceAlertItem = {
    id: string
    truckId: string
    truckNumber: string
    serviceLabel: string
    severity: "overdue" | "due" | "warning"
    detail: string
  }
  type MaintRow = {
    id: string
    service_type: string
    truck_id: string
    next_due_date: string | null
    next_due_odometer_km: number | null
    trucks:
      | { truck_number: string; current_odometer_km: number | null }
      | { truck_number: string; current_odometer_km: number | null }[]
      | null
  }
  const SERVICE_LABEL: Record<string, string> = {
    oil_change: "Oil change",
    tire: "Tires",
    brake: "Brakes",
    annual_inspection: "Annual inspection",
    safety: "Safety / CVIP",
    repair: "Repair",
    preventive: "Preventive maintenance",
    other: "Service",
  }
  const maintenanceAlerts: MaintenanceAlertItem[] = []
  for (const r of (maintenanceDueRes.data ?? []) as MaintRow[]) {
    const truck = Array.isArray(r.trucks) ? r.trucks[0] : r.trucks
    if (!truck) continue
    let severity: MaintenanceAlertItem["severity"] | null = null
    let detail = ""

    if (r.next_due_date) {
      const days = daysBetween(today, r.next_due_date)
      if (days < 0) {
        severity = "overdue"
        detail = `Overdue by ${Math.abs(days)}d (was ${format(parseISO(r.next_due_date), "MMM d")})`
      } else if (days <= 7) {
        severity = "due"
        detail = `Due ${relativeExpiryLabel(days)}`
      } else if (days <= 30) {
        severity = "warning"
        detail = `Due ${relativeExpiryLabel(days)}`
      }
    }
    if (
      r.next_due_odometer_km !== null &&
      truck.current_odometer_km !== null
    ) {
      const remaining = r.next_due_odometer_km - truck.current_odometer_km
      let kmSeverity: MaintenanceAlertItem["severity"] | null = null
      let kmDetail = ""
      if (remaining < 0) {
        kmSeverity = "overdue"
        kmDetail = `${Math.abs(remaining).toLocaleString()} km past due`
      } else if (remaining <= 1000) {
        kmSeverity = "due"
        kmDetail = `${remaining.toLocaleString()} km to go`
      } else if (remaining <= 5000) {
        kmSeverity = "warning"
        kmDetail = `${remaining.toLocaleString()} km to go`
      }
      // Use the more severe of date- vs km-based.
      const rank: Record<MaintenanceAlertItem["severity"], number> = {
        warning: 1,
        due: 2,
        overdue: 3,
      }
      if (
        kmSeverity &&
        (severity === null || rank[kmSeverity] > rank[severity])
      ) {
        severity = kmSeverity
        detail = kmDetail
      } else if (kmSeverity && severity && detail.length > 0) {
        detail = `${detail} · ${kmDetail}`
      }
    }
    if (!severity) continue
    maintenanceAlerts.push({
      id: r.id,
      truckId: r.truck_id,
      truckNumber: truck.truck_number,
      serviceLabel: SERVICE_LABEL[r.service_type] ?? "Service",
      severity,
      detail,
    })
  }
  const SEV_RANK = { overdue: 3, due: 2, warning: 1 } as const
  maintenanceAlerts.sort(
    (a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity],
  )
  const topMaintenanceAlerts = maintenanceAlerts.slice(0, 6)

  return (
    <div className="flex flex-col gap-6">
      <QuickActions />

      {/* KPIs as a single horizontal strip — six compact tiles. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          compact
          icon={Activity}
          label="In progress"
          value={inProgress.length}
          accent="indigo"
          href="/loads"
        />
        <Kpi
          compact
          icon={unassigned.length > 0 ? AlertTriangle : CircleCheck}
          label="Unassigned"
          value={unassigned.length}
          accent={unassigned.length > 0 ? "red" : "muted"}
          href="/loads"
        />
        <Kpi
          compact
          icon={CalendarClock}
          label="Pickups today"
          value={pickupsToday.length}
          accent="amber"
        />
        <Kpi
          compact
          icon={PackageCheck}
          label="Delivered today"
          value={deliveredToday.length}
          accent="emerald"
        />
        <Kpi
          compact
          icon={UserCheck}
          label="Active drivers"
          value={activeDriversCount ?? 0}
          accent="blue"
        />
        <Kpi
          compact
          icon={TruckIcon}
          label="Available trucks"
          value={availableTrucksCount ?? 0}
          accent="blue"
        />
      </div>

      {/* Out-of-service inspection alert lives directly under the KPI strip
          so a major defect can't be missed. */}
      {openInspectionItems.length > 0 ? (
        <InspectionAlertsCard items={openInspectionItems} />
      ) : null}

      {/* Top analytics row — Live Fleet Map fills the bulk of the width, with
          the compliance/expiry alert panel pinned alongside as a side rail.
          Both cards stretch to identical heights via items-stretch + h-full
          on the children. */}
      <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <OperationsMap points={mapPoints} />
        {topExpiryAlerts.length > 0 ? (
          <ExpiryAlertsCard
            items={topExpiryAlerts}
            totalCount={expiryAlerts.length}
            compact
          />
        ) : (
          <section className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
            <BadgeCheck className="size-6 text-emerald-500" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">
              No compliance items expiring soon
            </p>
            <p className="text-xs text-muted-foreground">
              Nothing on file is due in the next 90 days.
            </p>
          </section>
        )}
      </div>

      {topMaintenanceAlerts.length > 0 ? (
        <MaintenanceDueCard
          items={topMaintenanceAlerts}
          totalCount={maintenanceAlerts.length}
        />
      ) : null}

      {/* Bottom analytics row — four equal cards: Revenue · Live load board ·
          Load status · Recent activity. Matches the reference dashboard's
          tidy four-up bottom strip. */}
      <div className="grid items-stretch gap-3 lg:grid-cols-4">
        <OperationsChart
          series={series}
          previousTotalRevenue={previous.revenue}
          previousTotalCount={previous.count}
          title="Revenue"
        />

        <section className="flex h-full flex-col gap-2 overflow-hidden rounded-xl border border-border/70 bg-card p-3 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span
                  className="size-1.5 rounded-full bg-brand-gold"
                  aria-hidden="true"
                />
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
                  Live load board
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Active loads sorted by pickup date.
              </p>
            </div>
          </div>
          {boardLoads.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No active loads. Create one to get the board moving.
              </p>
              <Link
                href="/loads/new"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "mt-3 inline-flex",
                )}
              >
                <Plus />
                New Load
              </Link>
            </div>
          ) : (
            <ul className="flex flex-1 flex-col divide-y divide-border overflow-y-auto pr-1">
              {boardLoads.slice(0, 8).map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/loads/${l.id}`}
                    className="flex flex-col gap-1 py-2 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-medium">
                        {l.load_number}
                      </span>
                      <Badge
                        className={cn(
                          "border-transparent text-[10px]",
                          STATUS_TONE[l.status],
                        )}
                      >
                        {LOAD_STATUS_LABEL[l.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">
                        {customerById.get(l.customer_id) ?? "—"}
                        {l.driver_id
                          ? ` · ${driverById.get(l.driver_id) ?? "driver"}`
                          : (
                              <span className="italic"> · unassigned</span>
                            )}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {l.pickup_date
                          ? format(parseISO(l.pickup_date), "MMM d")
                          : "—"}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/loads"
            className="mt-auto inline-flex items-center gap-1 self-start text-xs font-medium text-brand-teal hover:underline"
          >
            View full load board
            <span aria-hidden="true">→</span>
          </Link>
        </section>

        <LoadStatusDonut buckets={statusBuckets} total={statusBucketTotal} />

        <RecentActivity items={activityItems} />
      </div>

      {crossingsToday.length > 0 ? (
        <div className="rounded-lg border border-brand-teal/30 bg-brand-teal/5 p-4">
          <p className="text-sm font-medium">
            {crossingsToday.length} cross-border crossing
            {crossingsToday.length === 1 ? "" : "s"} scheduled today
          </p>
          <p className="text-xs text-muted-foreground">
            ACI / ACE manifests must be filed at least 1 hour before arrival.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <CustomersCard
          customers={customerRows ?? []}
          total={customersCount ?? 0}
        />
        {showEmployees ? (
          <EmployeesTile
            roles={
              (employeesAgg.data ?? []).map((p) => p.role) as Array<
                CurrentProfile["role"]
              >
            }
          />
        ) : null}
      </div>
    </div>
  )
}

async function AccountingView() {
  const supabase = await createClient()
  const today = todayInToronto()
  const monthStart = startOfMonthInToronto()
  const sixtyDaysAgo = isoDaysAgo(today, 59)
  const thirtyOneDaysAgo = isoDaysAgo(today, 30)

  const [
    { data: needsInvoice },
    { data: invoiced },
    { data: thisMonth },
    { data: deliveredEvents },
  ] = await Promise.all([
    supabase
      .from("loads")
      .select(
        `id, load_number, customer_id, total_billed_cad, delivery_date`,
      )
      .eq("status", "delivered")
      .order("delivery_date", { ascending: true }),
    supabase
      .from("loads")
      .select("id, total_billed_cad")
      .eq("status", "invoiced"),
    supabase
      .from("loads")
      .select("id, status, total_billed_cad, updated_at")
      .in("status", ["invoiced", "paid"])
      .gte("updated_at", `${monthStart}T00:00:00Z`),
    supabase
      .from("load_status_events")
      .select("load_id, created_at")
      .eq("status", "delivered")
      .gte("created_at", `${sixtyDaysAgo}T00:00:00Z`)
      .order("created_at", { ascending: true }),
  ])

  const sumCad = (rows: { total_billed_cad: number | string | null }[] | null) =>
    (rows ?? []).reduce(
      (sum, r) => sum + Number(r.total_billed_cad ?? 0),
      0,
    )

  const arOutstanding = sumCad(invoiced)
  const revenueThisMonth = sumCad(thisMonth)
  const paidThisMonth = sumCad(
    (thisMonth ?? []).filter((r) => r.status === "paid"),
  )

  // Pull totals + status for each delivered event, deduping by load.
  const eventLoadIds = [
    ...new Set((deliveredEvents ?? []).map((e) => e.load_id)),
  ]
  const { data: eventLoadValues } = eventLoadIds.length
    ? await supabase
        .from("loads")
        .select("id, total_billed_cad, status")
        .in("id", eventLoadIds)
    : { data: [] }
  const valueByLoad = new Map(
    (eventLoadValues ?? []).map(
      (l) =>
        [l.id, { value: Number(l.total_billed_cad ?? 0), status: l.status }] as const,
    ),
  )
  const seenLoad = new Set<string>()
  const trend: DeliveredRow[] = []
  for (const e of deliveredEvents ?? []) {
    if (seenLoad.has(e.load_id)) continue
    seenLoad.add(e.load_id)
    const v = valueByLoad.get(e.load_id)
    if (!v) continue
    trend.push({
      delivery_date: torontoDateOf(e.created_at),
      total_billed_cad: v.value,
      status: v.status,
    })
  }
  const series = buildDailySeries(trend, today, 30)
  const previous = totalsForRange(trend, sixtyDaysAgo, thirtyOneDaysAgo)

  const queue = needsInvoice ?? []
  const queueCustomerIds = [...new Set(queue.map((l) => l.customer_id))]
  const { data: queueCustomers } = queueCustomerIds.length
    ? await supabase
        .from("customers")
        .select("id, name")
        .in("id", queueCustomerIds)
    : { data: [] }
  const customerById = new Map(
    (queueCustomers ?? []).map((c) => [c.id, c.name] as const),
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <OperationsChart
          series={series}
          previousTotalRevenue={previous.revenue}
          previousTotalCount={previous.count}
          title="Revenue"
        />

        <div className="grid auto-rows-fr grid-cols-2 gap-3">
          <Kpi
            compact
            icon={FileText}
            label="Awaiting invoice"
            value={queue.length}
            accent={queue.length > 0 ? "amber" : "muted"}
          />
          <Kpi
            compact
            icon={CircleDollarSign}
            label="A/R outstanding"
            value={formatCAD(arOutstanding)}
            accent="indigo"
          />
          <Kpi
            compact
            icon={TrendingUp}
            label="Revenue this month"
            value={formatCAD(revenueThisMonth)}
            accent="emerald"
          />
          <Kpi
            compact
            icon={BadgeCheck}
            label="Paid this month"
            value={formatCAD(paidThisMonth)}
            accent="emerald"
          />
        </div>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Invoice queue
            </h2>
            <p className="text-xs text-muted-foreground">
              Delivered loads ready to invoice. Open a load to mark it
              invoiced.
            </p>
          </div>
          <Link
            href="/loads"
            className="text-xs font-medium text-brand-teal hover:underline"
          >
            View all →
          </Link>
        </div>
        {queue.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            Nothing waiting to invoice. Nice.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {queue.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/loads/${l.id}`}
                  className="flex flex-wrap items-center gap-3 py-2.5 hover:bg-muted/30"
                >
                  <span className="font-mono text-sm font-medium">
                    {l.load_number}
                  </span>
                  <span className="text-sm">
                    {customerById.get(l.customer_id) ?? "—"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    delivered{" "}
                    {l.delivery_date
                      ? format(parseISO(l.delivery_date), "PP")
                      : "—"}
                  </span>
                  <span className="text-sm font-medium">
                    {formatCAD(
                      l.total_billed_cad === null
                        ? null
                        : Number(l.total_billed_cad),
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

async function DriverView({ profile }: { profile: CurrentProfile }) {
  const supabase = await createClient()

  // RLS scopes this query to loads the driver is assigned to.
  const { data: myLoads } = await supabase
    .from("loads")
    .select(
      `id, load_number, status, pickup_date, delivery_date,
       origin_city, origin_province, destination_city, destination_province,
       customer_id`,
    )
    .eq("driver_id", profile.id)
    .order("pickup_date", { ascending: true, nullsFirst: false })

  // Driver's own compliance row. RLS grants self-read.
  const { data: compliance } = await supabase
    .from("driver_profiles")
    .select(
      "licence_expiry, medical_cert_expiry, fast_card_expiry, emergency_contact_name",
    )
    .eq("profile_id", profile.id)
    .maybeSingle()

  // Most-recent inspection so we can tell the driver whether they've already
  // done a pre-trip today. RLS scopes this to their own inspections.
  const { data: lastInspection } = await supabase
    .from("inspections")
    .select("id, inspection_type, severity, inspection_date, defects_description")
    .order("inspection_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  // Driver's recent inspection history — including any admin corrections so
  // they can see when their reported issues are signed off and the truck
  // is back in service.
  const { data: rawDriverInspections } = await supabase
    .from("inspections")
    .select(
      `id, truck_id, inspection_type, severity, inspection_date,
       defects_description, corrected_at, corrected_by, corrected_notes,
       trucks!inner(truck_number)`,
    )
    .order("inspection_date", { ascending: false })
    .limit(8)

  const driverInspectionIds = (rawDriverInspections ?? []).map((r) => r.id)
  const { data: driverThreads } = driverInspectionIds.length
    ? await supabase
        .from("inspection_messages")
        .select(
          "id, inspection_id, author_id, author_role, message, created_at",
        )
        .in("inspection_id", driverInspectionIds)
        .order("created_at", { ascending: true })
    : { data: [] }

  // Per-message attachments visible in the driver's thread.
  const driverMsgIds = (driverThreads ?? []).map((m) => m.id)
  const { data: driverRawMsgAttachments } = driverMsgIds.length
    ? await supabase
        .from("documents")
        .select(
          "id, inspection_message_id, file_path, file_name, mime_type, size_bytes, uploaded_at",
        )
        .in("inspection_message_id", driverMsgIds)
        .order("uploaded_at", { ascending: true })
    : { data: [] }
  const driverMsgAttByMessage = new Map<
    string,
    Array<{
      id: string
      file_name: string
      mime_type: string
      size_bytes: number
      uploaded_at: string
      signed_url: string | null
    }>
  >()
  for (const att of driverRawMsgAttachments ?? []) {
    if (!att.inspection_message_id) continue
    const { data: signed } = await supabase.storage
      .from("load-documents")
      .createSignedUrl(att.file_path, 600)
    const list = driverMsgAttByMessage.get(att.inspection_message_id) ?? []
    list.push({
      id: att.id,
      file_name: att.file_name,
      mime_type: att.mime_type,
      size_bytes: Number(att.size_bytes),
      uploaded_at: att.uploaded_at,
      signed_url: signed?.signedUrl ?? null,
    })
    driverMsgAttByMessage.set(att.inspection_message_id, list)
  }

  const driverInvolvedIds = [
    ...new Set(
      [
        ...(rawDriverInspections ?? [])
          .map((r) => r.corrected_by)
          .filter((v): v is string => !!v),
        ...(driverThreads ?? []).map((m) => m.author_id),
      ],
    ),
  ]
  const { data: driverInvolvedProfiles } = driverInvolvedIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", driverInvolvedIds)
    : { data: [] }
  const driverNameById = new Map(
    (driverInvolvedProfiles ?? []).map(
      (p) => [p.id, p.full_name ?? "Admin"] as const,
    ),
  )

  // Attachments for the driver's recent inspections — so they can see the
  // photos they uploaded.
  const { data: driverRawAttachments } = driverInspectionIds.length
    ? await supabase
        .from("documents")
        .select(
          "id, inspection_id, file_path, file_name, mime_type, size_bytes, uploaded_at",
        )
        .in("inspection_id", driverInspectionIds)
        .order("uploaded_at", { ascending: true })
    : { data: [] }
  const driverAttachmentsByInspection = new Map<
    string,
    Array<{
      id: string
      file_name: string
      mime_type: string
      signed_url: string | null
    }>
  >()
  for (const att of driverRawAttachments ?? []) {
    if (!att.inspection_id) continue
    const { data: signed } = await supabase.storage
      .from("load-documents")
      .createSignedUrl(att.file_path, 600)
    const list = driverAttachmentsByInspection.get(att.inspection_id) ?? []
    list.push({
      id: att.id,
      file_name: att.file_name,
      mime_type: att.mime_type,
      signed_url: signed?.signedUrl ?? null,
    })
    driverAttachmentsByInspection.set(att.inspection_id, list)
  }

  type DInsp = {
    id: string
    truck_id: string
    inspection_type: "pre_trip" | "post_trip" | "en_route"
    severity: "none" | "minor" | "major"
    inspection_date: string
    defects_description: string | null
    corrected_at: string | null
    corrected_by: string | null
    corrected_notes: string | null
    trucks: { truck_number: string } | { truck_number: string }[] | null
  }
  // Group thread messages by inspection id for quick lookup. Each message
  // carries its own attachment list (drivers can see photos / files admins
  // attach to their reply, and the driver's own previous attachments).
  const threadByInspection = new Map<string, DriverInspectionMessage[]>()
  for (const m of driverThreads ?? []) {
    const list = threadByInspection.get(m.inspection_id) ?? []
    list.push({
      id: m.id,
      authorId: m.author_id,
      authorName: driverNameById.get(m.author_id) ?? "—",
      authorRole: m.author_role,
      message: m.message,
      createdAt: m.created_at,
      attachments: driverMsgAttByMessage.get(m.id) ?? [],
    })
    threadByInspection.set(m.inspection_id, list)
  }
  // Most recent corrected inspection (last 7 days) — used to fire the
  // floating toast once per correction id.
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7)
  const { data: rawRecentCorrection } = await supabase
    .from("inspections")
    .select(
      `id, truck_id, corrected_at, corrected_by, corrected_notes,
       trucks!inner(truck_number)`,
    )
    .eq("driver_id", profile.id)
    .eq("severity", "major")
    .not("corrected_at", "is", null)
    .gte("corrected_at", sevenDaysAgo.toISOString())
    .order("corrected_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  // Resolve the corrector's name in a separate query — joining two FKs to
  // profiles in one Postgrest hint is fiddly when both columns reference the
  // same table.
  let recentCorrectorName: string | null = null
  if (rawRecentCorrection?.corrected_by) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", rawRecentCorrection.corrected_by)
      .maybeSingle()
    recentCorrectorName = data?.full_name ?? null
  }
  type CorrTopRow = {
    id: string
    truck_id: string
    corrected_at: string | null
    corrected_by: string | null
    corrected_notes: string | null
    trucks: { truck_number: string } | { truck_number: string }[] | null
  }
  const recentCorrection: RecentCorrection | null =
    rawRecentCorrection && rawRecentCorrection.corrected_at
      ? (() => {
          const r = rawRecentCorrection as CorrTopRow
          const truck = Array.isArray(r.trucks) ? r.trucks[0] : r.trucks
          return {
            id: r.id,
            truckId: r.truck_id,
            truckNumber: truck?.truck_number ?? "Truck",
            correctedAt: r.corrected_at as string,
            correctedByName: recentCorrectorName ?? "Admin",
            correctedNotes: r.corrected_notes,
          }
        })()
      : null

  // Personal compliance documents the driver can pull on their phone — RLS
  // limits this to their own driver_id rows. Excludes inspection-attached
  // photos which live with the inspection row.
  const { data: rawMyDocs } = await supabase
    .from("documents")
    .select(
      "id, type, file_path, file_name, mime_type, size_bytes, expiry_date, uploaded_at",
    )
    .eq("driver_id", profile.id)
    .is("inspection_id", null)
    .is("inspection_message_id", null)
    .order("uploaded_at", { ascending: false })

  const myDocuments: Array<{
    id: string
    type: string
    file_name: string
    mime_type: string
    size_bytes: number
    expiry_date: string | null
    signed_url: string | null
  }> = []
  for (const d of rawMyDocs ?? []) {
    const { data: signed } = await supabase.storage
      .from("load-documents")
      .createSignedUrl(d.file_path, 600)
    myDocuments.push({
      id: d.id,
      type: d.type,
      file_name: d.file_name,
      mime_type: d.mime_type,
      size_bytes: Number(d.size_bytes),
      expiry_date: d.expiry_date,
      signed_url: signed?.signedUrl ?? null,
    })
  }

  const driverInspectionItems: DriverInspectionItem[] = (
    (rawDriverInspections as DInsp[] | null) ?? []
  ).map((r) => {
    const truck = Array.isArray(r.trucks) ? r.trucks[0] : r.trucks
    return {
      id: r.id,
      truckId: r.truck_id,
      truckNumber: truck?.truck_number ?? "—",
      type: r.inspection_type,
      severity: r.severity,
      inspectionDate: r.inspection_date,
      defectsDescription: r.defects_description,
      correctedAt: r.corrected_at,
      correctedByName: r.corrected_by
        ? driverNameById.get(r.corrected_by) ?? "Admin"
        : null,
      correctedNotes: r.corrected_notes,
      messages: threadByInspection.get(r.id) ?? [],
      attachments: driverAttachmentsByInspection.get(r.id) ?? [],
    }
  })

  const loads = myLoads ?? []
  const today = todayInToronto()
  const todays = loads.filter((l) => l.pickup_date === today)
  const upcoming = loads.filter(
    (l) =>
      !ACTIVE_STATUSES.includes(l.status) ||
      (l.pickup_date && l.pickup_date > today),
  )
  const active = loads.filter((l) => ACTIVE_STATUSES.includes(l.status))

  const customerIds = [...new Set(loads.map((l) => l.customer_id))]
  const { data: customers } = customerIds.length
    ? await supabase
        .from("customers")
        .select("id, name")
        .in("id", customerIds)
    : { data: [] }
  const customerById = new Map(
    (customers ?? []).map((c) => [c.id, c.name] as const),
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          icon={CalendarClock}
          label="Pickups today"
          value={todays.length}
          accent="amber"
        />
        <Kpi
          icon={TruckIcon}
          label="Active loads"
          value={active.length}
          accent="indigo"
        />
        <Kpi
          icon={Clock}
          label="Upcoming"
          value={upcoming.length}
          accent="blue"
        />
        <Kpi
          icon={ListChecks}
          label="Total assigned"
          value={loads.length}
          accent="muted"
        />
      </div>

      <DriverCorrectionToast correction={recentCorrection} />

      <DriverComplianceWidget compliance={compliance ?? null} />

      <DriverDocumentsWidget docs={myDocuments} today={today} />

      <DriverInspectionWidget lastInspection={lastInspection ?? null} />

      <DriverInspectionHistoryWidget items={driverInspectionItems} />

      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          My loads
        </h2>
        {loads.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            No loads assigned to you yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {loads.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/loads/${l.id}`}
                  className="flex flex-wrap items-center gap-3 py-2.5 hover:bg-muted/30"
                >
                  <span className="font-mono text-sm font-medium">
                    {l.load_number}
                  </span>
                  <Badge
                    className={cn(
                      "border-transparent",
                      STATUS_TONE[l.status],
                    )}
                  >
                    {LOAD_STATUS_LABEL[l.status]}
                  </Badge>
                  <span className="text-sm">
                    {customerById.get(l.customer_id) ?? "—"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {[l.origin_city, l.origin_province]
                      .filter(Boolean)
                      .join(", ") || "—"}{" "}
                    →{" "}
                    {[l.destination_city, l.destination_province]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {l.pickup_date
                      ? format(parseISO(l.pickup_date), "MMM d")
                      : "no pickup date"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function EmployeesTile({ roles }: { roles: CurrentProfile["role"][] }) {
  const counts = roles.reduce<Record<string, number>>((acc, r) => {
    acc[r] = (acc[r] ?? 0) + 1
    return acc
  }, {})

  return (
    <Link
      href="/admin/employees"
      className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5 hover:bg-muted/20"
    >
      <CardLabel>Active employees</CardLabel>
      <span className="font-display text-4xl tracking-wide text-brand-navy">
        {roles.length.toLocaleString()}
      </span>
      <ul className="-mx-1 flex flex-col gap-0.5 pt-1">
        {ROLE_VALUES.map((role) => {
          const meta = ROLE_META[role]
          const Icon = meta.Icon
          const n = counts[role] ?? 0
          return (
            <li
              key={role}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md px-1 py-1 text-sm",
                n === 0 && "opacity-50",
              )}
            >
              <span className="flex items-center gap-2.5">
                <Icon
                  className={cn("size-4 shrink-0", meta.iconColor)}
                  aria-hidden="true"
                />
                <span className="font-medium text-foreground">
                  {meta.label}
                </span>
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {n}
              </span>
            </li>
          )
        })}
      </ul>
    </Link>
  )
}

type CustomerRow = {
  id: string
  name: string
  contact_name: string | null
  phone: string | null
  payment_terms_days: number | null
  credit_limit_cad: number | null
}

function CustomersCard({
  customers,
  total,
}: {
  customers: CustomerRow[]
  total: number
}) {
  const remaining = Math.max(0, total - customers.length)

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className="size-1.5 rounded-full bg-brand-gold"
              aria-hidden="true"
            />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
              Customers
            </span>
          </div>
          <span className="font-display text-2xl tracking-wide tabular-nums text-brand-navy">
            {total.toLocaleString()}
          </span>
        </div>
        <Link
          href="/customers"
          className="text-xs font-medium text-brand-teal hover:underline"
        >
          View all →
        </Link>
      </div>

      {customers.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          No active customers yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <th className="border-b border-border px-2 py-2 text-left font-semibold">
                  Customer
                </th>
                <th className="border-b border-border px-2 py-2 text-left font-semibold">
                  Phone
                </th>
                <th className="border-b border-border px-2 py-2 text-right font-semibold">
                  Terms
                </th>
                <th className="border-b border-border px-2 py-2 text-right font-semibold">
                  Credit limit
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="border-b border-border/50 px-2 py-2.5">
                    <div className="flex flex-col leading-tight">
                      <span className="font-medium">{c.name}</span>
                      {c.contact_name ? (
                        <span className="text-xs text-muted-foreground">
                          {c.contact_name}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="border-b border-border/50 px-2 py-2.5 text-muted-foreground tabular-nums">
                    {c.phone ?? (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums">
                    {c.payment_terms_days != null ? (
                      `Net ${c.payment_terms_days}`
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums">
                    {formatCAD(c.credit_limit_cad)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {remaining > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          + {remaining.toLocaleString()} more — see full list →
        </p>
      ) : null}
    </section>
  )
}

const QUICK_ACTIONS: Array<{
  href: string
  icon: LucideIcon
  title: string
  description: string
}> = [
  {
    href: "/loads/new",
    icon: Package,
    title: "Create load",
    description: "Add a new shipment and assign it to a driver",
  },
  {
    href: "/customers",
    icon: Building2,
    title: "Add customer",
    description: "Register a shipper or receiver for billing",
  },
  {
    href: "/trucks/new",
    icon: TruckIcon,
    title: "Add truck",
    description: "Register a power unit with compliance dates",
  },
  {
    href: "/trailers",
    icon: Container,
    title: "Add trailer",
    description: "Register a trailer and inspection schedule",
  },
]

function QuickActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon
        return (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              "group flex items-start gap-4 rounded-2xl border border-border/70 bg-card p-5",
              "shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.10)]",
              "transition-all hover:-translate-y-0.5 hover:border-brand-gold/40 hover:shadow-[0_4px_8px_rgba(18,41,74,0.06),0_16px_32px_-12px_rgba(18,41,74,0.18)]",
            )}
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold transition-colors group-hover:bg-brand-gold/25"
              aria-hidden="true"
            >
              <Icon className="size-5" />
            </span>
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-brand-navy">
                  {action.title}
                </h3>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-gold"
                  aria-hidden="true"
                />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {action.description}
              </p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

// Driver-side compliance summary on /dashboard. Three small status cards
// (licence / medical / FAST) plus a heads-up if anything is expired or
// imminent. RLS already lets the driver self-read their compliance row.
function DriverComplianceWidget({
  compliance,
}: {
  compliance: {
    licence_expiry: string | null
    medical_cert_expiry: string | null
    fast_card_expiry: string | null
    emergency_contact_name: string | null
  } | null
}) {
  const today = todayInToronto()
  const items: Array<{ label: string; date: string | null }> = [
    { label: "Driver licence", date: compliance?.licence_expiry ?? null },
    { label: "Medical cert", date: compliance?.medical_cert_expiry ?? null },
    { label: "FAST card", date: compliance?.fast_card_expiry ?? null },
  ]
  const hasAnyDate = items.some((i) => i.date !== null)
  const missingEmergencyContact = !compliance?.emergency_contact_name

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="size-1.5 rounded-full bg-brand-gold"
            aria-hidden="true"
          />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
            My compliance
          </h2>
        </div>
        {!hasAnyDate ? (
          <span className="text-xs text-muted-foreground">
            Ask your admin to fill these in.
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((it) => {
          if (!it.date) {
            return (
              <div
                key={it.label}
                className="flex flex-col gap-1 rounded-lg border border-dashed border-border bg-muted/20 p-3"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {it.label}
                </span>
                <span className="text-sm italic text-muted-foreground">
                  not set
                </span>
              </div>
            )
          }
          const days = daysBetween(today, it.date)
          const sev = severityFor(days)
          return (
            <div
              key={it.label}
              className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {it.label}
              </span>
              <span className="text-base font-semibold tabular-nums text-brand-navy">
                {format(parseISO(it.date), "MMM d, yyyy")}
              </span>
              <span
                className={cn(
                  "inline-flex w-fit items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                  SEVERITY_TONE[sev],
                )}
              >
                {days < 0
                  ? `expired ${relativeExpiryLabel(days)}`
                  : relativeExpiryLabel(days)}
              </span>
            </div>
          )
        })}
      </div>

      {missingEmergencyContact ? (
        <p className="text-xs text-muted-foreground">
          No emergency contact on file. Update it from{" "}
          <Link
            href="/account"
            className="text-brand-teal hover:underline"
          >
            your account
          </Link>
          .
        </p>
      ) : null}
    </section>
  )
}

// Driver-facing copies of their own compliance docs (licence scan, medical
// cert, FAST card). Read-only view — admins/dispatchers do the uploading
// from the driver detail page.
function DriverDocumentsWidget({
  docs,
  today,
}: {
  docs: Array<{
    id: string
    type: string
    file_name: string
    mime_type: string
    size_bytes: number
    expiry_date: string | null
    signed_url: string | null
  }>
  today: string
}) {
  if (docs.length === 0) return null
  const TYPE_LABEL: Record<string, string> = {
    driver_licence: "Driver licence",
    medical: "Medical cert",
    fast_card: "FAST card",
    other: "Other",
  }
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="size-1.5 rounded-full bg-brand-gold"
            aria-hidden="true"
          />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
            My documents
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          Tap to open in a new tab.
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {docs.map((d) => {
          const days =
            d.expiry_date !== null ? daysBetween(today, d.expiry_date) : null
          const sev = days !== null ? severityFor(days) : null
          return (
            <li key={d.id}>
              <a
                href={d.signed_url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-md border border-border bg-card/40 p-2 transition-colors hover:bg-muted/30"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <FileText className="size-4 text-muted-foreground" />
                </span>
                <div className="flex flex-1 flex-col gap-0.5 leading-tight overflow-hidden">
                  <span className="truncate text-sm font-medium">
                    {TYPE_LABEL[d.type] ?? d.type}
                  </span>
                  <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                    {d.file_name}
                  </span>
                </div>
                {d.expiry_date && days !== null && sev ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold",
                      SEVERITY_TONE[sev],
                    )}
                  >
                    {days < 0
                      ? `expired ${relativeExpiryLabel(days)}`
                      : relativeExpiryLabel(days)}
                  </span>
                ) : null}
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// Driver-side audit trail of their own inspections. Shows when they reported
// a defect and — if admin has signed off — when the truck was approved back
// in service.
type DriverInspectionMessage = {
  id: string
  authorId: string
  authorName: string
  authorRole: "admin" | "dispatcher" | "driver" | "accounting"
  message: string
  createdAt: string
  attachments: Array<{
    id: string
    file_name: string
    mime_type: string
    size_bytes: number
    uploaded_at: string
    signed_url: string | null
  }>
}

type DriverInspectionItem = {
  id: string
  truckId: string
  truckNumber: string
  type: "pre_trip" | "post_trip" | "en_route"
  severity: "none" | "minor" | "major"
  inspectionDate: string
  defectsDescription: string | null
  correctedAt: string | null
  correctedByName: string | null
  correctedNotes: string | null
  messages: DriverInspectionMessage[]
  attachments: Array<{
    id: string
    file_name: string
    mime_type: string
    signed_url: string | null
  }>
}

function DriverInspectionHistoryWidget({
  items,
}: {
  items: DriverInspectionItem[]
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5">
      <div className="flex items-center gap-2">
        <span
          className="size-1.5 rounded-full bg-brand-gold"
          aria-hidden="true"
        />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
          My inspection history
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          You haven&apos;t logged any inspections yet.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((it) => {
            const isOpenMajor =
              it.severity === "major" && !it.correctedAt
            const tone =
              it.severity === "major"
                ? "border-red-300 bg-red-50"
                : it.severity === "minor"
                  ? "border-amber-300 bg-amber-50"
                  : "border-emerald-200 bg-emerald-50"
            return (
              <li
                key={it.id}
                id={`inspection-${it.id}`}
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg border p-3 scroll-mt-24 target:ring-2 target:ring-brand-teal-light",
                  tone,
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5 leading-tight">
                    <span className="text-sm font-semibold">
                      <Link
                        href={`/trucks/${it.truckId}`}
                        className="hover:underline"
                      >
                        {it.truckNumber}
                      </Link>{" "}
                      <span className="font-normal text-muted-foreground">
                        · {it.type.replace("_", "-")} ·{" "}
                        {it.severity === "none"
                          ? "no defects"
                          : it.severity === "minor"
                            ? "minor defect"
                            : "major defect"}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {format(parseISO(it.inspectionDate), "MMM d, yyyy · h:mm a")}
                    </span>
                  </div>
                  {isOpenMajor ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-red-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-800">
                      <ShieldAlert className="size-3" />
                      Truck OOS
                    </span>
                  ) : null}
                </div>

                {it.defectsDescription ? (
                  <p className="text-xs">
                    <span className="font-medium">You wrote: </span>
                    {it.defectsDescription}
                  </p>
                ) : null}

                {it.attachments.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {it.attachments.map((att) =>
                      att.signed_url ? (
                        <a
                          key={att.id}
                          href={att.signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={att.file_name}
                          className="flex size-12 items-center justify-center overflow-hidden rounded-md border border-border bg-white transition-colors hover:border-foreground/30"
                        >
                          {att.mime_type.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={att.signed_url}
                              alt=""
                              className="size-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <FileText className="size-4 text-muted-foreground" />
                          )}
                        </a>
                      ) : null,
                    )}
                  </div>
                ) : null}

                <MessageThread
                  inspectionId={it.id}
                  messages={it.messages.map((m) => ({
                    id: m.id,
                    authorId: m.authorId,
                    authorName: m.authorName,
                    authorRole: m.authorRole,
                    message: m.message,
                    createdAt: m.createdAt,
                    attachments: m.attachments,
                  }))}
                  canMessage={true}
                />

                {it.correctedAt ? (
                  <div className="mt-0.5 rounded-md border border-emerald-300 bg-emerald-100/70 px-2.5 py-1.5 text-xs text-emerald-900">
                    <div className="flex items-center gap-1.5">
                      <CircleCheck className="size-3.5" />
                      <span>
                        <span className="font-semibold">
                          Approved back in service
                        </span>{" "}
                        {format(parseISO(it.correctedAt), "MMM d, yyyy · h:mm a")}{" "}
                        · by{" "}
                        <span className="font-medium">
                          {it.correctedByName ?? "Admin"}
                        </span>
                      </span>
                    </div>
                    {it.correctedNotes ? (
                      <p className="mt-1 pl-5 text-emerald-900/80">
                        {it.correctedNotes}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

// Compliance / expiry feed. Aggregates truck plate / insurance / IFTA /
// safety / CVOR expiries, trailer plate + inspection due, driver licence /
// medical / FAST, and any uploaded document with an expiry date in the next
// 90 days (or expired in the last 60). This is the widget that pays for the
// CRM at audit time — see CLAUDE.md "Compliance & expiry alerts".
function ExpiryAlertsCard({
  items,
  totalCount,
  compact = false,
}: {
  items: Array<{
    id: string
    href: string
    entity: string
    entityType: "truck" | "trailer" | "driver" | "document"
    field: string
    date: string
    daysUntil: number
    severity: "expired" | "critical" | "warning" | "ok"
  }>
  totalCount: number
  compact?: boolean
}) {
  const ENTITY_TONE: Record<string, string> = {
    truck: "bg-blue-500/15 text-blue-700",
    trailer: "bg-purple-500/15 text-purple-700",
    driver: "bg-emerald-500/15 text-emerald-700",
    document: "bg-amber-500/15 text-amber-700",
  }

  if (compact) {
    // Side-panel layout that matches the reference dashboard: single-column
    // list, big header line with item count, "View all" pinned top-right.
    // List is sized to fill the side rail alongside the map, so the panel
    // doesn't bottom out empty.
    const visible = items.slice(0, 10)
    return (
      <section className="flex h-full flex-col gap-3 rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/70 to-white p-4 shadow-[0_1px_2px_rgba(217,119,6,0.06),0_8px_24px_-12px_rgba(217,119,6,0.18)]">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-[0_4px_12px_-2px_rgba(217,119,6,0.45)]">
            <ShieldAlert className="size-4" aria-hidden="true" />
          </span>
          <div className="flex flex-1 flex-col gap-0.5 leading-tight">
            <p className="text-sm font-semibold text-amber-900">
              {totalCount} compliance{" "}
              {totalCount === 1 ? "item" : "items"} expiring in the next
              90 days
            </p>
            <p className="text-xs text-amber-800/80">
              Renew or upload to keep your fleet legal at the border and
              roadside.
            </p>
          </div>
          <Link
            href="/compliance"
            className="shrink-0 rounded-md border border-amber-300/60 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-amber-900 transition-colors hover:bg-white"
          >
            View all
          </Link>
        </div>
        <ul className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
          {visible.map((it) => (
            <li key={it.id}>
              <Link
                href={it.href}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2 text-xs transition-colors",
                  "hover:bg-white hover:shadow-sm focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2 leading-tight">
                  <span className="font-mono text-sm font-semibold text-brand-navy">
                    {it.entity}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {it.field}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2 leading-tight">
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                      SEVERITY_TONE[it.severity],
                    )}
                  >
                    {it.daysUntil < 0
                      ? `Expired ${relativeExpiryLabel(it.daysUntil)}`
                      : `Expires ${relativeExpiryLabel(it.daysUntil)}`}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {format(parseISO(it.date), "MMM d, yyyy")}
                  </span>
                  <ChevronRight
                    className="size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {totalCount > visible.length ? (
          <Link
            href="/compliance"
            className="text-[11px] font-medium text-amber-800/80 hover:text-amber-900"
          >
            +{totalCount - visible.length} more items
            <ChevronRight
              className="ml-0.5 inline size-3"
              aria-hidden="true"
            />
          </Link>
        ) : null}
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-[0_1px_2px_rgba(217,119,6,0.06),0_8px_24px_-12px_rgba(217,119,6,0.18)]">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-500 text-white">
          <CalendarClock className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-1 flex-col gap-2">
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {totalCount} compliance {totalCount === 1 ? "item" : "items"}{" "}
              expiring in the next 90 days
            </p>
            <p className="text-xs text-amber-800/80">
              Renew or upload a fresh copy before each item lapses to keep the
              fleet legal at the border and the roadside.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {items.map((it) => (
              <li key={it.id}>
                <Link
                  href={it.href}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md bg-white/70 px-3 py-2 text-xs transition-colors",
                    "hover:bg-white hover:shadow-sm focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
                  )}
                >
                  <div className="flex flex-1 items-center gap-2 overflow-hidden leading-tight">
                    <span
                      className={cn(
                        "shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                        ENTITY_TONE[it.entityType],
                      )}
                    >
                      {it.entityType}
                    </span>
                    <span className="flex flex-col leading-tight overflow-hidden">
                      <span className="truncate font-mono text-sm font-semibold">
                        {it.entity}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {it.field}
                      </span>
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5 leading-tight">
                    <span
                      className={cn(
                        "rounded-sm px-1.5 py-0.5 text-[10px] font-semibold",
                        SEVERITY_TONE[it.severity],
                      )}
                    >
                      {it.daysUntil < 0
                        ? `expired ${relativeExpiryLabel(it.daysUntil)}`
                        : relativeExpiryLabel(it.daysUntil)}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {format(parseISO(it.date), "MMM d, yyyy")}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {totalCount > items.length ? (
            <p className="text-[11px] text-amber-800/70">
              Showing the {items.length} most-urgent. {totalCount - items.length}{" "}
              more coming up — visit the affected truck or driver for details.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

// Maintenance-due feed — every truck with an upcoming or overdue service.
// Drives the dispatcher's "don't roll this one without a service" decision.
function MaintenanceDueCard({
  items,
  totalCount,
}: {
  items: Array<{
    id: string
    truckId: string
    truckNumber: string
    serviceLabel: string
    severity: "overdue" | "due" | "warning"
    detail: string
  }>
  totalCount: number
}) {
  const SEV_TONE: Record<string, string> = {
    overdue: "bg-red-200 text-red-900",
    due: "bg-amber-100 text-amber-800",
    warning: "bg-yellow-100 text-yellow-800",
  }
  const SEV_LABEL: Record<string, string> = {
    overdue: "Overdue",
    due: "Due now",
    warning: "Coming up",
  }
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-orange-200 bg-orange-50/60 p-4 shadow-[0_1px_2px_rgba(234,88,12,0.06),0_8px_24px_-12px_rgba(234,88,12,0.18)]">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-orange-500 text-white">
          <Wrench className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-1 flex-col gap-2">
          <div>
            <p className="text-sm font-semibold text-orange-900">
              {totalCount} truck{totalCount === 1 ? "" : "s"} with maintenance
              due
            </p>
            <p className="text-xs text-orange-800/80">
              Schedule the service before assigning these trucks to long runs.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {items.map((it) => (
              <li key={it.id}>
                <Link
                  href={`/trucks/${it.truckId}`}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md bg-white/70 px-3 py-2 text-xs transition-colors",
                    "hover:bg-white hover:shadow-sm focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400",
                  )}
                >
                  <div className="flex flex-1 flex-col leading-tight overflow-hidden">
                    <span className="truncate font-mono text-sm font-semibold">
                      {it.truckNumber}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {it.serviceLabel} · {it.detail}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      SEV_TONE[it.severity],
                    )}
                  >
                    {SEV_LABEL[it.severity]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {totalCount > items.length ? (
            <p className="text-[11px] text-orange-800/70">
              {totalCount - items.length} more — open the truck for the full
              service log.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

// Inline alert surfaced on the admin / dispatcher dashboard whenever a truck
// is sitting out-of-service from a major-defect inspection. Lists the trucks
// + flagging driver so dispatch can intervene quickly.
function InspectionAlertsCard({
  items,
}: {
  items: Array<{
    id: string
    truckId: string
    truckNumber: string
    driverName: string
    inspectionType: "pre_trip" | "post_trip" | "en_route"
    inspectionDate: string
    defectsDescription: string | null
  }>
}) {
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-red-500 text-white">
          <ShieldAlert className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-1 flex-col gap-2">
          <div>
            <p className="text-sm font-semibold text-red-900">
              {items.length} truck{items.length === 1 ? "" : "s"} out of service
              from a major defect
            </p>
            <p className="text-xs text-red-800/80">
              Don&apos;t assign these until an admin marks the inspection
              corrected.
            </p>
          </div>
          <ul className="flex flex-col gap-1.5">
            {items.map((it) => (
              <li key={it.id}>
                <PreviewCard>
                  <PreviewCardTrigger
                    delay={250}
                    closeDelay={120}
                    render={
                      // Whole row is the clickable surface — clicking anywhere
                      // navigates to the truck detail page; hovering pops up
                      // the preview. No onClick handlers, so this stays a
                      // Server-Component-safe Link.
                      <Link
                        href={`/trucks/${it.truckId}`}
                        className={cn(
                          "flex items-start justify-between gap-3 rounded-md bg-white/60 px-3 py-2 text-xs transition-colors",
                          "hover:bg-white hover:shadow-sm focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400",
                        )}
                      />
                    }
                  >
                    <div className="flex flex-col gap-0.5 leading-tight">
                      <span className="text-sm font-semibold">
                        {it.truckNumber}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {it.driverName} ·{" "}
                          {it.inspectionType.replace("_", "-")}
                        </span>
                      </span>
                      <span className="line-clamp-1 text-muted-foreground">
                        {it.defectsDescription?.trim() ||
                          "Major defect logged."}
                      </span>
                    </div>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {format(parseISO(it.inspectionDate), "MMM d · h:mma")}
                    </span>
                  </PreviewCardTrigger>
                  <PreviewCardContent
                    side="left"
                    align="start"
                    sideOffset={12}
                    className="w-[340px] p-0"
                  >
                    <InspectionAlertPreview item={it} />
                  </PreviewCardContent>
                </PreviewCard>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function InspectionAlertPreview({
  item,
}: {
  item: {
    id: string
    truckId: string
    truckNumber: string
    driverName: string
    inspectionType: "pre_trip" | "post_trip" | "en_route"
    inspectionDate: string
    defectsDescription: string | null
  }
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-red-500/15 px-4 py-3">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-300" />
          <div className="flex flex-col leading-tight">
            <span className="font-mono text-sm font-semibold text-brand-cloud">
              {item.truckNumber}
            </span>
            <span className="text-xs text-brand-cloud/65">
              Out of service · major defect
            </span>
          </div>
        </div>
        <span className="rounded-md bg-red-500/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-100">
          {item.inspectionType.replace("_", "-")}
        </span>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3 text-xs text-brand-cloud/85">
        <div className="flex flex-col gap-0.5 leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-cloud/55">
            Reported by
          </span>
          <span className="text-sm font-medium text-brand-cloud">
            {item.driverName}
          </span>
          <span className="text-brand-cloud/65">
            {format(parseISO(item.inspectionDate), "EEE, MMM d, yyyy · h:mm a")}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 rounded-md bg-white/5 px-2.5 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-cloud/55">
            Defect
          </span>
          <span className="whitespace-pre-wrap text-sm text-brand-cloud/90">
            {item.defectsDescription?.trim() ||
              "No additional description provided."}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-white/5 px-4 py-2">
        <Link
          href={`/trucks/${item.truckId}`}
          className={cn(
            buttonVariants({ size: "sm" }),
            "bg-brand-gold text-brand-navy hover:bg-brand-gold-light",
          )}
        >
          Open truck
          <ChevronRight className="size-3" />
        </Link>
      </div>
    </div>
  )
}

// Driver-side DVIR (pre-trip / post-trip) CTA card. Surfaces the most recent
// inspection so the driver knows whether they've already signed off today,
// and gives them one-tap entry points for both inspection types.
function DriverInspectionWidget({
  lastInspection,
}: {
  lastInspection: {
    id: string
    inspection_type: "pre_trip" | "post_trip" | "en_route"
    severity: "none" | "minor" | "major"
    inspection_date: string
    defects_description: string | null
  } | null
}) {
  const today = todayInToronto()
  const lastDate = lastInspection
    ? lastInspection.inspection_date.slice(0, 10)
    : null
  const doneToday =
    lastDate === today && lastInspection?.inspection_type === "pre_trip"

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="size-1.5 rounded-full bg-brand-gold"
            aria-hidden="true"
          />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
            Daily inspection (DVIR)
          </h2>
        </div>
        {doneToday ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
            <CircleCheck className="size-3" />
            Pre-trip done today
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
            <AlertTriangle className="size-3" />
            Pre-trip required
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Link
          href="/inspections/new?type=pre_trip"
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-auto justify-start gap-3 py-3 text-left",
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white/15">
            <ListChecks className="size-5" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold">Start pre-trip</span>
            <span className="text-[11px] opacity-80">
              Walkaround, defects, sign
            </span>
          </span>
        </Link>
        <Link
          href="/inspections/new?type=post_trip"
          className={cn(
            buttonVariants({ size: "lg", variant: "outline" }),
            "h-auto justify-start gap-3 py-3 text-left",
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <ListChecks className="size-5" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold">Post-trip</span>
            <span className="text-[11px] opacity-80">End-of-day report</span>
          </span>
        </Link>
      </div>

      {lastInspection ? (
        <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            Last:{" "}
            <span className="font-medium text-foreground">
              {format(parseISO(lastInspection.inspection_date), "MMM d · h:mm a")}
            </span>{" "}
            · {lastInspection.inspection_type.replace("_", "-")}
            {lastInspection.severity !== "none"
              ? ` · ${lastInspection.severity} defect`
              : " · clean"}
          </span>
          {lastInspection.severity === "major" ? (
            <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-700">
              <ShieldAlert className="size-3" />
              Truck OOS
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-1.5 rounded-full bg-brand-gold" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
        {children}
      </span>
    </div>
  )
}

// Light-on-dark accent colours for the liquid-glass KPI cards. The shades
// are picked to read against the brand-midnight backdrop without overpowering
// the brand-cloud body text.
const ACCENT_TONE: Record<
  "blue" | "indigo" | "emerald" | "amber" | "red" | "muted",
  string
> = {
  blue: "text-blue-200",
  indigo: "text-indigo-200",
  emerald: "text-emerald-200",
  amber: "text-amber-200",
  red: "text-red-300",
  muted: "text-brand-cloud",
}

const ICON_BG: Record<keyof typeof ACCENT_TONE, string> = {
  blue: "bg-blue-400/15 text-blue-200",
  indigo: "bg-indigo-400/15 text-indigo-200",
  emerald: "bg-emerald-400/15 text-emerald-200",
  amber: "bg-amber-400/15 text-amber-200",
  red: "bg-red-400/15 text-red-200",
  muted: "bg-white/10 text-brand-cloud/80",
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
  href,
  compact = false,
}: {
  icon?: LucideIcon
  label: string
  value: number | string
  accent: keyof typeof ACCENT_TONE
  href?: string
  compact?: boolean
}) {
  const inner = (
    <>
      {/* Subtle teal radial wash mirrors the preview-card glass treatment so
          KPIs feel like they belong to the same surface family. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-20 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,160,146,0.18)_0%,transparent_70%)]"
      />
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="size-1.5 rounded-full bg-brand-gold"
            aria-hidden="true"
          />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
            {label}
          </span>
        </div>
        {Icon ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-lg",
              compact ? "size-6" : "size-7",
              ICON_BG[accent],
            )}
            aria-hidden="true"
          >
            <Icon className={compact ? "size-3.5" : "size-4"} />
          </span>
        ) : null}
      </div>
      <span
        className={cn(
          "font-display tracking-wide tabular-nums",
          compact ? "text-2xl" : "text-3xl",
          ACCENT_TONE[accent],
        )}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </>
  )

  // Same surface gradient as the Live Fleet Map — teal accent top-right,
  // gold accent bottom-left, linear navy base — applied inline so the tile
  // is identical to the map at a glance. Inline rather than via a Tailwind
  // arbitrary class to dodge any utility-name collision.
  const className = cn(
    "relative isolate flex flex-col justify-between gap-1 overflow-hidden rounded-xl border border-white/10 text-brand-cloud [box-shadow:inset_0_1px_0_rgba(255,255,255,0.12),0_24px_48px_-16px_rgba(10,14,26,0.45),0_4px_16px_-4px_rgba(10,14,26,0.25)]",
    compact ? "p-3 gap-1.5" : "p-4 gap-2",
  )
  const surfaceStyle = {
    background: [
      "radial-gradient(ellipse at top right, rgba(34, 160, 146, 0.10), transparent 55%)",
      "radial-gradient(ellipse at bottom left, rgba(240, 168, 32, 0.06), transparent 50%)",
      "linear-gradient(180deg, #0d1426 0%, #0a0e1a 100%)",
    ].join(", "),
  } as const

  return href ? (
    <Link
      href={href}
      style={surfaceStyle}
      className={cn(
        className,
        "transition-colors hover:border-white/15 hover:[filter:brightness(1.12)]",
      )}
    >
      {inner}
    </Link>
  ) : (
    <div style={surfaceStyle} className={className}>
      {inner}
    </div>
  )
}

