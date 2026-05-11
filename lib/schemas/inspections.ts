import { z } from "zod"

export const INSPECTION_TYPE_VALUES = [
  "pre_trip",
  "post_trip",
  "en_route",
] as const

export const INSPECTION_TYPE_LABEL: Record<
  (typeof INSPECTION_TYPE_VALUES)[number],
  string
> = {
  pre_trip: "Pre-trip",
  post_trip: "Post-trip",
  en_route: "En route",
}

export const INSPECTION_SEVERITY_VALUES = ["none", "minor", "major"] as const

export const INSPECTION_SEVERITY_LABEL: Record<
  (typeof INSPECTION_SEVERITY_VALUES)[number],
  string
> = {
  none: "No defects",
  minor: "Minor defect",
  major: "Major defect",
}

export const INSPECTION_SEVERITY_HINT: Record<
  (typeof INSPECTION_SEVERITY_VALUES)[number],
  string
> = {
  none: "Truck looked clean — safe to roll.",
  minor: "Defect noted but vehicle is roadworthy. Schedule a fix.",
  major: "Truck must not be operated. Auto-flips to out-of-service.",
}

export const inspectionSchema = z
  .object({
    truck_id: z.uuid({ message: "Pick the truck you're inspecting." }),
    trailer_id: z.uuid().nullable(),
    load_id: z.uuid().nullable(),
    inspection_type: z.enum(INSPECTION_TYPE_VALUES),
    severity: z.enum(INSPECTION_SEVERITY_VALUES),
    defects_description: z.string().max(2000).optional().or(z.literal("")),
    notes: z.string().max(2000).optional().or(z.literal("")),
    signed_by_driver: z.boolean(),
  })
  .refine(
    (v) => v.severity === "none" || (v.defects_description ?? "").trim().length > 0,
    {
      path: ["defects_description"],
      message: "Describe the defect when severity is minor or major.",
    },
  )
  .refine((v) => v.signed_by_driver, {
    path: ["signed_by_driver"],
    message: "You must sign the inspection.",
  })

export type InspectionInput = z.infer<typeof inspectionSchema>
