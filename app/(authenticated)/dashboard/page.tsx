import Link from "next/link"
import { format, parseISO } from "date-fns"
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CircleCheck,
  CircleDollarSign,
  Clock,
  FileText,
  ListChecks,
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
    { count: customersCount },
    employeesAgg,
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
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    showEmployees
      ? supabase
          .from("profiles")
          .select("role")
          .eq("active", true)
      : Promise.resolve({ data: null }),
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
  const deliveredRows: DeliveredRow[] = all.map((l) => ({
    delivery_date: l.delivery_date,
    total_billed_cad: l.total_billed_cad,
    status: l.status,
  }))
  const series = buildDailySeries(deliveredRows, today, 30)
  const previous = totalsForRange(
    deliveredRows,
    sixtyDaysAgoStart,
    thirtyOneDaysAgo,
  )
  void thirtyDaysAgo
  void sixtyDaysAgo

  // Build the live board: top ~12 active loads sorted by pickup date.
  const boardLoads = inProgress.slice(0, 12)
  const customerIds = [...new Set(boardLoads.map((l) => l.customer_id))]
  const driverIds = [
    ...new Set(
      boardLoads.map((l) => l.driver_id).filter((v): v is string => !!v),
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

  return (
    <div className="flex flex-col gap-6">
      <OperationsChart
        series={series}
        previousTotalRevenue={previous.revenue}
        previousTotalCount={previous.count}
        title="Operations"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi
          icon={Activity}
          label="In progress"
          value={inProgress.length}
          accent="indigo"
          href="/loads"
        />
        <Kpi
          icon={unassigned.length > 0 ? AlertTriangle : CircleCheck}
          label="Unassigned"
          value={unassigned.length}
          accent={unassigned.length > 0 ? "red" : "muted"}
          href="/loads"
        />
        <Kpi
          icon={CalendarClock}
          label="Pickups today"
          value={pickupsToday.length}
          accent="amber"
        />
        <Kpi
          icon={PackageCheck}
          label="Delivered today"
          value={deliveredToday.length}
          accent="emerald"
        />
        <Kpi
          icon={UserCheck}
          label="Active drivers"
          value={activeDriversCount ?? 0}
          accent="blue"
        />
        <Kpi
          icon={TruckIcon}
          label="Available trucks"
          value={availableTrucksCount ?? 0}
          accent="blue"
        />
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Tile
          label="Customers"
          value={customersCount ?? 0}
          href="/customers"
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
    { data: trendRows },
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
      .from("loads")
      .select("delivery_date, total_billed_cad, status")
      .in("status", ["delivered", "invoiced", "paid"])
      .gte("delivery_date", sixtyDaysAgo),
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

  const trend = (trendRows ?? []) as DeliveredRow[]
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
      <OperationsChart
        series={series}
        previousTotalRevenue={previous.revenue}
        previousTotalCount={previous.count}
        title="Revenue"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          icon={FileText}
          label="Awaiting invoice"
          value={queue.length}
          accent={queue.length > 0 ? "amber" : "muted"}
        />
        <Kpi
          icon={CircleDollarSign}
          label="A/R outstanding"
          value={formatCAD(arOutstanding)}
          accent="indigo"
        />
        <Kpi
          icon={TrendingUp}
          label="Revenue this month"
          value={formatCAD(revenueThisMonth)}
          accent="emerald"
        />
        <Kpi
          icon={BadgeCheck}
          label="Paid this month"
          value={formatCAD(paidThisMonth)}
          accent="emerald"
        />
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

function Tile({
  label,
  value,
  href,
}: {
  label: string
  value: number
  href: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-5 hover:bg-muted/20"
    >
      <CardLabel>{label}</CardLabel>
      <span className="font-display text-3xl tracking-wide text-brand-navy">
        {value.toLocaleString()}
      </span>
    </Link>
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

const ACCENT_TONE: Record<
  "blue" | "indigo" | "emerald" | "amber" | "red" | "muted",
  string
> = {
  blue: "text-blue-700 dark:text-blue-300",
  indigo: "text-indigo-700 dark:text-indigo-300",
  emerald: "text-emerald-700 dark:text-emerald-300",
  amber: "text-amber-700 dark:text-amber-300",
  red: "text-red-700 dark:text-red-300",
  muted: "text-foreground",
}

const ICON_BG: Record<keyof typeof ACCENT_TONE, string> = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  red: "bg-red-500/10 text-red-600 dark:text-red-300",
  muted: "bg-muted text-muted-foreground",
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
  href,
}: {
  icon?: LucideIcon
  label: string
  value: number | string
  accent: keyof typeof ACCENT_TONE
  href?: string
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <CardLabel>{label}</CardLabel>
        {Icon ? (
          <span
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-lg",
              ICON_BG[accent],
            )}
            aria-hidden="true"
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <span
        className={cn(
          "font-display text-3xl tracking-wide tabular-nums",
          ACCENT_TONE[accent],
        )}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </>
  )

  const className =
    "flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-4 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]"

  return href ? (
    <Link href={href} className={cn(className, "hover:bg-muted/20")}>
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
