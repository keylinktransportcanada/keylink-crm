import { z } from "zod"

export const DOCUMENT_TYPE_VALUES = [
  "bol",
  "pod",
  "invoice",
  "rate_con",
  "customs",
  "cci",
  "inspection",
  "maintenance",
  "driver_licence",
  "medical",
  "fast_card",
  "insurance",
  "registration",
  "other",
] as const

export type DocumentType = (typeof DOCUMENT_TYPE_VALUES)[number]

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  bol: "Bill of Lading",
  pod: "Proof of Delivery",
  invoice: "Invoice",
  rate_con: "Rate confirmation",
  customs: "Customs",
  cci: "Canada Customs Invoice",
  inspection: "Inspection",
  maintenance: "Maintenance",
  driver_licence: "Driver licence",
  medical: "Medical",
  fast_card: "FAST card",
  insurance: "Insurance",
  registration: "Registration",
  other: "Other",
}

// Types most relevant when attaching documents to a load. Keeps the type
// dropdown in the load form short — driver/truck-specific docs live elsewhere.
export const LOAD_DOCUMENT_TYPES: DocumentType[] = [
  "bol",
  "pod",
  "rate_con",
  "customs",
  "cci",
  "invoice",
  "other",
]

// Compliance docs we expect to see on a truck — anything with an expiry the
// roadside officer will ask for.
export const TRUCK_DOCUMENT_TYPES: DocumentType[] = [
  "insurance",
  "registration",
  "inspection",
  "maintenance",
  "other",
]

// Personal compliance docs the driver carries.
export const DRIVER_DOCUMENT_TYPES: DocumentType[] = [
  "driver_licence",
  "medical",
  "fast_card",
  "other",
]

// Trailer paperwork — registration + inspection are the big ones.
export const TRAILER_DOCUMENT_TYPES: DocumentType[] = [
  "registration",
  "inspection",
  "other",
]

// Scopes where attaching an expiry date is meaningful (vs. a load BOL where
// the doc just records the trip). Drives whether the expiry picker appears.
export const EXPIRY_BEARING_TYPES: DocumentType[] = [
  "insurance",
  "registration",
  "inspection",
  "driver_licence",
  "medical",
  "fast_card",
]

// Types whose preview thumbnail is a useful glance (rendered as <img>).
// Anything else gets the generic file icon in the UI.
export const PREVIEWABLE_MIME_PREFIXES = ["image/"]

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024  // 25 MiB — matches bucket cap.

export const documentMetaSchema = z.object({
  load_id: z.uuid(),
  type: z.enum(DOCUMENT_TYPE_VALUES),
})

export type DocumentMetaInput = z.infer<typeof documentMetaSchema>
