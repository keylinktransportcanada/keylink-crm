"use client"

import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"

import { Badge } from "@/components/ui/badge"
import {
  SETTLEMENT_STATUS_LABEL,
  type SettlementStatus,
} from "@/lib/schemas/settlements"
import { cn } from "@/lib/utils"

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

export type SettlementRowData = {
  id: string
  status: SettlementStatus
  period_start: string
  period_end: string
  loads_count: number
  gross_load_cad: number
  adjustments_cad: number
  total_cad: number
  driver_full_name: string | null
  driver_employee_id: string | null
}

// Clickable row for the settlements list. Whole row navigates to the detail
// page on click or Enter/Space — matches the loads-table behaviour.
export function SettlementRow({ row }: { row: SettlementRowData }) {
  const router = useRouter()
  const onNavigate = () => router.push(`/accounting/settlements/${row.id}`)

  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={onNavigate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onNavigate()
        }
      }}
      aria-label={`Open settlement for ${row.driver_full_name ?? "driver"}`}
      className="cursor-pointer bg-card transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
    >
      <td className="px-4 py-2.5">
        <div className="flex flex-col leading-tight">
          <span className="font-medium text-brand-navy">
            {row.driver_full_name ?? "Driver"}
          </span>
          <span className="text-xs text-muted-foreground">
            {row.driver_employee_id ?? "—"}
          </span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground">
        {format(parseISO(row.period_start), "MMM d")}
        {" → "}
        {format(parseISO(row.period_end), "MMM d, yyyy")}
      </td>
      <td className="px-4 py-2.5 tabular-nums">{row.loads_count}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {CAD.format(row.gross_load_cad)}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
        {CAD.format(row.adjustments_cad)}
      </td>
      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
        {CAD.format(row.total_cad)}
      </td>
      <td className="px-4 py-2.5">
        <Badge
          className={cn(
            "border text-[10px] font-semibold uppercase tracking-wider",
            STATUS_TONE[row.status],
          )}
        >
          {SETTLEMENT_STATUS_LABEL[row.status]}
        </Badge>
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="text-xs font-medium text-brand-teal-dark">
          Open →
        </span>
      </td>
    </tr>
  )
}
