import { z } from "zod"

export const EQUIPMENT_STATUS_VALUES = [
  "active",
  "maintenance",
  "out_of_service",
  "retired",
] as const

export const EQUIPMENT_STATUS_LABEL: Record<
  (typeof EQUIPMENT_STATUS_VALUES)[number],
  string
> = {
  active: "Active",
  maintenance: "In maintenance",
  out_of_service: "Out of service",
  retired: "Retired",
}

export const TRAILER_TYPE_VALUES = [
  "dry_van",
  "reefer",
  "flatbed",
  "step_deck",
  "tank",
  "other",
] as const

export const TRAILER_TYPE_LABEL: Record<
  (typeof TRAILER_TYPE_VALUES)[number],
  string
> = {
  dry_van: "Dry van",
  reefer: "Reefer",
  flatbed: "Flatbed",
  step_deck: "Step deck",
  tank: "Tank",
  other: "Other",
}

const currentYear = new Date().getFullYear()

const dateOrEmpty = z.string().regex(/^\d{4}-\d{2}-\d{2}$|^$/, {
  message: "Use YYYY-MM-DD.",
})

export const truckSchema = z.object({
  truck_number: z
    .string()
    .min(1, { message: "Truck number is required." })
    .max(40),
  make: z.string().max(60),
  model: z.string().max(60),
  year: z
    .number({ message: "Must be a number." })
    .int()
    .min(1980)
    .max(currentYear + 2)
    .nullable(),
  status: z.enum(EQUIPMENT_STATUS_VALUES),

  // Identity / registration
  plate: z.string().max(20),
  plate_province: z.string().max(40),
  plate_expiry: dateOrEmpty,
  vin: z.string().max(40),
  current_odometer_km: z
    .number({ message: "Must be a number." })
    .int()
    .min(0)
    .max(10_000_000)
    .nullable(),

  // Compliance
  insurance_policy: z.string().max(80),
  insurance_expiry: dateOrEmpty,
  ifta_decal_year: z
    .number({ message: "Must be a number." })
    .int()
    .min(2000)
    .max(currentYear + 2)
    .nullable(),
  ifta_decal_expiry: dateOrEmpty,
  safety_sticker_expiry: dateOrEmpty,
  cvor_certificate_expiry: dateOrEmpty,

  notes: z.string().max(2000),
})

export type TruckInput = z.infer<typeof truckSchema>

export const updateTruckSchema = truckSchema.extend({
  id: z.uuid({ message: "Invalid truck id." }),
})

export type UpdateTruckInput = z.infer<typeof updateTruckSchema>

export const trailerSchema = z.object({
  trailer_number: z
    .string()
    .min(1, { message: "Trailer number is required." })
    .max(40),
  type: z.enum(TRAILER_TYPE_VALUES),
  status: z.enum(EQUIPMENT_STATUS_VALUES),

  plate: z.string().max(20),
  plate_province: z.string().max(40),
  plate_expiry: dateOrEmpty,
  vin: z.string().max(40),
  last_inspection_date: dateOrEmpty,
  next_inspection_due: dateOrEmpty,

  notes: z.string().max(2000),
})

export type TrailerInput = z.infer<typeof trailerSchema>

export const updateTrailerSchema = trailerSchema.extend({
  id: z.uuid({ message: "Invalid trailer id." }),
})

export type UpdateTrailerInput = z.infer<typeof updateTrailerSchema>
