import Link from "next/link"
import { notFound } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ChevronLeft } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { requireRole } from "@/lib/auth"
import {
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

import { AdjustmentsSection } from "./adjustments-section"
import { SettlementStatusActions } from "./settlement-status-actions"

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

export default async function SettlementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole(["admin", "accounting"])
  const { id } = await params
  const supabase = await createClient()

  const { data: s, error } = await supabase
    .from("driver_settlements")
    .select(
      `id, status, period_start, period_end, pay_method, pay_rate,
       loads_count, gross_load_cad, adjustments_cad, total_cad,
       paid_at, paid_method, paid_reference, notes,
       created_at, updated_at,
       driver:profiles!driver_settlements_driver_id_fkey ( id, full_name, employee_id, phone ),
       lines:driver_settlement_lines (
         id, load_id, pay_method, pay_rate,
         load_rate_cad, total_km, amount_cad,
         loads ( load_number, origin_city, destination_city, delivery_date,
                 customers ( name ) )
       ),
       adjustments:driver_settlement_adjustments (
         id, kind, description, amount_cad, created_at
       )`,
    )
    .eq("id", id)
    .maybeSingle()

  if (error || !s) notFound()

  const driver = (Array.isArray(s.driver) ? s.driver[0] : s.driver) as
    | { id: string; full_name: string | null; employee_id: string | null; phone: string | null }
    | null
  const status = s.status as SettlementStatus
  const payMethod = s.pay_method as "percent_revenue" | "flat_per_load" | "per_km"
  const lines = (s.lines ?? []) as Array<{
    id: string
    load_id: string
    amount_cad: number
    load_rate_cad: number | null
    total_km: number | null
    loads: { load_number: string; origin_city: string | null; destination_city: string | null; delivery_date: string | null; customers: { name: string | null } | { name: string | null }[] | null } | { load_number: string; origin_city: string | null; destination_city: string | null; delivery_date: string | null; customers: { name: string | null } | { name: string | null }[] | null }[] | null
  }>
  const adjustments = (s.adjustments ?? []) as Array<{
    id: string
    kind: AdjustmentKind
    description: string
    amount_cad: number
    created_at: string
  }>

  const locked = status === "paid"

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/accounting/settlements"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to settlements
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl uppercase tracking-wide text-brand-navy">
              {driver?.full_name ?? "Driver"}
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
            {format(parseISO(s.period_start), "MMM d, yyyy")} → {format(parseISO(s.period_end), "MMM d, yyyy")}
            {driver?.employee_id ? ` · ${driver.employee_id}` : ""}
          </p>
        </div>

        <SettlementStatusActions
          settlementId={s.id}
          status={status}
          totalCad={Number(s.total_cad)}
        />
      </header>

      {/* Quick facts band. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="Loads" value={`${s.loads_count ?? 0}`} />
        <Fact
          label="Pay method"
          value={PAY_METHOD_LABEL[payMethod]}
          sub={formatPayRate(payMethod, Number(s.pay_rate))}
        />
        <Fact
          label="Gross"
          value={CAD.format(Number(s.gross_load_cad))}
        />
        <Fact
          label="Net total"
          value={CAD.format(Number(s.total_cad))}
          emphasis
        />
      </section>

      {/* Loads / lines table. */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/40 px-4 py-2.5">
          <h2 className="text-sm font-semibold">Loads paid out</h2>
        </div>
        {lines.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No loads on this settlement. Add adjustments below or delete it.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Load</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Lane</th>
                <th className="px-4 py-2 font-medium">Delivered</th>
                <th className="px-4 py-2 text-right font-medium">Rate</th>
                <th className="px-4 py-2 text-right font-medium">KM</th>
                <th className="px-4 py-2 text-right font-medium">Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((line) => {
                const load = Array.isArray(line.loads) ? line.loads[0] : line.loads
                const customer = load?.customers
                  ? Array.isArray(load.customers)
                    ? load.customers[0]
                    : load.customers
                  : null
                return (
                  <tr key={line.id}>
                    <td className="px-4 py-2 font-medium tabular-nums">
                      <Link
                        href={`/loads/${line.load_id}`}
                        className="text-brand-teal-dark hover:underline"
                      >
                        {load?.load_number ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {customer?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {load?.origin_city ?? "—"} → {load?.destination_city ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {load?.delivery_date ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {line.load_rate_cad != null
                        ? CAD.format(Number(line.load_rate_cad))
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {line.total_km != null ? Number(line.total_km).toFixed(0) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {CAD.format(Number(line.amount_cad))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/30">
                <td colSpan={6} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Gross load pay
                </td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums">
                  {CAD.format(Number(s.gross_load_cad))}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      {/* Adjustments. */}
      <AdjustmentsSection
        settlementId={s.id}
        adjustments={adjustments}
        locked={locked}
        signTone={ADJ_SIGN_TONE}
      />

      {/* Payment info if paid. */}
      {status === "paid" && s.paid_at ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <h2 className="text-sm font-semibold text-emerald-900">
            Payment recorded
          </h2>
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-emerald-800/70">Paid on</dt>
              <dd className="font-medium text-emerald-900">
                {format(parseISO(s.paid_at), "MMM d, yyyy")}
              </dd>
            </div>
            <div>
              <dt className="text-emerald-800/70">Method</dt>
              <dd className="font-medium text-emerald-900">
                {s.paid_method ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-emerald-800/70">Reference</dt>
              <dd className="font-medium text-emerald-900">
                {s.paid_reference ?? "—"}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {/* Notes. */}
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
  emphasis = false,
}: {
  label: string
  value: string
  sub?: string
  emphasis?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-card p-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "font-display tracking-wide",
          emphasis ? "text-2xl text-brand-navy" : "text-base",
        )}
      >
        {value}
      </span>
      {sub ? (
        <span className="text-xs text-muted-foreground">{sub}</span>
      ) : null}
    </div>
  )
}
