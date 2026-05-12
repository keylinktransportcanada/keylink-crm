import Link from "next/link"
import { format, parseISO } from "date-fns"
import {
  BadgeCheck,
  Building2,
  CalendarRange,
  CircleDollarSign,
  Clock,
  Package,
  TrendingUp,
  UserCheck,
} from "lucide-react"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Range presets
// ---------------------------------------------------------------------------
type RangeKey = "month" | "quarter" | "ytd" | "last12" | "all"
const RANGE_LABEL: Record<RangeKey, string> = {
  month: "This month",
  quarter: "This quarter",
  ytd: "Year to date",
  last12: "Last 12 months",
  all: "All time",
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function rangeBounds(key: RangeKey): { start: string | null; end: string | null } {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1 // 1-12
  const today = isoDate(year, month, now.getUTCDate())
  switch (key) {
    case "month":
      return { start: isoDate(year, month, 1), end: today }
    case "quarter": {
      const qStartMonth = Math.floor((month - 1) / 3) * 3 + 1
      return { start: isoDate(year, qStartMonth, 1), end: today }
    }
    case "ytd":
      return { start: isoDate(year, 1, 1), end: today }
    case "last12": {
      // 12 months back from the start of the current month.
      const startMonth = month === 1 ? 12 : month - 1
      const startYear = month === 1 ? year - 1 : year
      // Actually: "last 12 months" = today minus ~365 days. Use first of
      // (month - 11) for a calendar-aligned window.
      const back11Month = ((month - 12 + 12) % 12) + 1
      const back11Year = month - 12 < 0 ? year - 1 : year
      void startMonth
      void startYear
      return { start: isoDate(back11Year, back11Month, 1), end: today }
    }
    case "all":
      return { start: null, end: null }
  }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
const formatCAD = (value: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value)

const formatCAD2 = (value: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(value)

const formatPct = (value: number) =>
  `${(value * 100).toFixed(1)}%`

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-CA").format(value)

const DELIVERED_STATUSES = new Set(["delivered", "invoiced", "paid"])

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: RangeKey }>
}) {
  await requireRole(["admin", "accounting"])
  const sp = await searchParams
  const range = (
    sp.range && Object.keys(RANGE_LABEL).includes(sp.range) ? sp.range : "ytd"
  ) as RangeKey
  const { start, end } = rangeBounds(range)

  const supabase = await createClient()

  // Pull all loads in the range that count as revenue (delivered/invoiced/
  // paid). Pre-tax `total_billed_cad` is the carrier's revenue — tax is
  // collected for CRA, not earned.
  let q = supabase
    .from("loads")
    .select(
      `id, load_number, status, customer_id, driver_id, truck_id,
       delivery_date, total_billed_cad, tax_amount_cad,
       origin_city, origin_province, destination_city, destination_province`,
    )
    .in("status", ["delivered", "invoiced", "paid"])
  if (start) q = q.gte("delivery_date", start)
  if (end) q = q.lte("delivery_date", end)
  const { data: loads } = await q.order("delivery_date", {
    ascending: false,
  })

  // Look up "delivered" status-event timestamps to compute on-time rate per
  // load. We compare the event date to the planned delivery_date.
  const loadIds = (loads ?? []).map((l) => l.id)
  const { data: deliveredEvents } = loadIds.length
    ? await supabase
        .from("load_status_events")
        .select("load_id, created_at")
        .in("load_id", loadIds)
        .eq("status", "delivered")
        .order("created_at", { ascending: true })
    : { data: [] }
  // First delivered event per load = the "actually delivered" timestamp.
  const deliveredAtByLoad = new Map<string, string>()
  for (const e of deliveredEvents ?? []) {
    if (!deliveredAtByLoad.has(e.load_id)) {
      deliveredAtByLoad.set(e.load_id, e.created_at)
    }
  }

  // Resolve customer + driver names.
  const customerIds = [
    ...new Set((loads ?? []).map((l) => l.customer_id).filter(Boolean)),
  ] as string[]
  const driverIds = [
    ...new Set(
      (loads ?? []).map((l) => l.driver_id).filter((v): v is string => !!v),
    ),
  ]
  const [{ data: customers }, { data: drivers }] = await Promise.all([
    customerIds.length
      ? supabase.from("customers").select("id, name").in("id", customerIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    driverIds.length
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", driverIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ])
  const customerNameById = new Map(
    (customers ?? []).map((c) => [c.id, c.name] as const),
  )
  const driverNameById = new Map(
    (drivers ?? []).map(
      (d) => [d.id, d.full_name ?? "Unnamed"] as const,
    ),
  )

  // -------------------------------------------------------------------
  // Aggregates
  // -------------------------------------------------------------------
  const totalRevenue = (loads ?? []).reduce(
    (s, l) => s + Number(l.total_billed_cad ?? 0),
    0,
  )
  const totalTax = (loads ?? []).reduce(
    (s, l) => s + Number(l.tax_amount_cad ?? 0),
    0,
  )
  const totalLoads = (loads ?? []).length
  const avgLoadValue = totalLoads > 0 ? totalRevenue / totalLoads : 0

  // On-time rate: among loads with both a delivered event and a planned
  // delivery_date, what fraction were actually delivered on or before the
  // planned date?
  let onTimeEligible = 0
  let onTimeCount = 0
  for (const l of loads ?? []) {
    if (!l.delivery_date) continue
    const actualIso = deliveredAtByLoad.get(l.id)
    if (!actualIso) continue
    onTimeEligible++
    // Compare YYYY-MM-DD strings — late means actual day > planned day.
    const actualDay = actualIso.slice(0, 10)
    if (actualDay <= l.delivery_date) onTimeCount++
  }
  const onTimeRate = onTimeEligible > 0 ? onTimeCount / onTimeEligible : 0

  // Revenue by month — bucket by delivery_date's YYYY-MM. Build 12 months
  // ending at the range end (or today for "all time"). Empty months render
  // as zero so the bar chart stays evenly spaced.
  const endDate = end ? new Date(`${end}T12:00:00Z`) : new Date()
  const monthlyKeys: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(
      Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() - i, 1),
    )
    monthlyKeys.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    )
  }
  const monthlyRevenue = new Map<string, number>(
    monthlyKeys.map((k) => [k, 0]),
  )
  for (const l of loads ?? []) {
    if (!l.delivery_date) continue
    const key = l.delivery_date.slice(0, 7)
    if (!monthlyRevenue.has(key)) continue
    monthlyRevenue.set(
      key,
      (monthlyRevenue.get(key) ?? 0) + Number(l.total_billed_cad ?? 0),
    )
  }
  const monthlyRows = monthlyKeys.map((k) => ({
    key: k,
    label: format(parseISO(`${k}-01`), "MMM yy"),
    revenue: monthlyRevenue.get(k) ?? 0,
  }))
  const monthlyMax = Math.max(1, ...monthlyRows.map((m) => m.revenue))

  // Revenue by customer (top N) with load count.
  type AggRow = { id: string; name: string; revenue: number; count: number }
  const customerAgg = new Map<string, AggRow>()
  for (const l of loads ?? []) {
    if (!l.customer_id) continue
    const entry =
      customerAgg.get(l.customer_id) ?? {
        id: l.customer_id,
        name: customerNameById.get(l.customer_id) ?? "—",
        revenue: 0,
        count: 0,
      }
    entry.revenue += Number(l.total_billed_cad ?? 0)
    entry.count += 1
    customerAgg.set(l.customer_id, entry)
  }
  const customerRows = Array.from(customerAgg.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // Revenue by driver (top N) + their on-time rate.
  type DriverAgg = AggRow & { onTime: number; onTimeEligible: number }
  const driverAgg = new Map<string, DriverAgg>()
  for (const l of loads ?? []) {
    if (!l.driver_id) continue
    const entry =
      driverAgg.get(l.driver_id) ?? {
        id: l.driver_id,
        name: driverNameById.get(l.driver_id) ?? "—",
        revenue: 0,
        count: 0,
        onTime: 0,
        onTimeEligible: 0,
      }
    entry.revenue += Number(l.total_billed_cad ?? 0)
    entry.count += 1
    if (l.delivery_date) {
      const actual = deliveredAtByLoad.get(l.id)
      if (actual) {
        entry.onTimeEligible += 1
        if (actual.slice(0, 10) <= l.delivery_date) entry.onTime += 1
      }
    }
    driverAgg.set(l.driver_id, entry)
  }
  const driverRows = Array.from(driverAgg.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // Lane profitability — origin city → destination city pair.
  type LaneAgg = {
    key: string
    origin: string
    destination: string
    revenue: number
    count: number
  }
  const laneAgg = new Map<string, LaneAgg>()
  for (const l of loads ?? []) {
    const origin = l.origin_city ?? "—"
    const dest = l.destination_city ?? "—"
    const key = `${origin}|${dest}`
    const entry =
      laneAgg.get(key) ?? {
        key,
        origin,
        destination: dest,
        revenue: 0,
        count: 0,
      }
    entry.revenue += Number(l.total_billed_cad ?? 0)
    entry.count += 1
    laneAgg.set(key, entry)
  }
  const laneRows = Array.from(laneAgg.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  void DELIVERED_STATUSES // keep import-side reference

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <span className="size-1.5 rounded-full bg-brand-gold" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-gold">
            Reports
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-4xl uppercase tracking-wide text-brand-navy lg:text-5xl">
            {RANGE_LABEL[range]}
          </h1>
          <p className="text-sm text-muted-foreground">
            Pre-tax revenue, on-time delivery, top customers and drivers, and
            lane profitability. Loads count once they reach Delivered status.
          </p>
        </div>
      </header>

      {/* Range picker --------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card p-4 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
        <CalendarRange className="size-4 shrink-0 text-brand-gold" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
          Range
        </span>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => {
            const active = k === range
            return (
              <Link
                key={k}
                href={`/reports?range=${k}`}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  active
                    ? "bg-brand-navy text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                {RANGE_LABEL[k]}
              </Link>
            )
          })}
        </div>
        {start && end ? (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {start} → {end}
          </span>
        ) : (
          <span className="ml-auto text-xs text-muted-foreground italic">
            entire history
          </span>
        )}
      </div>

      {/* Summary tiles -------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile
          icon={CircleDollarSign}
          label="Revenue (pre-tax)"
          value={formatCAD(totalRevenue)}
          subtle={`${formatNumber(totalLoads)} loads`}
          accent="emerald"
        />
        <SummaryTile
          icon={Package}
          label="Avg load value"
          value={formatCAD(avgLoadValue)}
          subtle={
            totalTax > 0
              ? `${formatCAD(totalTax)} tax collected`
              : "no tax this period"
          }
          accent="indigo"
        />
        <SummaryTile
          icon={Clock}
          label="On-time rate"
          value={
            onTimeEligible > 0
              ? formatPct(onTimeRate)
              : "—"
          }
          subtle={`${onTimeCount} / ${onTimeEligible} loads`}
          accent={
            onTimeEligible === 0
              ? "muted"
              : onTimeRate >= 0.95
                ? "emerald"
                : onTimeRate >= 0.85
                  ? "amber"
                  : "red"
          }
        />
        <SummaryTile
          icon={UserCheck}
          label="Active drivers"
          value={formatNumber(driverRows.length)}
          subtle="with loads in range"
          accent="amber"
        />
      </div>

      {/* Monthly revenue bars ------------------------------------ */}
      <section className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-brand-gold" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Revenue by month
          </h2>
          <span className="ml-auto text-xs text-muted-foreground">
            Last 12 months
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {monthlyRows.map((m) => (
            <div
              key={m.key}
              className="grid grid-cols-[64px_1fr_110px] items-center gap-3"
            >
              <span className="font-mono text-xs font-semibold text-brand-slate">
                {m.label}
              </span>
              <div className="relative h-6 overflow-hidden rounded-md bg-muted/40">
                <div
                  className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-brand-teal/70 to-brand-teal-light/80"
                  style={{
                    width: `${(m.revenue / monthlyMax) * 100}%`,
                  }}
                />
              </div>
              <span className="text-right text-sm font-medium tabular-nums">
                {m.revenue > 0 ? formatCAD(m.revenue) : "—"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by customer -------------------------------- */}
        <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-brand-gold" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Revenue by customer
            </h2>
            <span className="ml-auto text-xs text-muted-foreground">
              Top 10
            </span>
          </div>
          {customerRows.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              No revenue in this range.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="border-b border-border px-2 py-2 text-left">
                    Customer
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    Loads
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {customerRows.map((r) => (
                  <tr key={r.id}>
                    <td className="border-b border-border/50 px-2 py-2.5 font-medium">
                      {r.name}
                    </td>
                    <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                      {r.count}
                    </td>
                    <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums font-semibold">
                      {formatCAD2(r.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Revenue + on-time by driver -------------------------- */}
        <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
          <div className="flex items-center gap-2">
            <BadgeCheck className="size-4 text-brand-gold" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Revenue + on-time by driver
            </h2>
            <span className="ml-auto text-xs text-muted-foreground">
              Top 10
            </span>
          </div>
          {driverRows.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              No driver activity in this range.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="border-b border-border px-2 py-2 text-left">
                    Driver
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    Loads
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    On-time
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {driverRows.map((r) => {
                  const rate =
                    r.onTimeEligible > 0 ? r.onTime / r.onTimeEligible : null
                  return (
                    <tr key={r.id}>
                      <td className="border-b border-border/50 px-2 py-2.5 font-medium">
                        {r.name}
                      </td>
                      <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                        {r.count}
                      </td>
                      <td className="border-b border-border/50 px-2 py-2.5 text-right">
                        {rate === null ? (
                          <span className="text-xs text-muted-foreground/50">
                            —
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex rounded-md px-1.5 py-0.5 text-xs font-semibold",
                              rate >= 0.95
                                ? "bg-emerald-100 text-emerald-800"
                                : rate >= 0.85
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-900",
                            )}
                          >
                            {formatPct(rate)}
                          </span>
                        )}
                      </td>
                      <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums font-semibold">
                        {formatCAD2(r.revenue)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Lane profitability ----------------------------------- */}
      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-brand-gold" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Lane profitability
          </h2>
          <span className="ml-auto text-xs text-muted-foreground">
            Top 10 origin → destination pairs
          </span>
        </div>
        {laneRows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            No lane data in this range.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <th className="border-b border-border px-2 py-2 text-left">
                  Lane
                </th>
                <th className="border-b border-border px-2 py-2 text-right">
                  Loads
                </th>
                <th className="border-b border-border px-2 py-2 text-right">
                  Total revenue
                </th>
                <th className="border-b border-border px-2 py-2 text-right">
                  Avg per load
                </th>
              </tr>
            </thead>
            <tbody>
              {laneRows.map((r) => (
                <tr key={r.key}>
                  <td className="border-b border-border/50 px-2 py-2.5">
                    <span className="font-medium">{r.origin}</span>
                    <span className="mx-1.5 text-muted-foreground">→</span>
                    <span className="font-medium">{r.destination}</span>
                  </td>
                  <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                    {r.count}
                  </td>
                  <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums font-semibold">
                    {formatCAD2(r.revenue)}
                  </td>
                  <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                    {formatCAD2(r.revenue / r.count)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

const TILE_ACCENT: Record<
  "amber" | "indigo" | "emerald" | "red" | "muted",
  string
> = {
  amber: "text-amber-700 bg-amber-100",
  indigo: "text-indigo-700 bg-indigo-100",
  emerald: "text-emerald-700 bg-emerald-100",
  red: "text-red-700 bg-red-100",
  muted: "text-muted-foreground bg-muted",
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  subtle,
  accent,
}: {
  icon: typeof CircleDollarSign
  label: string
  value: string
  subtle: string
  accent: keyof typeof TILE_ACCENT
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-4 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
          {label}
        </span>
        <span
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-lg",
            TILE_ACCENT[accent],
          )}
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </span>
      </div>
      <span className="font-display text-2xl tracking-wide tabular-nums text-brand-navy">
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{subtle}</span>
    </div>
  )
}
