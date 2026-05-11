import { todayInToronto } from "@/lib/expiry"
import type { LoadFormOptions } from "@/app/(authenticated)/loads/load-form"
import type { createClient } from "@/lib/supabase/server"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// Joins each truck row with its most-severe maintenance warning so the load
// form can surface a "this truck is overdue for service" hint inline. Returns
// the same shape `LoadFormOptions["trucks"]` expects.
export async function trucksWithMaintenanceWarnings(
  supabase: SupabaseServerClient,
  trucks: Array<{ id: string; truck_number: string }>,
): Promise<LoadFormOptions["trucks"]> {
  if (trucks.length === 0) return []

  const today = todayInToronto()

  // Pull every record with a next-due target across the listed trucks.
  const { data } = await supabase
    .from("maintenance_records")
    .select(
      `truck_id, service_type, next_due_date, next_due_odometer_km,
       trucks:trucks(current_odometer_km)`,
    )
    .in("truck_id", trucks.map((t) => t.id))

  type Row = {
    truck_id: string
    service_type: string
    next_due_date: string | null
    next_due_odometer_km: number | null
    trucks:
      | { current_odometer_km: number | null }
      | { current_odometer_km: number | null }[]
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

  type Severity = "overdue" | "due" | "warning"
  const RANK: Record<Severity, number> = { warning: 1, due: 2, overdue: 3 }

  const worstByTruck = new Map<
    string,
    { severity: Severity; label: string }
  >()

  for (const row of (data ?? []) as Row[]) {
    const truck = Array.isArray(row.trucks) ? row.trucks[0] : row.trucks
    let severity: Severity | null = null
    let label = ""

    if (row.next_due_date) {
      const days = daysBetweenISO(today, row.next_due_date)
      if (days < 0) {
        severity = "overdue"
        label = `${SERVICE_LABEL[row.service_type] ?? "Service"} overdue by ${Math.abs(days)}d`
      } else if (days <= 7) {
        severity = "due"
        label = `${SERVICE_LABEL[row.service_type] ?? "Service"} due in ${days}d`
      } else if (days <= 30) {
        severity = "warning"
        label = `${SERVICE_LABEL[row.service_type] ?? "Service"} coming up in ${days}d`
      }
    }
    if (
      row.next_due_odometer_km !== null &&
      truck?.current_odometer_km !== null &&
      truck?.current_odometer_km !== undefined
    ) {
      const remaining = row.next_due_odometer_km - truck.current_odometer_km
      let kmSev: Severity | null = null
      let kmLabel = ""
      if (remaining < 0) {
        kmSev = "overdue"
        kmLabel = `${SERVICE_LABEL[row.service_type] ?? "Service"} ${Math.abs(remaining).toLocaleString()} km overdue`
      } else if (remaining <= 1000) {
        kmSev = "due"
        kmLabel = `${SERVICE_LABEL[row.service_type] ?? "Service"} due within ${remaining.toLocaleString()} km`
      } else if (remaining <= 5000) {
        kmSev = "warning"
        kmLabel = `${SERVICE_LABEL[row.service_type] ?? "Service"} due within ${remaining.toLocaleString()} km`
      }
      if (kmSev && (severity === null || RANK[kmSev] > RANK[severity])) {
        severity = kmSev
        label = kmLabel
      }
    }
    if (!severity) continue

    const existing = worstByTruck.get(row.truck_id)
    if (!existing || RANK[severity] > RANK[existing.severity]) {
      worstByTruck.set(row.truck_id, { severity, label })
    }
  }

  return trucks.map((t) => ({
    id: t.id,
    truck_number: t.truck_number,
    maintenanceWarning: worstByTruck.get(t.id) ?? null,
  }))
}

function daysBetweenISO(today: string, when: string): number {
  const a = new Date(`${today}T12:00:00Z`).getTime()
  const b = new Date(`${when}T12:00:00Z`).getTime()
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}
