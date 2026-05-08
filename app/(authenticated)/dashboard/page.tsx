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
  TrendingUp,
  Truck as TruckIcon,
  UserCheck,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { ROLE_META } from "@/components/shared/role-badge"
import { requireRole, type CurrentProfile } from "@/lib/auth"
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-3">
          <Eyebrow>{eyebrowForRole(profile.role)}</Eyebrow>
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-4xl uppercase tracking-wide text-brand-navy lg:text-5xl">
              Welcome back
              {profile.full_name
                ? `, ${profile.full_name.split(" ")[0]}`
                : ""}
            </h1>
            <p className="text-sm text-muted-foreground">
              {greetingForRole(profile.role)}
            </p>
          </div>
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

  return (
    <div className="flex flex-col gap-6">
      <QuickActions />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <OperationsChart
          series={series}
          previousTotalRevenue={previous.revenue}
          previousTotalCount={previous.count}
          title="Operations"
        />

        <div className="grid auto-rows-fr grid-cols-2 gap-3">
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <OperationsMap points={mapPoints} />

        <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Live load board
              </h2>
              <p className="text-xs text-muted-foreground">
                Active loads sorted by pickup date.
              </p>
            </div>
            <Link
              href="/loads"
              className="text-xs font-medium text-brand-teal hover:underline"
            >
              View all →
            </Link>
          </div>
          {boardLoads.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/20 p-8 text-center">
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
            <ul className="flex flex-col divide-y divide-border">
              {boardLoads.map((l) => (
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
                    <span className="text-sm text-muted-foreground">
                      {customerById.get(l.customer_id) ?? "—"}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {l.pickup_date
                        ? format(parseISO(l.pickup_date), "MMM d")
                        : "no pickup date"}
                    </span>
                    <span className="text-sm">
                      {l.driver_id
                        ? driverById.get(l.driver_id) ?? "driver"
                        : (
                            <span className="italic text-muted-foreground">
                              unassigned
                            </span>
                          )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

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

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="size-1.5 rounded-full bg-brand-gold" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-gold">
        {children}
      </span>
    </div>
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
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-cloud/65">
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

  // Liquid glass: brand-midnight backdrop + blur + 1px white inset highlight
  // along the top edge + soft layered drop shadow. Matches PreviewCardContent.
  const className = cn(
    "relative isolate flex flex-col justify-between gap-1 overflow-hidden rounded-xl border border-white/10 bg-brand-midnight/80 text-brand-cloud backdrop-blur-2xl backdrop-saturate-150 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.12),0_24px_48px_-16px_rgba(10,14,26,0.45),0_4px_16px_-4px_rgba(10,14,26,0.25)]",
    compact ? "p-3 gap-1.5" : "p-4 gap-2",
  )

  return href ? (
    <Link
      href={href}
      className={cn(
        className,
        "transition-colors hover:bg-brand-midnight/70 hover:border-white/15",
      )}
    >
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  )
}

function eyebrowForRole(role: CurrentProfile["role"]) {
  switch (role) {
    case "admin":
      return "Company overview"
    case "dispatcher":
      return "Today's board"
    case "driver":
      return "Your day"
    case "accounting":
      return "Books"
  }
}

function greetingForRole(role: CurrentProfile["role"]) {
  switch (role) {
    case "admin":
      return "Operations, fleet, and onboarding at a glance."
    case "dispatcher":
      return "Loads, drivers, and trucks at a glance."
    case "driver":
      return "Your assigned loads, in pickup-date order."
    case "accounting":
      return "Invoices, A/R aging, and revenue."
  }
}
