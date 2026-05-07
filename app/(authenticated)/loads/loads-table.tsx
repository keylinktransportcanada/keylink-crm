"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import {
  ArrowRight,
  Calendar,
  MapPin,
  Package,
  Search,
  Truck,
  User,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@/components/ui/preview-card"
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
  EQUIPMENT_REQUIRED_LABEL,
  LOAD_STATUS_LABEL,
  LOAD_STATUS_VALUES,
  LOAD_TYPE_LABEL,
} from "@/lib/schemas/loads"

export type LoadListRow = {
  id: string
  load_number: string
  status: (typeof LOAD_STATUS_VALUES)[number]
  pickup_date: string | null
  delivery_date: string | null
  origin_company: string | null
  origin_city: string | null
  origin_province: string | null
  origin_country: string | null
  destination_company: string | null
  destination_city: string | null
  destination_province: string | null
  destination_country: string | null
  total_billed_cad: number | null
  customer_name: string | null
  driver_name: string | null
  truck_number: string | null
  trailer_number: string | null
  is_cross_border: boolean
  load_type: string
  commodity: string | null
  equipment_required: string | null
  notes: string | null
  reference_number: string | null
  po_number: string | null
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

// Same statuses re-tinted for the dark liquid-glass preview surface where
// the light-context shades disappear into the navy backdrop.
const STATUS_TONE_GLASS: Record<LoadListRow["status"], string> = {
  draft: "bg-white/10 text-brand-cloud/80",
  assigned: "bg-blue-500/25 text-blue-100",
  dispatched: "bg-blue-500/25 text-blue-100",
  at_pickup: "bg-amber-500/25 text-amber-100",
  loaded: "bg-amber-500/25 text-amber-100",
  in_transit: "bg-indigo-500/25 text-indigo-100",
  at_delivery: "bg-amber-500/25 text-amber-100",
  delivered: "bg-emerald-500/25 text-emerald-100",
  invoiced: "bg-emerald-500/25 text-emerald-100",
  paid: "bg-emerald-500/35 text-white",
  cancelled: "bg-red-500/30 text-red-100",
}

// "Active loads" = everything except cancelled. Paid loads stay visible so
// dispatchers can still see them after the run is done; explicit Cancelled
// filter is available to find archived ones.
const HIDDEN_BY_ACTIVE_FILTER = new Set<LoadListRow["status"]>(["cancelled"])

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

const formatLocationFull = (
  company: string | null,
  city: string | null,
  province: string | null,
  country: string | null,
): string => {
  const tail = [city, province, country].filter(Boolean).join(", ")
  if (company && tail) return `${company} · ${tail}`
  return company ?? tail ?? "—"
}

const formatDate = (iso: string | null) => {
  if (!iso) return "—"
  try {
    return format(parseISO(iso), "MMM d")
  } catch {
    return iso
  }
}

const formatDateLong = (iso: string | null) => {
  if (!iso) return "—"
  try {
    return format(parseISO(iso), "PPP")
  } catch {
    return iso
  }
}

export function LoadsTable({ loads }: { loads: LoadListRow[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("active")

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return loads.filter((l) => {
      if (statusFilter === "active" && HIDDEN_BY_ACTIVE_FILTER.has(l.status))
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

  const navigateTo = (id: string) => router.push(`/loads/${id}`)

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
                <PreviewCard key={l.id}>
                  <PreviewCardTrigger
                    delay={350}
                    closeDelay={120}
                    render={
                      <TableRow
                        tabIndex={0}
                        onClick={() => navigateTo(l.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            navigateTo(l.id)
                          }
                        }}
                        className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                      />
                    }
                  >
                    <TableCell className="font-mono font-medium">
                      <Link
                        href={`/loads/${l.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
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
                  </PreviewCardTrigger>
                  <PreviewCardContent
                    side="left"
                    align="start"
                    sideOffset={16}
                    className="w-[360px]"
                  >
                    <LoadPreview load={l} />
                  </PreviewCardContent>
                </PreviewCard>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

function LoadPreview({ load }: { load: LoadListRow }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-sm font-semibold tracking-tight">
            {load.load_number}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              className={cn(
                "border-transparent",
                STATUS_TONE_GLASS[load.status],
              )}
            >
              {LOAD_STATUS_LABEL[load.status]}
            </Badge>
            {load.is_cross_border ? (
              <Badge className="border-transparent bg-brand-teal/30 text-[10px] font-semibold uppercase tracking-wider text-brand-teal-light">
                Cross-border
              </Badge>
            ) : null}
          </div>
        </div>
        <span className="text-right font-display text-lg tracking-wide">
          {formatCAD(load.total_billed_cad)}
        </span>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-col gap-2 text-xs">
          <Row icon={<MapPin className="size-3.5" />} label="Customer">
            <span className="font-medium">
              {load.customer_name ?? "—"}
            </span>
          </Row>
          <Row icon={<MapPin className="size-3.5" />} label="Origin">
            <span>
              {formatLocationFull(
                load.origin_company,
                load.origin_city,
                load.origin_province,
                load.origin_country,
              )}
            </span>
          </Row>
          <Row icon={<ArrowRight className="size-3.5" />} label="Destination">
            <span>
              {formatLocationFull(
                load.destination_company,
                load.destination_city,
                load.destination_province,
                load.destination_country,
              )}
            </span>
          </Row>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <Field
            icon={<Calendar className="size-3.5" />}
            label="Pickup"
            value={formatDateLong(load.pickup_date)}
          />
          <Field
            icon={<Calendar className="size-3.5" />}
            label="Delivery"
            value={formatDateLong(load.delivery_date)}
          />
          <Field
            icon={<User className="size-3.5" />}
            label="Driver"
            value={load.driver_name}
            empty="unassigned"
          />
          <Field
            icon={<Truck className="size-3.5" />}
            label="Truck"
            value={load.truck_number}
            empty="unassigned"
          />
          <Field
            icon={<Package className="size-3.5" />}
            label="Type"
            value={
              LOAD_TYPE_LABEL[load.load_type as keyof typeof LOAD_TYPE_LABEL] ??
              load.load_type
            }
          />
          <Field
            icon={<Package className="size-3.5" />}
            label="Equipment"
            value={
              load.equipment_required
                ? EQUIPMENT_REQUIRED_LABEL[
                    load.equipment_required as keyof typeof EQUIPMENT_REQUIRED_LABEL
                  ] ?? load.equipment_required
                : "—"
            }
          />
        </div>

        {load.commodity ? (
          <div className="flex flex-col gap-0.5 rounded-md bg-white/5 px-2.5 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
              Commodity
            </span>
            <span className="text-xs">{load.commodity}</span>
          </div>
        ) : null}

        {load.notes ? (
          <div className="flex flex-col gap-0.5 rounded-md bg-white/5 px-2.5 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
              Notes
            </span>
            <span className="line-clamp-3 text-xs">{load.notes}</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-white/5 px-4 py-2">
        <Link
          href={`/loads/${load.id}`}
          className={cn(
            buttonVariants({ size: "sm" }),
            "bg-brand-gold text-brand-navy hover:bg-brand-gold-light",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          Open load
          <ArrowRight />
        </Link>
      </div>
    </div>
  )
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 opacity-60">{icon}</span>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
          {label}
        </span>
        {children}
      </div>
    </div>
  )
}

function Field({
  icon,
  label,
  value,
  empty = "—",
}: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
  empty?: string
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 opacity-60">{icon}</span>
      <div className="flex flex-1 flex-col gap-0.5 leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
          {label}
        </span>
        <span>
          {value ? value : <span className="opacity-60">{empty}</span>}
        </span>
      </div>
    </div>
  )
}
