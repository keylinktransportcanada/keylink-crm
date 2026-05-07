import { z } from "zod"

export const LOAD_STATUS_VALUES = [
  "draft",
  "assigned",
  "dispatched",
  "at_pickup",
  "loaded",
  "in_transit",
  "at_delivery",
  "delivered",
  "invoiced",
  "paid",
  "cancelled",
] as const

export const LOAD_STATUS_LABEL: Record<
  (typeof LOAD_STATUS_VALUES)[number],
  string
> = {
  draft: "Draft",
  assigned: "Assigned",
  dispatched: "Dispatched",
  at_pickup: "At pickup",
  loaded: "Loaded",
  in_transit: "In transit",
  at_delivery: "At delivery",
  delivered: "Delivered",
  invoiced: "Invoiced",
  paid: "Paid",
  cancelled: "Cancelled",
}

export const LOAD_TYPE_VALUES = ["ftl", "ltl", "partial"] as const
export const LOAD_TYPE_LABEL: Record<(typeof LOAD_TYPE_VALUES)[number], string> = {
  ftl: "FTL — Full truckload",
  ltl: "LTL — Less than truckload",
  partial: "Partial",
}

export const LOAD_CURRENCY_VALUES = ["CAD", "USD"] as const

export const EQUIPMENT_REQUIRED_VALUES = [
  "none",
  "refrigeration",
  "hazmat",
  "tarps",
  "oversize",
] as const

export const EQUIPMENT_REQUIRED_LABEL: Record<
  (typeof EQUIPMENT_REQUIRED_VALUES)[number],
  string
> = {
  none: "None",
  refrigeration: "Refrigeration",
  hazmat: "Hazmat",
  tarps: "Tarps",
  oversize: "Oversize",
}

const optStr = (max = 200) => z.string().max(max)

const moneyOptional = z
  .number({ message: "Must be a number." })
  .min(0)
  .max(10_000_000)
  .nullable()

export const loadSchema = z.object({
  customer_id: z.uuid({ message: "Pick a customer." }),
  driver_id: z.uuid().nullable(),
  truck_id: z.uuid().nullable(),
  trailer_id: z.uuid().nullable(),

  reference_number: optStr(80),
  po_number: optStr(80),

  origin_company: optStr(120),
  origin_address: optStr(200),
  origin_city: optStr(80),
  origin_province: optStr(40),
  origin_country: z.string().max(40),

  destination_company: optStr(120),
  destination_address: optStr(200),
  destination_city: optStr(80),
  destination_province: optStr(40),
  destination_country: z.string().max(40),

  // Dates as YYYY-MM-DD strings or empty.
  pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$|^$/, {
    message: "Use YYYY-MM-DD.",
  }),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$|^$/, {
    message: "Use YYYY-MM-DD.",
  }),

  load_type: z.enum(LOAD_TYPE_VALUES),
  commodity: optStr(200),
  weight_kg: z.number().min(0).max(100_000).nullable(),
  pieces: z.number().int().min(0).max(100_000).nullable(),
  equipment_required: z.enum(EQUIPMENT_REQUIRED_VALUES),

  // Money fields are entered in `currency`. Server action converts to CAD
  // via the FX rate of the day before insert/update.
  currency: z.enum(LOAD_CURRENCY_VALUES),
  rate: moneyOptional,
  fuel_surcharge: moneyOptional,
  accessorial_charges: moneyOptional,

  is_cross_border: z.boolean(),
  customs_broker: optStr(120),
  pars_pass_number: optStr(80),
  aci_aces_number: optStr(80),

  notes: optStr(2000),
  internal_notes: optStr(2000),
})

export type LoadInput = z.infer<typeof loadSchema>

export const updateLoadSchema = loadSchema.extend({
  id: z.uuid({ message: "Invalid load id." }),
})

export type UpdateLoadInput = z.infer<typeof updateLoadSchema>

export const transitionStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(LOAD_STATUS_VALUES),
  location_note: z.string().max(400).optional().or(z.literal("")),
})

export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>
