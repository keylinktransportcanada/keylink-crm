import { z } from "zod"

// ---------------------------------------------------------------------------
// Pay methods + adjustment kinds — mirror the Postgres enums on driver_profiles
// and driver_settlement_adjustments. Kept here so client forms can typecheck
// against the same source of truth.
// ---------------------------------------------------------------------------
export const PAY_METHODS = [
  "percent_revenue",
  "flat_per_load",
  "per_km",
] as const
export type PayMethod = (typeof PAY_METHODS)[number]

export const ADJUSTMENT_KINDS = [
  "bonus",
  "deduction",
  "reimbursement",
  "advance",
] as const
export type AdjustmentKind = (typeof ADJUSTMENT_KINDS)[number]

export const ADJUSTMENT_KIND_LABEL: Record<AdjustmentKind, string> = {
  bonus: "Bonus",
  deduction: "Deduction",
  reimbursement: "Reimbursement",
  advance: "Advance",
}

// Direction of the adjustment on the driver's net pay. Bonuses and
// reimbursements add; deductions and advances subtract.
export function adjustmentSign(kind: AdjustmentKind): 1 | -1 {
  return kind === "bonus" || kind === "reimbursement" ? 1 : -1
}

export const SETTLEMENT_STATUSES = [
  "draft",
  "finalized",
  "paid",
] as const
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number]

export const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  draft: "Draft",
  finalized: "Finalized",
  paid: "Paid",
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Use YYYY-MM-DD." })

export const createSettlementSchema = z
  .object({
    driver_id: z.uuid(),
    period_start: dateString,
    period_end: dateString,
    notes: z.string().max(2000).optional().or(z.literal("")),
  })
  .refine((v) => v.period_end >= v.period_start, {
    message: "End date must be on or after start date.",
    path: ["period_end"],
  })

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>

export const addAdjustmentSchema = z.object({
  settlement_id: z.uuid(),
  kind: z.enum(ADJUSTMENT_KINDS),
  description: z.string().min(1, "Description is required.").max(400),
  amount_cad: z
    .number()
    .positive({ message: "Amount must be greater than 0." })
    .max(999999),
})

export type AddAdjustmentInput = z.infer<typeof addAdjustmentSchema>

export const markPaidSchema = z.object({
  settlement_id: z.uuid(),
  paid_at: dateString,
  paid_method: z.string().min(1, "Payment method is required.").max(80),
  paid_reference: z.string().max(120).optional().or(z.literal("")),
})

export type MarkPaidInput = z.infer<typeof markPaidSchema>

// ---------------------------------------------------------------------------
// Pure calculation helpers — used both by the server action that builds a
// settlement and by the preview UI that shows the totals before save.
// ---------------------------------------------------------------------------
export type SettlementLoadInput = {
  load_id: string
  rate_cad: number | null
  total_km: number | null
}

export type SettlementLineResult = {
  load_id: string
  load_rate_cad: number | null
  total_km: number | null
  amount_cad: number
}

export function computeSettlementLineAmount(
  method: PayMethod,
  rate: number,
  load: SettlementLoadInput,
): number {
  if (method === "percent_revenue") {
    return round2((load.rate_cad ?? 0) * rate)
  }
  if (method === "per_km") {
    return round2((load.total_km ?? 0) * rate)
  }
  // flat_per_load
  return round2(rate)
}

export function buildSettlementLines(
  method: PayMethod,
  rate: number,
  loads: SettlementLoadInput[],
): SettlementLineResult[] {
  return loads.map((load) => ({
    load_id: load.load_id,
    load_rate_cad: load.rate_cad,
    total_km: load.total_km,
    amount_cad: computeSettlementLineAmount(method, rate, load),
  }))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
