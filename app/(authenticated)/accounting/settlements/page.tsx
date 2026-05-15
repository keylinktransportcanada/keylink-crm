import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ChevronLeft, Plus, Wallet } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { requireRole } from "@/lib/auth"
import {
  SETTLEMENT_STATUS_LABEL,
  type SettlementStatus,
} from "@/lib/schemas/settlements"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

const STATUS_TONE: Record<SettlementStatus, string> = {
  draft: "border-amber-200 bg-amber-50 text-amber-800",
  finalized: "border-blue-200 bg-blue-50 text-blue-800",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-800",
}

const CAD = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 2,
})

export default async function SettlementsListPage() {
  await requireRole(["admin", "accounting"])
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from("driver_settlements")
    .select(
      `id, status, period_start, period_end, loads_count,
       gross_load_cad, adjustments_cad, total_cad,
       paid_at, created_at,
       driver:profiles!driver_settlements_driver_id_fkey ( full_name, employee_id )`,
    )
    .order("created_at", { ascending: false })

  const settlements = rows ?? []

  // Tiny summary header.
  const totalDraft = settlements
    .filter((s) => s.status === "draft")
    .reduce((acc, s) => acc + Number(s.total_cad ?? 0), 0)
  const totalUnpaid = settlements
    .filter((s) => s.status === "finalized")
    .reduce((acc, s) => acc + Number(s.total_cad ?? 0), 0)
  const totalPaidThisMonth = settlements
    .filter((s) => {
      if (s.status !== "paid" || !s.paid_at) return false
      const paid = parseISO(s.paid_at)
      const now = new Date()
      return (
        paid.getUTCFullYear() === now.getUTCFullYear() &&
        paid.getUTCMonth() === now.getUTCMonth()
      )
    })
    .reduce((acc, s) => acc + Number(s.total_cad ?? 0), 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/accounting"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to accounting
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl uppercase tracking-wide text-brand-navy">
            Driver settlements
          </h1>
          <p className="text-sm text-muted-foreground">
            Pay-period statements per driver. Lines snapshot the driver's
            pay rate at the time the statement was generated.
          </p>
        </div>
        <Link
          href="/accounting/settlements/new"
          className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
        >
          <Plus className="size-4" />
          New settlement
        </Link>
      </header>

      {/* Summary tiles. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryTile
          label="Open drafts"
          value={CAD.format(totalDraft)}
          tone="amber"
        />
        <SummaryTile
          label="Finalized, unpaid"
          value={CAD.format(totalUnpaid)}
          tone="blue"
        />
        <SummaryTile
          label="Paid this month"
          value={CAD.format(totalPaidThisMonth)}
          tone="emerald"
        />
      </div>

      {settlements.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <Wallet className="size-7 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">No settlements yet</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Create a settlement for a driver to start paying out completed
            loads. Each driver needs a pay method on their compliance page.
          </p>
          <Link
            href="/accounting/settlements/new"
            className={cn(buttonVariants({ size: "sm" }), "mt-2 gap-1.5")}
          >
            <Plus className="size-4" />
            New settlement
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Driver</th>
                <th className="px-4 py-2 font-medium">Period</th>
                <th className="px-4 py-2 font-medium">Loads</th>
                <th className="px-4 py-2 text-right font-medium">Gross</th>
                <th className="px-4 py-2 text-right font-medium">Adj.</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {settlements.map((s) => {
                const driver = s.driver as { full_name: string | null; employee_id: string | null } | { full_name: string | null; employee_id: string | null }[] | null
                const d = Array.isArray(driver) ? driver[0] : driver
                const status = s.status as SettlementStatus
                return (
                  <tr
                    key={s.id}
                    className="bg-card transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col leading-tight">
                        <span className="font-medium text-brand-navy">
                          {d?.full_name ?? "Driver"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {d?.employee_id ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {format(parseISO(s.period_start), "MMM d")}
                      {" → "}
                      {format(parseISO(s.period_end), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {s.loads_count ?? 0}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {CAD.format(Number(s.gross_load_cad ?? 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {CAD.format(Number(s.adjustments_cad ?? 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {CAD.format(Number(s.total_cad ?? 0))}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        className={cn(
                          "border text-[10px] font-semibold uppercase tracking-wider",
                          STATUS_TONE[status],
                        )}
                      >
                        {SETTLEMENT_STATUS_LABEL[status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/accounting/settlements/${s.id}`}
                        className="text-xs font-medium text-brand-teal-dark hover:underline"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "amber" | "blue" | "emerald"
}) {
  const toneRing: Record<typeof tone, string> = {
    amber: "ring-amber-100",
    blue: "ring-blue-100",
    emerald: "ring-emerald-100",
  }
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-border bg-card p-4 ring-1",
        toneRing[tone],
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="font-display text-2xl tracking-wide text-brand-navy">
        {value}
      </span>
    </div>
  )
}
