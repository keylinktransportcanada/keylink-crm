import { z } from "zod"

import { CA_PROVINCES, US_STATES } from "@/lib/regions"

// Allowed jurisdiction codes — Canadian provinces + US states. Mexican states
// are excluded because Mexico isn't an IFTA jurisdiction; if Keylink ever
// runs MX freight, fuel/distance there is tracked separately for state tax.
const JURISDICTION_CODES = [
  ...CA_PROVINCES.map((r) => r.code),
  ...US_STATES.map((r) => r.code),
] as [string, ...string[]]

export const fuelRecordSchema = z.object({
  truck_id: z.uuid({ message: "Pick a truck." }),
  // null = "unassigned". The dialog converts the "_none" sentinel to null
  // before submit; the action treats null as no driver.
  driver_id: z.uuid({ message: "Invalid driver." }).nullable(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Use YYYY-MM-DD.",
  }),
  jurisdiction: z.enum(JURISDICTION_CODES, {
    message: "Pick a jurisdiction.",
  }),
  litres: z
    .number({ message: "Must be a number." })
    .gt(0, { message: "Litres must be greater than 0." })
    .max(10_000),
  total_cad: z
    .number({ message: "Must be a number." })
    .min(0)
    .max(100_000),
  odometer_km: z
    .number({ message: "Must be a number." })
    .int()
    .min(0)
    .max(10_000_000)
    .nullable(),
  vendor: z.string().max(120),
})

export type FuelRecordInput = z.infer<typeof fuelRecordSchema>

export const tripDistanceSchema = z.object({
  load_id: z.uuid({ message: "Pick a load." }),
  jurisdiction: z.enum(JURISDICTION_CODES, {
    message: "Pick a jurisdiction.",
  }),
  distance_km: z
    .number({ message: "Must be a number." })
    .gt(0, { message: "Distance must be greater than 0." })
    .max(20_000),
})

export type TripDistanceInput = z.infer<typeof tripDistanceSchema>
