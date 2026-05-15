import Link from "next/link"
import { notFound } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ChevronLeft } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { requireRole } from "@/lib/auth"
import {
  ADJUSTMENT_KIND_LABEL,
  adjustmentSign,
  SETTLEMENT_STATUS_LABEL,
  type AdjustmentKind,
  type SettlementStatus,
} from "@/lib/schemas/settlements"
import {
  formatPayRate,
  PAY_METHOD_LABEL,
} from "@/lib/schemas/driver-profile"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

const CAD = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 2,
})

const STATUS_TONE: Record<SettlementStatus, string> = {
  draft: "border-amber-200 bg-amber-50 text-amber-800",
  finalized: "border-blue-200 bg-blue-50 text-blue-800",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-800",
}

const ADJ_SIGN_TONE: Record<AdjustmentKind, string> = {
  bonus: "text-emerald-700",
  reimbursement: "text-emerald-700",
  deduction: "text-red-700",
  advance: "text-red-700",
}

// Driver-facing read-only statement. Mirrors the accounting detail page but
// strips the status actions (drivers can't finalize or mark paid) and
// scopes by driver_id so a driver can only see their own settlements.
export default async function MySettlementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const me = await requireRole(["driver", "admin", "accounting"])
  const { id } = await params
  const supabase = await createClient()

  const { data: s } = await supabase
    .from("driver_settlements")
    .select(
      `id, status, period_start, period_end, pay_method, pay_rate,
       loads_count, gross_load_cad, adjustments_cad, total_cad,
       paid_at, paid_method, paid_reference, notes, driver_id,
       lines:driver_settlement_lines (
         id, load_id, load_rate_cad, total_km, amount_cad,
         loads ( load_number, origin_city, destination_city, delivery_date,
                 customers ( name ) )
       ),
       adjustments:driver_settlement_adjustments (
         id, kind, description, amount_cad
       )`,
    )
    .eq("id", id)
    .maybeSingle()

  // RLS hides settlements that don't belong to the driver, but extra-safe:
  // 404 if the row isn't there or doesn't match the requester (driver-only).
  if (!s) notFound()
  if (me.role === "driver" && s.driver_id !== me.id) notFound()

  const status = s.status as SettlementStatus
  const payMethod = s.pay_method as
    | "percent_revenue"
    | "flat_per_load"
    | "per_km"
  const lines = (s.lines ?? []) as Array<{
    id: string
    load_id: string
    amount_cad: number
    load_rate_cad: number | null
    total_km: number | null
    loads:
      | {
          load_number: string
          origin_city: string | null
          destination_city: string | null
          delivery_date: string | null
          customers:
            | { name: string | null }
            | { name: string | null }[]
            | null
        }
      | {
          load_number: string
          origin_city: string | null
          destination_city: string | null
          delivery_date: string | null
          customers:
            | { name: string | null }
            | { name: string | null }[]
            | null
        }[]
      | null
  }>
  const adjustments = (s.adjustments ?? []) as Array<{
    id: string
    kind: AdjustmentKind
    description: string
    amount_cad: number
  }>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/account/settlements"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to my pay
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl uppercase tracking-wide text-brand-navy">
              Statement
            </h1>
            <Badge
              className={cn(
                "border text-[10px] font-semibold uppercase tracking-wider",
                STATUS_TONE[status],
              )}
            >
              {SETTLEMENT_STATUS_LABEL[status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(parseISO(s.period_start), "MMM d, yyyy")} →{" "}
            {format(parseISO(s.period_end), "MMM d, yyyy")}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Total
          </div>
          <div className="font-display text-3xl tracking-wide text-emerald-900">
            {CAD.format(Number(s.total_cad))}
          </div>
        </div>
      </header>

      {/* Status banner. */}
      {status === "paid" && s.paid_at ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="text-sm font-semibold text-emerald-900">
            Paid {format(parseISO(s.paid_at), "MMM d, yyyy")}
            {s.paid_method ? ` via ${s.paid_method}` : ""}
          </div>
          {s.paid_reference ? (
            <div className="mt-0.5 text-xs text-emerald-800/80">
              Ref: {s.paid_reference}
            </div>
          ) : null}
        </div>
      ) : status === "finalized" ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-900">
          Finalized and pending payment. You'll get a notification when the
          payment is recorded.
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
          Draft — totals on this page can still change.
        </div>
      )}

      {/* Quick facts. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Fact label="Loads" value={`${s.loads_count ?? 0}`} />
        <Fact
          label="Pay method"
          value={PAY_METHOD_LABEL[payMethod]}
          sub={formatPayRate(payMethod, Number(s.pay_rate))}
        />
        <Fact label="Gross" value={CAD.format(Number(s.gross_load_cad))} />
      </section>

      {/* Loads list (read-only). */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/40 px-4 py-2.5">
          <h2 className="text-sm font-semibold">Loads</h2>
        </div>
        {lines.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No loads on this statement.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Load</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Lane</th>
                <th className="px-4 py-2 font-medium">Delivered</th>
                <th className="px-4 py-2 text-right font-medium">Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((line) => {
                const load = Array.isArray(line.loads)
                  ? line.loads[0]
                  : line.loads
                const customer = load?.customers
                  ? Array.isArray(load.customers)
                    ? load.customers[0]
                    : load.customers
                  : null
                return (
                  <tr key={line.id}>
                    <td className="px-4 py-2 font-medium tabular-nums">
                      {load?.load_number ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {customer?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {load?.origin_city ?? "—"} →{" "}
                      {load?.destination_city ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {load?.delivery_date ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {CAD.format(Number(line.amount_cad))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Adjustments (read-only). */}
      {adjustments.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-4 py-2.5">
            <h2 className="text-sm font-semibold">Bonuses & deductions</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Kind</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {adjustments.map((a) => {
                const sign = adjustmentSign(a.kind)
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ADJ_SIGN_TONE[a.kind] ?? ""}`}
                      >
                        {ADJUSTMENT_KIND_LABEL[a.kind]}
                      </span>
                    </td>
                    <td className="px-4 py-2">{a.description}</td>
                    <td
                      className={`px-4 py-2 text-right font-semibold tabular-nums ${ADJ_SIGN_TONE[a.kind] ?? ""}`}
                    >
                      {sign === -1 ? "−" : "+"}
                      {CAD.format(Number(a.amount_cad))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {/* Admin notes shown to the driver. */}
      {s.notes ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Notes
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{s.notes}</p>
        </section>
      ) : null}
    </div>
  )
}

function Fact({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-card p-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="font-display text-base tracking-wide">{value}</span>
      {sub ? (
        <span className="text-xs text-muted-foreground">{sub}</span>
      ) : null}
    </div>
  )
}
