"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireRole } from "@/lib/auth"
import {
  addAdjustmentSchema,
  buildSettlementLines,
  createSettlementSchema,
  markPaidSchema,
  type AddAdjustmentInput,
  type CreateSettlementInput,
  type MarkPaidInput,
  type PayMethod,
  type SettlementLoadInput,
} from "@/lib/schemas/settlements"
import { createClient } from "@/lib/supabase/server"

type FieldErrors = Partial<Record<string, string[]>>
type Result<T = object> = ({ ok: true } & T) | { error: FieldErrors }

// Statuses of loads that count as "deliverable" for payroll. A load doesn't
// need to be invoiced for the driver to be paid — once it's delivered, the
// driver has earned the pay.
import type { LoadStatus } from "@/lib/supabase/types"

const DELIVERABLE_STATUSES: readonly LoadStatus[] = [
  "delivered",
  "invoiced",
  "paid",
] as const

// ---------------------------------------------------------------------------
// Pull every load that's eligible for a given driver + period and hasn't
// already been paid out on a prior settlement. Used by both the preview UI
// and the create action so they agree on what gets included.
// ---------------------------------------------------------------------------
export async function previewEligibleLoads(
  driverId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{
  loads: Array<{
    id: string
    load_number: string
    customer_name: string | null
    origin_city: string | null
    destination_city: string | null
    delivery_date: string | null
    rate_cad: number | null
    total_km: number | null
  }>
}> {
  await requireRole(["admin", "accounting"])
  const supabase = await createClient()

  // 1) Loads in the date range, by driver, in a deliverable status.
  const { data: loads } = await supabase
    .from("loads")
    .select(
      `id, load_number, origin_city, destination_city, delivery_date,
       rate_cad, status,
       customers ( name )`,
    )
    .eq("driver_id", driverId)
    .gte("delivery_date", periodStart)
    .lte("delivery_date", periodEnd)
    .in("status", DELIVERABLE_STATUSES)
    .order("delivery_date", { ascending: true })

  if (!loads || loads.length === 0) return { loads: [] }

  // 2) Drop any load already on an existing settlement.
  const loadIds = loads.map((l) => l.id)
  const { data: existing } = await supabase
    .from("driver_settlement_lines")
    .select("load_id")
    .in("load_id", loadIds)

  const settledIds = new Set((existing ?? []).map((r) => r.load_id))
  const freshLoads = loads.filter((l) => !settledIds.has(l.id))

  if (freshLoads.length === 0) return { loads: [] }

  // 3) Sum trip_distances per load (needed for per_km pay calcs).
  const { data: dist } = await supabase
    .from("trip_distances")
    .select("load_id, distance_km")
    .in(
      "load_id",
      freshLoads.map((l) => l.id),
    )

  const kmByLoad = new Map<string, number>()
  for (const d of dist ?? []) {
    kmByLoad.set(
      d.load_id,
      (kmByLoad.get(d.load_id) ?? 0) + Number(d.distance_km),
    )
  }

  return {
    loads: freshLoads.map((l) => {
      const customers = l.customers as { name: string | null } | { name: string | null }[] | null
      const customerName = Array.isArray(customers)
        ? customers[0]?.name ?? null
        : customers?.name ?? null
      return {
        id: l.id,
        load_number: l.load_number,
        customer_name: customerName,
        origin_city: l.origin_city,
        destination_city: l.destination_city,
        delivery_date: l.delivery_date,
        rate_cad: l.rate_cad ? Number(l.rate_cad) : null,
        total_km: kmByLoad.get(l.id) ?? null,
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// Create a draft settlement: snapshots the driver's pay config, computes a
// line per eligible load, and inserts everything in one go. Triggers in the
// migration recompute totals.
// ---------------------------------------------------------------------------
export async function createSettlement(
  input: CreateSettlementInput,
): Promise<Result<{ id: string }>> {
  const me = await requireRole(["admin", "accounting"])
  const parsed = createSettlementSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }
  const { driver_id, period_start, period_end, notes } = parsed.data

  const supabase = await createClient()

  // Snapshot the driver's pay config at create time.
  const { data: dp, error: dpErr } = await supabase
    .from("driver_profiles")
    .select("pay_method, pay_rate")
    .eq("profile_id", driver_id)
    .maybeSingle()
  if (dpErr || !dp) {
    return { error: { _form: ["Driver profile not found."] } }
  }
  const payMethod = dp.pay_method as PayMethod
  const payRate = Number(dp.pay_rate)

  const { loads } = await previewEligibleLoads(
    driver_id,
    period_start,
    period_end,
  )

  // Build the settlement row + lines.
  const { data: settlement, error: settlementErr } = await supabase
    .from("driver_settlements")
    .insert({
      driver_id,
      period_start,
      period_end,
      status: "draft",
      pay_method: payMethod,
      pay_rate: payRate,
      notes: notes && notes.length > 0 ? notes : null,
      created_by: me.id,
    })
    .select("id")
    .single()
  if (settlementErr || !settlement) {
    return { error: { _form: [settlementErr?.message ?? "Insert failed."] } }
  }

  if (loads.length > 0) {
    const lineInputs: SettlementLoadInput[] = loads.map((l) => ({
      load_id: l.id,
      rate_cad: l.rate_cad,
      total_km: l.total_km,
    }))
    const lines = buildSettlementLines(payMethod, payRate, lineInputs)
    const { error: linesErr } = await supabase
      .from("driver_settlement_lines")
      .insert(
        lines.map((line) => ({
          settlement_id: settlement.id,
          load_id: line.load_id,
          pay_method: payMethod,
          pay_rate: payRate,
          load_rate_cad: line.load_rate_cad,
          total_km: line.total_km,
          amount_cad: line.amount_cad,
        })),
      )
    if (linesErr) {
      // Clean up the settlement so it doesn't dangle without lines.
      await supabase
        .from("driver_settlements")
        .delete()
        .eq("id", settlement.id)
      return { error: { _form: [linesErr.message] } }
    }
  }

  revalidatePath("/accounting/settlements")
  return { ok: true, id: settlement.id }
}

export async function addAdjustment(
  input: AddAdjustmentInput,
): Promise<Result> {
  await requireRole(["admin", "accounting"])
  const parsed = addAdjustmentSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }
  const { settlement_id, kind, description, amount_cad } = parsed.data

  const supabase = await createClient()

  // Block edits to a settlement that's already paid out.
  const { data: s } = await supabase
    .from("driver_settlements")
    .select("status")
    .eq("id", settlement_id)
    .maybeSingle()
  if (!s) return { error: { _form: ["Settlement not found."] } }
  if (s.status === "paid") {
    return { error: { _form: ["This settlement has been paid and is locked."] } }
  }

  const { error } = await supabase
    .from("driver_settlement_adjustments")
    .insert({ settlement_id, kind, description, amount_cad })
  if (error) return { error: { _form: [error.message] } }

  revalidatePath(`/accounting/settlements/${settlement_id}`)
  revalidatePath("/accounting/settlements")
  return { ok: true }
}

export async function removeAdjustment(
  adjustmentId: string,
): Promise<Result> {
  await requireRole(["admin", "accounting"])
  const supabase = await createClient()

  const { data: adj } = await supabase
    .from("driver_settlement_adjustments")
    .select("settlement_id, driver_settlements ( status )")
    .eq("id", adjustmentId)
    .maybeSingle()
  if (!adj) return { error: { _form: ["Adjustment not found."] } }
  const s = adj.driver_settlements as { status: string } | { status: string }[] | null
  const status = Array.isArray(s) ? s[0]?.status : s?.status
  if (status === "paid") {
    return { error: { _form: ["This settlement has been paid and is locked."] } }
  }

  const { error } = await supabase
    .from("driver_settlement_adjustments")
    .delete()
    .eq("id", adjustmentId)
  if (error) return { error: { _form: [error.message] } }

  revalidatePath(`/accounting/settlements/${adj.settlement_id}`)
  revalidatePath("/accounting/settlements")
  return { ok: true }
}

export async function finalizeSettlement(
  settlementId: string,
): Promise<Result> {
  await requireRole(["admin", "accounting"])
  const supabase = await createClient()

  const { data: s } = await supabase
    .from("driver_settlements")
    .select("status")
    .eq("id", settlementId)
    .maybeSingle()
  if (!s) return { error: { _form: ["Settlement not found."] } }
  if (s.status !== "draft") {
    return { error: { _form: ["Only draft settlements can be finalized."] } }
  }

  const { error } = await supabase
    .from("driver_settlements")
    .update({ status: "finalized" })
    .eq("id", settlementId)
  if (error) return { error: { _form: [error.message] } }

  revalidatePath(`/accounting/settlements/${settlementId}`)
  revalidatePath("/accounting/settlements")
  return { ok: true }
}

export async function reopenSettlement(
  settlementId: string,
): Promise<Result> {
  await requireRole(["admin", "accounting"])
  const supabase = await createClient()

  const { data: s } = await supabase
    .from("driver_settlements")
    .select("status")
    .eq("id", settlementId)
    .maybeSingle()
  if (!s) return { error: { _form: ["Settlement not found."] } }
  if (s.status !== "finalized") {
    return { error: { _form: ["Only finalized settlements can be reopened."] } }
  }

  const { error } = await supabase
    .from("driver_settlements")
    .update({ status: "draft" })
    .eq("id", settlementId)
  if (error) return { error: { _form: [error.message] } }

  revalidatePath(`/accounting/settlements/${settlementId}`)
  revalidatePath("/accounting/settlements")
  return { ok: true }
}

export async function markPaid(input: MarkPaidInput): Promise<Result> {
  await requireRole(["admin", "accounting"])
  const parsed = markPaidSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }
  const { settlement_id, paid_at, paid_method, paid_reference } = parsed.data

  const supabase = await createClient()
  const { data: s } = await supabase
    .from("driver_settlements")
    .select("status")
    .eq("id", settlement_id)
    .maybeSingle()
  if (!s) return { error: { _form: ["Settlement not found."] } }
  if (s.status !== "finalized") {
    return {
      error: { _form: ["Finalize the settlement before recording payment."] },
    }
  }

  const { error } = await supabase
    .from("driver_settlements")
    .update({
      status: "paid",
      paid_at: new Date(paid_at).toISOString(),
      paid_method,
      paid_reference:
        paid_reference && paid_reference.length > 0 ? paid_reference : null,
    })
    .eq("id", settlement_id)
  if (error) return { error: { _form: [error.message] } }

  revalidatePath(`/accounting/settlements/${settlement_id}`)
  revalidatePath("/accounting/settlements")
  return { ok: true }
}

export async function deleteSettlement(
  settlementId: string,
): Promise<Result> {
  await requireRole(["admin", "accounting"])
  const supabase = await createClient()

  const { data: s } = await supabase
    .from("driver_settlements")
    .select("status")
    .eq("id", settlementId)
    .maybeSingle()
  if (!s) return { error: { _form: ["Settlement not found."] } }
  if (s.status !== "draft") {
    return { error: { _form: ["Only draft settlements can be deleted."] } }
  }

  const { error } = await supabase
    .from("driver_settlements")
    .delete()
    .eq("id", settlementId)
  if (error) return { error: { _form: [error.message] } }

  revalidatePath("/accounting/settlements")
  redirect("/accounting/settlements")
}
