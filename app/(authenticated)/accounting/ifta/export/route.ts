import { NextResponse, type NextRequest } from "next/server"

import { requireRole } from "@/lib/auth"
import { CA_PROVINCES, US_STATES } from "@/lib/regions"
import { createClient } from "@/lib/supabase/server"

// Returns a per-jurisdiction CSV for the requested quarter. Two-row header
// (column titles + units), then one row per jurisdiction with km / litres /
// fuel cost — the format a bookkeeper feeds into their IFTA filing system.
//
// URL: /accounting/ifta/export?year=2026&quarter=2

const JURISDICTION_NAME = new Map<string, string>([
  ...CA_PROVINCES.map((r) => [r.code, r.name] as const),
  ...US_STATES.map((r) => [r.code, r.name] as const),
])

function quarterRange(year: number, quarter: 1 | 2 | 3 | 4): {
  start: string
  end: string
} {
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = startMonth + 2
  const start = `${year}-${String(startMonth).padStart(2, "0")}-01`
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate()
  const end = `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  return { start, end }
}

function csvEscape(v: string | number): string {
  const s = String(v)
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(request: NextRequest) {
  await requireRole(["admin", "accounting", "dispatcher"])
  const { searchParams } = new URL(request.url)
  const now = new Date()
  const year = Math.max(
    2020,
    parseInt(searchParams.get("year") ?? "", 10) || now.getUTCFullYear(),
  )
  const rawQ =
    parseInt(searchParams.get("quarter") ?? "", 10) ||
    Math.floor(now.getUTCMonth() / 3) + 1
  const quarter = (rawQ >= 1 && rawQ <= 4 ? rawQ : 1) as 1 | 2 | 3 | 4
  const { start, end } = quarterRange(year, quarter)

  const supabase = await createClient()
  const [{ data: fuel }, { data: distances }] = await Promise.all([
    supabase
      .from("fuel_records")
      .select("jurisdiction, litres, total_cad")
      .gte("purchase_date", start)
      .lte("purchase_date", end),
    supabase
      .from("trip_distances")
      .select("jurisdiction, distance_km, loads!inner(delivery_date)")
      .gte("loads.delivery_date", start)
      .lte("loads.delivery_date", end),
  ])

  // Aggregate per jurisdiction.
  const agg = new Map<string, { litres: number; cost: number; km: number }>()
  for (const f of fuel ?? []) {
    const e = agg.get(f.jurisdiction) ?? { litres: 0, cost: 0, km: 0 }
    e.litres += Number(f.litres ?? 0)
    e.cost += Number(f.total_cad ?? 0)
    agg.set(f.jurisdiction, e)
  }
  for (const d of distances ?? []) {
    const e = agg.get(d.jurisdiction) ?? { litres: 0, cost: 0, km: 0 }
    e.km += Number(d.distance_km ?? 0)
    agg.set(d.jurisdiction, e)
  }

  const rows = Array.from(agg.entries())
    .map(([code, v]) => ({
      code,
      name: JURISDICTION_NAME.get(code) ?? code,
      ...v,
    }))
    .sort((a, b) => a.code.localeCompare(b.code))

  const header = [
    "Jurisdiction code",
    "Jurisdiction name",
    "Kilometres",
    "Litres",
    "Fuel cost (CAD)",
  ]
  const lines: string[] = []
  lines.push(`# Keylink Transport — IFTA ${year} Q${quarter}`)
  lines.push(`# Period: ${start} → ${end}`)
  lines.push(`# Exported: ${new Date().toISOString()}`)
  lines.push(header.join(","))
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.code),
        csvEscape(r.name),
        csvEscape(r.km.toFixed(2)),
        csvEscape(r.litres.toFixed(3)),
        csvEscape(r.cost.toFixed(2)),
      ].join(","),
    )
  }
  // Totals row
  const totalKm = rows.reduce((s, r) => s + r.km, 0)
  const totalL = rows.reduce((s, r) => s + r.litres, 0)
  const totalC = rows.reduce((s, r) => s + r.cost, 0)
  lines.push(
    [
      "TOTAL",
      "",
      csvEscape(totalKm.toFixed(2)),
      csvEscape(totalL.toFixed(3)),
      csvEscape(totalC.toFixed(2)),
    ].join(","),
  )

  const body = lines.join("\n") + "\n"
  const filename = `keylink-ifta-${year}-q${quarter}.csv`

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
