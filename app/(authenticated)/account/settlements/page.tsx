import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ChevronLeft, Wallet } from "lucide-react"

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

export default async function MySettlementsPage() {
  const me = await requireRole(["driver", "admin", "accounting"])
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from("driver_settlements")
    .select(
      `id, status, period_start, period_end, loads_count,
       total_cad, paid_at`,
    )
    .eq("driver_id", me.id)
    .order("period_start", { ascending: false })

  const settlements = rows ?? []
  const ytdPaid = settlements
    .filter((s) => s.status === "paid")
    .reduce((acc, s) => acc + Number(s.total_cad ?? 0), 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to dashboard
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl uppercase tracking-wide text-brand-navy">
            My pay
          </h1>
          <p className="text-sm text-muted-foreground">
            Settlement statements for the loads you've delivered. Read-only.
            Reach out to dispatch or admin if something looks off.
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Year to date
          </div>
          <div className="font-display text-2xl tracking-wide text-emerald-900">
            {CAD.format(ytdPaid)}
          </div>
        </div>
      </header>

      {settlements.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <Wallet className="size-7 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">No statements yet</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Statements show up here once admin generates one for a pay
            period that includes your delivered loads.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Period</th>
                <th className="px-4 py-2 font-medium">Loads</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Paid</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {settlements.map((s) => {
                const status = s.status as SettlementStatus
                return (
                  <tr
                    key={s.id}
                    className="bg-card transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {format(parseISO(s.period_start), "MMM d")}
                      {" → "}
                      {format(parseISO(s.period_end), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {s.loads_count ?? 0}
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
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {s.paid_at
                        ? format(parseISO(s.paid_at), "MMM d, yyyy")
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/account/settlements/${s.id}`}
                        className="text-xs font-medium text-brand-teal-dark hover:underline"
                      >
                        View →
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
