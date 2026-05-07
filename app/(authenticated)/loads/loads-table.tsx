"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  LOAD_STATUS_LABEL,
  LOAD_STATUS_VALUES,
} from "@/lib/schemas/loads"

export type LoadListRow = {
  id: string
  load_number: string
  status: (typeof LOAD_STATUS_VALUES)[number]
  pickup_date: string | null
  delivery_date: string | null
  origin_city: string | null
  origin_province: string | null
  destination_city: string | null
  destination_province: string | null
  total_billed_cad: number | null
  customer_name: string | null
  driver_name: string | null
  is_cross_border: boolean
}

const STATUS_TONE: Record<LoadListRow["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  assigned: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  dispatched: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  at_pickup: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  loaded: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  in_transit: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  at_delivery: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  invoiced: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  paid: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-300",
}

const FINAL_STATUSES = new Set<LoadListRow["status"]>(["paid", "cancelled"])

const formatCAD = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0,
      }).format(value)

const formatLocation = (
  city: string | null,
  province: string | null,
): string => {
  if (city && province) return `${city}, ${province}`
  return city ?? province ?? "—"
}

const formatDate = (iso: string | null) => {
  if (!iso) return "—"
  try {
    return format(parseISO(iso), "MMM d")
  } catch {
    return iso
  }
}

export function LoadsTable({ loads }: { loads: LoadListRow[] }) {
  const [filter, setFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("active")

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return loads.filter((l) => {
      if (statusFilter === "active" && FINAL_STATUSES.has(l.status))
        return false
      if (
        statusFilter !== "active" &&
        statusFilter !== "all" &&
        l.status !== statusFilter
      )
        return false
      if (!q) return true
      return (
        l.load_number.toLowerCase().includes(q) ||
        (l.customer_name?.toLowerCase().includes(q) ?? false) ||
        (l.driver_name?.toLowerCase().includes(q) ?? false) ||
        (l.origin_city?.toLowerCase().includes(q) ?? false) ||
        (l.destination_city?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [loads, filter, statusFilter])

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search load #, customer, driver, city…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v ?? "active")}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue>
              {(v: string | null) => {
                if (v === "active") return "Active loads"
                if (v === "all") return "All statuses"
                if (v && v in LOAD_STATUS_LABEL) {
                  return LOAD_STATUS_LABEL[
                    v as keyof typeof LOAD_STATUS_LABEL
                  ]
                }
                return v ?? ""
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active loads</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
            {LOAD_STATUS_VALUES.map((s) => (
              <SelectItem key={s} value={s}>
                {LOAD_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Load #</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Origin → Destination</TableHead>
              <TableHead>Pickup</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead className="text-right">Total (CAD)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {loads.length === 0
                    ? "No loads yet. Click New Load to create one."
                    : "No loads match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((l) => (
                <TableRow key={l.id} className="cursor-pointer hover:bg-muted/40">
                  <TableCell className="font-mono font-medium">
                    <Link href={`/loads/${l.id}`} className="hover:underline">
                      {l.load_number}
                    </Link>
                    {l.is_cross_border ? (
                      <span
                        className="ml-2 rounded-sm bg-brand-teal/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand-teal-light"
                        title="Cross-border"
                      >
                        CB
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "border-transparent",
                        STATUS_TONE[l.status],
                      )}
                    >
                      {LOAD_STATUS_LABEL[l.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{l.customer_name ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    <span>
                      {formatLocation(l.origin_city, l.origin_province)}
                    </span>
                    <span className="text-muted-foreground"> → </span>
                    <span>
                      {formatLocation(
                        l.destination_city,
                        l.destination_province,
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(l.pickup_date)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.driver_name ?? (
                      <span className="text-muted-foreground italic">
                        unassigned
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCAD(l.total_billed_cad)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
