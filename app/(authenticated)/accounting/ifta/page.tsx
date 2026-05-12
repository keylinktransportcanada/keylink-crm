import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ChevronLeft, Download, Fuel, MapPinned } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { CA_PROVINCES, US_STATES } from "@/lib/regions"
import { cn } from "@/lib/utils"

import {
  AddFuelButton,
  AddDistanceButton,
  DeleteFuelButton,
  DeleteDistanceButton,
} from "./client-actions"

const formatCAD = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 2,
      }).format(value)

const formatNum = (value: number, decimals = 0) =>
  new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)

const formatDate = (iso: string | null) => {
  if (!iso) return "—"
  try {
    return format(parseISO(iso), "PP")
  } catch {
    return iso
  }
}

const JURISDICTION_NAME = new Map<string, string>([
  ...CA_PROVINCES.map((r) => [r.code, r.name] as const),
  ...US_STATES.map((r) => [r.code, r.name] as const),
])

function currentQuarter(): { year: number; quarter: 1 | 2 | 3 | 4 } {
  const now = new Date()
  const year = now.getUTCFullYear()
  const quarter = (Math.floor(now.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4
  return { year, quarter }
}

function quarterRange(year: number, quarter: 1 | 2 | 3 | 4): {
  start: string
  end: string
} {
  const startMonth = (quarter - 1) * 3 + 1 // 1, 4, 7, 10
  const endMonth = startMonth + 2 // 3, 6, 9, 12
  const start = `${year}-${String(startMonth).padStart(2, "0")}-01`
  // Last day of endMonth: pick month+1 day 0
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate()
  const end = `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  return { start, end }
}

const QUARTER_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: "Q1 (Jan – Mar)",
  2: "Q2 (Apr – Jun)",
  3: "Q3 (Jul – Sep)",
  4: "Q4 (Oct – Dec)",
}

const QUARTER_DEADLINE: Record<1 | 2 | 3 | 4, string> = {
  1: "Apr 30",
  2: "Jul 31",
  3: "Oct 31",
  4: "Jan 31",
}

export default async function IftaPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string }>
}) {
  await requireRole(["admin", "accounting", "dispatcher"])
  const sp = await searchParams
  const current = currentQuarter()
  const year = Math.max(2020, parseInt(sp.year ?? "", 10) || current.year)
  const rawQ = parseInt(sp.quarter ?? "", 10) || current.quarter
  const quarter = (rawQ >= 1 && rawQ <= 4 ? rawQ : current.quarter) as
    | 1
    | 2
    | 3
    | 4
  const { start, end } = quarterRange(year, quarter)

  const supabase = await createClient()

  const [
    { data: fuelRows },
    { data: distanceRows },
    { data: trucks },
    { data: drivers },
    { data: loadsForPicker },
  ] = await Promise.all([
    supabase
      .from("fuel_records")
      .select(
        "id, truck_id, driver_id, purchase_date, jurisdiction, litres, total_cad, odometer_km, vendor",
      )
      .gte("purchase_date", start)
      .lte("purchase_date", end)
      .order("purchase_date", { ascending: false }),
    supabase
      .from("trip_distances")
      .select(
        "id, load_id, truck_id, jurisdiction, distance_km, entered_at, loads!inner(load_number, delivery_date)",
      )
      .gte("loads.delivery_date", start)
      .lte("loads.delivery_date", end)
      .order("entered_at", { ascending: false }),
    supabase
      .from("trucks")
      .select("id, truck_number")
      .neq("status", "retired")
      .order("truck_number"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "driver")
      .eq("active", true)
      .order("full_name"),
    // Loads that could have a distance entry — anything delivered in this
    // quarter, plus active loads in case the dispatcher is filing on the fly.
    supabase
      .from("loads")
      .select("id, load_number, delivery_date, truck_id")
      .or(
        `delivery_date.gte.${start},delivery_date.lte.${end},status.eq.in_transit,status.eq.at_delivery`,
      )
      .order("delivery_date", { ascending: false })
      .limit(200),
  ])

  type DistanceRow = {
    id: string
    load_id: string
    truck_id: string | null
    jurisdiction: string
    distance_km: number | string
    entered_at: string
    loads:
      | { load_number: string; delivery_date: string | null }
      | { load_number: string; delivery_date: string | null }[]
      | null
  }

  // Aggregate per jurisdiction.
  const summary = new Map<
    string,
    { litres: number; cost: number; km: number }
  >()
  for (const f of fuelRows ?? []) {
    const entry =
      summary.get(f.jurisdiction) ?? { litres: 0, cost: 0, km: 0 }
    entry.litres += Number(f.litres ?? 0)
    entry.cost += Number(f.total_cad ?? 0)
    summary.set(f.jurisdiction, entry)
  }
  for (const d of (distanceRows ?? []) as DistanceRow[]) {
    const entry =
      summary.get(d.jurisdiction) ?? { litres: 0, cost: 0, km: 0 }
    entry.km += Number(d.distance_km ?? 0)
    summary.set(d.jurisdiction, entry)
  }
  const summaryRows = Array.from(summary.entries())
    .map(([code, v]) => ({
      code,
      name: JURISDICTION_NAME.get(code) ?? code,
      ...v,
    }))
    .sort((a, b) => b.km - a.km || b.litres - a.litres)

  const totalLitres = summaryRows.reduce((s, r) => s + r.litres, 0)
  const totalCost = summaryRows.reduce((s, r) => s + r.cost, 0)
  const totalKm = summaryRows.reduce((s, r) => s + r.km, 0)

  const truckById = new Map(
    (trucks ?? []).map((t) => [t.id, t.truck_number] as const),
  )
  const driverById = new Map(
    (drivers ?? []).map((d) => [d.id, d.full_name ?? "Unnamed"] as const),
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/accounting"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to accounting
        </Link>
      </div>

      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <span className="size-1.5 rounded-full bg-brand-gold" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-gold">
            IFTA quarterly
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-4xl uppercase tracking-wide text-brand-navy lg:text-5xl">
            {year} · {QUARTER_LABEL[quarter]}
          </h1>
          <p className="text-sm text-muted-foreground">
            Fuel by jurisdiction and kilometres by jurisdiction for the
            current filing period. Filing deadline:{" "}
            <span className="font-semibold text-foreground">
              {QUARTER_DEADLINE[quarter]}
              {quarter === 4 ? ` ${year + 1}` : ` ${year}`}
            </span>
            .
          </p>
        </div>
      </header>

      {/* Quarter picker + CSV download ------------------------------- */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
          Quarter
        </span>
        <div className="flex flex-wrap gap-1.5">
          {([1, 2, 3, 4] as const).map((q) => {
            const active = q === quarter
            return (
              <Link
                key={q}
                href={`/accounting/ifta?year=${year}&quarter=${q}`}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  active
                    ? "bg-brand-navy text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                Q{q}
              </Link>
            )
          })}
        </div>
        <div className="flex gap-1.5">
          {[year - 1, year, year + 1].map((y) => (
            <Link
              key={y}
              href={`/accounting/ifta?year=${y}&quarter=${quarter}`}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors",
                y === year
                  ? "bg-brand-navy text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              {y}
            </Link>
          ))}
        </div>
        <a
          href={`/accounting/ifta/export?year=${year}&quarter=${quarter}`}
          className={cn(
            buttonVariants({ size: "sm" }),
            "ml-auto bg-brand-gold text-brand-navy hover:bg-brand-gold/85",
          )}
        >
          <Download />
          Download CSV
        </a>
      </div>

      {/* Per-jurisdiction summary ----------------------------------- */}
      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPinned className="size-4 text-brand-gold" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Per-jurisdiction summary
            </h2>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {summaryRows.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {start} → {end}
          </p>
        </div>
        {summaryRows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            No fuel or distance entries for this quarter yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="border-b border-border px-2 py-2 text-left">
                    Jurisdiction
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    Kilometres
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    Litres
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    Fuel cost (CAD)
                  </th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((r) => (
                  <tr key={r.code}>
                    <td className="border-b border-border/50 px-2 py-2.5">
                      <span className="font-mono text-xs font-semibold">
                        {r.code}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {r.name}
                      </span>
                    </td>
                    <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums">
                      {r.km > 0 ? (
                        formatNum(r.km)
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums">
                      {r.litres > 0 ? (
                        formatNum(r.litres, 1)
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums">
                      {r.cost > 0 ? (
                        formatCAD(r.cost)
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-semibold">
                  <td className="px-2 py-2.5">Totals</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {formatNum(totalKm)}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {formatNum(totalLitres, 1)}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {formatCAD(totalCost)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Fuel entries ----------------------------------------------- */}
      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fuel className="size-4 text-brand-gold" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Fuel entries
            </h2>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {(fuelRows ?? []).length}
            </span>
          </div>
          <AddFuelButton
            trucks={trucks ?? []}
            drivers={drivers ?? []}
          />
        </div>
        {(fuelRows ?? []).length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            No fuel purchases recorded for this quarter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="border-b border-border px-2 py-2 text-left">
                    Date
                  </th>
                  <th className="border-b border-border px-2 py-2 text-left">
                    Jurisdiction
                  </th>
                  <th className="border-b border-border px-2 py-2 text-left">
                    Truck
                  </th>
                  <th className="border-b border-border px-2 py-2 text-left">
                    Driver
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    Litres
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    Total (CAD)
                  </th>
                  <th className="border-b border-border px-2 py-2 text-left">
                    Vendor
                  </th>
                  <th className="border-b border-border px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {(fuelRows ?? []).map((f) => (
                  <tr key={f.id}>
                    <td className="border-b border-border/50 px-2 py-2.5 tabular-nums">
                      {formatDate(f.purchase_date)}
                    </td>
                    <td className="border-b border-border/50 px-2 py-2.5">
                      <span className="font-mono text-xs font-semibold">
                        {f.jurisdiction}
                      </span>
                    </td>
                    <td className="border-b border-border/50 px-2 py-2.5 font-mono text-xs">
                      {truckById.get(f.truck_id) ?? "—"}
                    </td>
                    <td className="border-b border-border/50 px-2 py-2.5 text-xs">
                      {f.driver_id ? driverById.get(f.driver_id) ?? "—" : "—"}
                    </td>
                    <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums">
                      {formatNum(Number(f.litres ?? 0), 1)}
                    </td>
                    <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums">
                      {formatCAD(Number(f.total_cad ?? 0))}
                    </td>
                    <td className="border-b border-border/50 px-2 py-2.5 text-xs">
                      {f.vendor ?? (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="border-b border-border/50 px-2 py-2.5 text-right">
                      <DeleteFuelButton id={f.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Trip distances --------------------------------------------- */}
      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPinned className="size-4 text-brand-gold" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Trip distances
            </h2>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {(distanceRows ?? []).length}
            </span>
          </div>
          <AddDistanceButton loads={loadsForPicker ?? []} />
        </div>
        {(distanceRows ?? []).length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            No trip distances recorded for loads delivered this quarter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="border-b border-border px-2 py-2 text-left">
                    Load
                  </th>
                  <th className="border-b border-border px-2 py-2 text-left">
                    Delivered
                  </th>
                  <th className="border-b border-border px-2 py-2 text-left">
                    Truck
                  </th>
                  <th className="border-b border-border px-2 py-2 text-left">
                    Jurisdiction
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    km
                  </th>
                  <th className="border-b border-border px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {((distanceRows ?? []) as DistanceRow[]).map((d) => {
                  const load = Array.isArray(d.loads) ? d.loads[0] : d.loads
                  return (
                    <tr key={d.id}>
                      <td className="border-b border-border/50 px-2 py-2.5">
                        <Link
                          href={`/loads/${d.load_id}`}
                          className="font-mono text-xs font-medium hover:underline"
                        >
                          {load?.load_number ?? "—"}
                        </Link>
                      </td>
                      <td className="border-b border-border/50 px-2 py-2.5 tabular-nums text-xs">
                        {formatDate(load?.delivery_date ?? null)}
                      </td>
                      <td className="border-b border-border/50 px-2 py-2.5 font-mono text-xs">
                        {d.truck_id ? truckById.get(d.truck_id) ?? "—" : "—"}
                      </td>
                      <td className="border-b border-border/50 px-2 py-2.5">
                        <span className="font-mono text-xs font-semibold">
                          {d.jurisdiction}
                        </span>
                      </td>
                      <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums">
                        {formatNum(Number(d.distance_km ?? 0))}
                      </td>
                      <td className="border-b border-border/50 px-2 py-2.5 text-right">
                        <DeleteDistanceButton id={d.id} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
