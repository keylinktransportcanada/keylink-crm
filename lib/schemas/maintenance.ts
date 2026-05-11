import { z } from "zod"

export const MAINTENANCE_SERVICE_TYPES = [
  "oil_change",
  "tire",
  "brake",
  "annual_inspection",
  "safety",
  "repair",
  "preventive",
  "other",
] as const

export type MaintenanceServiceType = (typeof MAINTENANCE_SERVICE_TYPES)[number]

export const MAINTENANCE_SERVICE_LABEL: Record<MaintenanceServiceType, string> = {
  oil_change: "Oil change",
  tire: "Tires",
  brake: "Brakes",
  annual_inspection: "Annual inspection",
  safety: "Safety / CVIP",
  repair: "Repair",
  preventive: "Preventive maintenance",
  other: "Other",
}

// Default mileage interval (km) until next service for each type — used to
// pre-fill the next-due odometer when the operator enters a current odometer.
// Operators can always override before saving.
export const MAINTENANCE_DEFAULT_KM_INTERVAL: Record<MaintenanceServiceType, number | null> = {
  oil_change: 24000,
  tire: 80000,
  brake: 60000,
  annual_inspection: null,    // calendar-driven, not mileage
  safety: null,               // calendar-driven, not mileage
  repair: null,               // ad-hoc
  preventive: 25000,
  other: null,
}

// Default time interval (days) until next service. Annual inspection / safety
// is once a year by regulation.
export const MAINTENANCE_DEFAULT_DAY_INTERVAL: Record<MaintenanceServiceType, number | null> = {
  oil_change: 365,
  tire: null,
  brake: null,
  annual_inspection: 365,
  safety: 365,
  repair: null,
  preventive: 180,
  other: null,
}

export const maintenanceFormSchema = z
  .object({
    truck_id: z.uuid(),
    service_type: z.enum(MAINTENANCE_SERVICE_TYPES),
    service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
    odometer_km: z
      .union([z.number().int().min(0), z.literal("")])
      .optional(),
    cost_cad: z
      .union([z.number().min(0), z.literal("")])
      .optional(),
    vendor: z.string().max(120).optional(),
    description: z.string().max(2000).optional(),
    next_due_date: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
      .optional(),
    next_due_odometer_km: z
      .union([z.number().int().min(0), z.literal("")])
      .optional(),
  })
  .strip()

export type MaintenanceFormInput = z.infer<typeof maintenanceFormSchema>

export type MaintenanceDueStatus = "ok" | "warning" | "due" | "overdue"

// Picks the worst severity across all maintenance records for a single truck.
export function maintenanceDueStatusFor({
  today,
  currentOdometerKm,
  records,
}: {
  today: string
  currentOdometerKm: number | null
  records: Array<{
    next_due_date: string | null
    next_due_odometer_km: number | null
  }>
}): MaintenanceDueStatus {
  let worst: MaintenanceDueStatus = "ok"
  const rank: Record<MaintenanceDueStatus, number> = {
    ok: 0,
    warning: 1,
    due: 2,
    overdue: 3,
  }
  const elevate = (s: MaintenanceDueStatus) => {
    if (rank[s] > rank[worst]) worst = s
  }

  for (const r of records) {
    if (r.next_due_date) {
      const daysOut = daysBetweenISO(today, r.next_due_date)
      if (daysOut < 0) elevate("overdue")
      else if (daysOut <= 7) elevate("due")
      else if (daysOut <= 30) elevate("warning")
    }
    if (r.next_due_odometer_km !== null && currentOdometerKm !== null) {
      const kmOut = r.next_due_odometer_km - currentOdometerKm
      if (kmOut < 0) elevate("overdue")
      else if (kmOut <= 1000) elevate("due")
      else if (kmOut <= 5000) elevate("warning")
    }
  }
  return worst
}

function daysBetweenISO(today: string, when: string): number {
  const a = new Date(`${today}T12:00:00Z`).getTime()
  const b = new Date(`${when}T12:00:00Z`).getTime()
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}
