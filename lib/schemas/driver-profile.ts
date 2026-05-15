import { z } from "zod"

const optStr = (max = 200) => z.string().max(max)
const optDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$|^$/, { message: "Use YYYY-MM-DD." })

// Compliance fields admin/dispatcher edit. Driver self-edit goes through a
// separate, narrower schema below.
export const driverProfileSchema = z.object({
  profile_id: z.uuid(),

  licence_number: optStr(40),
  licence_class: optStr(8),
  licence_province: optStr(8),
  licence_expiry: optDate,

  medical_cert_expiry: optDate,

  fast_card_number: optStr(40),
  fast_card_expiry: optDate,

  abstract_last_pulled: optDate,

  emergency_contact_name: optStr(120),
  emergency_contact_phone: optStr(40),

  hire_date: optDate,
  notes: optStr(2000),

  // Pay configuration. Mirrors the DB enum on driver_profiles.
  pay_method: z.enum(["percent_revenue", "flat_per_load", "per_km"]),
  pay_rate: z
    .number()
    .nonnegative({ message: "Rate must be 0 or more." })
    .max(999999, { message: "Rate is unreasonably large." }),
})

export type DriverProfileInput = z.infer<typeof driverProfileSchema>

export const PAY_METHOD_LABEL: Record<
  DriverProfileInput["pay_method"],
  string
> = {
  percent_revenue: "% of load revenue",
  flat_per_load: "Flat $ per load",
  per_km: "$ per kilometre",
}

// Format helpers for the UI so the input/value flips its meaning per method.
export function formatPayRate(
  method: DriverProfileInput["pay_method"],
  rate: number,
): string {
  if (method === "percent_revenue") return `${(rate * 100).toFixed(1)}%`
  if (method === "per_km") return `$${rate.toFixed(2)} / km`
  return `$${rate.toFixed(2)} / load`
}

// Driver-facing self-edit: only emergency contact fields. Mirrors the DB
// trigger guard.
export const driverEmergencyContactSchema = z.object({
  emergency_contact_name: optStr(120),
  emergency_contact_phone: optStr(40),
})

export type DriverEmergencyContactInput = z.infer<
  typeof driverEmergencyContactSchema
>

// Licence classes that show up on the dropdown — covers the common
// commercial classes across Canadian provinces. Driver can also leave blank.
export const LICENCE_CLASSES = [
  "1",
  "1A",
  "2",
  "3",
  "4",
  "AZ",
  "DZ",
  "BZ",
  "Other",
] as const
