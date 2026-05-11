"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import {
  CalendarClock,
  CircleDollarSign,
  Gauge,
  Loader2,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  daysBetween,
  relativeExpiryLabel,
  SEVERITY_TONE,
  todayInToronto,
} from "@/lib/expiry"
import {
  MAINTENANCE_DEFAULT_DAY_INTERVAL,
  MAINTENANCE_DEFAULT_KM_INTERVAL,
  MAINTENANCE_SERVICE_LABEL,
  MAINTENANCE_SERVICE_TYPES,
  type MaintenanceServiceType,
} from "@/lib/schemas/maintenance"

import {
  createMaintenanceRecord,
  deleteMaintenanceRecord,
} from "@/app/(authenticated)/maintenance/actions"

export type MaintenanceRecord = {
  id: string
  service_type: MaintenanceServiceType
  service_date: string
  odometer_km: number | null
  cost_cad: number | null
  vendor: string | null
  description: string | null
  next_due_date: string | null
  next_due_odometer_km: number | null
  created_by_name: string | null
}

const SERVICE_TONE: Record<MaintenanceServiceType, string> = {
  oil_change: "bg-amber-500/15 text-amber-700",
  tire: "bg-slate-500/15 text-slate-700",
  brake: "bg-red-500/15 text-red-700",
  annual_inspection: "bg-indigo-500/15 text-indigo-700",
  safety: "bg-emerald-500/15 text-emerald-700",
  repair: "bg-orange-500/15 text-orange-700",
  preventive: "bg-blue-500/15 text-blue-700",
  other: "bg-muted text-muted-foreground",
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatCAD(n: number | null): string {
  if (n === null) return "—"
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n)
}

export function MaintenanceSection({
  truckId,
  currentOdometerKm,
  records,
  canEdit,
}: {
  truckId: string
  currentOdometerKm: number | null
  records: MaintenanceRecord[]
  canEdit: boolean
}) {
  const router = useRouter()
  const today = todayInToronto()
  const [open, setOpen] = useState(false)
  const [busy, startTransition] = useTransition()

  const [serviceType, setServiceType] =
    useState<MaintenanceServiceType>("oil_change")
  const [serviceDate, setServiceDate] = useState<string>(today)
  const [odometer, setOdometer] = useState<string>(
    currentOdometerKm !== null ? String(currentOdometerKm) : "",
  )
  const [cost, setCost] = useState<string>("")
  const [vendor, setVendor] = useState<string>("")
  const [description, setDescription] = useState<string>("")
  const [nextDueDate, setNextDueDate] = useState<string>("")
  const [nextDueKm, setNextDueKm] = useState<string>("")

  // Auto-suggest next-due based on service-type defaults whenever the service
  // type or service date changes — only when those fields are still blank, so
  // we don't trample on operator overrides.
  function applyDefaults(
    type: MaintenanceServiceType,
    fromDate: string,
    fromKm: string,
  ) {
    const dayInterval = MAINTENANCE_DEFAULT_DAY_INTERVAL[type]
    const kmInterval = MAINTENANCE_DEFAULT_KM_INTERVAL[type]
    if (dayInterval !== null && fromDate) {
      setNextDueDate(addDaysISO(fromDate, dayInterval))
    } else {
      setNextDueDate("")
    }
    if (kmInterval !== null && fromKm) {
      const km = Number(fromKm)
      if (Number.isFinite(km)) setNextDueKm(String(km + kmInterval))
    } else {
      setNextDueKm("")
    }
  }

  function resetForm() {
    setServiceType("oil_change")
    setServiceDate(today)
    setOdometer(currentOdometerKm !== null ? String(currentOdometerKm) : "")
    setCost("")
    setVendor("")
    setDescription("")
    setNextDueDate("")
    setNextDueKm("")
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!serviceDate) {
      toast.error("Service date is required.")
      return
    }
    const fd = new FormData()
    fd.set("truck_id", truckId)
    fd.set("service_type", serviceType)
    fd.set("service_date", serviceDate)
    fd.set("odometer_km", odometer)
    fd.set("cost_cad", cost)
    fd.set("vendor", vendor)
    fd.set("description", description)
    fd.set("next_due_date", nextDueDate)
    fd.set("next_due_odometer_km", nextDueKm)

    startTransition(async () => {
      const result = await createMaintenanceRecord(fd)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Service recorded.")
      resetForm()
      setOpen(false)
      router.refresh()
    })
  }

  function remove(id: string) {
    if (!confirm("Delete this maintenance record?")) return
    startTransition(async () => {
      const result = await deleteMaintenanceRecord(id)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Record deleted.")
      router.refresh()
    })
  }

  const sortedRecords = useMemo(
    () =>
      [...records].sort((a, b) =>
        a.service_date < b.service_date ? 1 : -1,
      ),
    [records],
  )

  return (
    <div className="flex flex-col gap-4">
      {canEdit ? (
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Record every oil change, tire rotation, brake job, or repair.
            Setting a next-due date or kilometre target will surface this truck
            on the dispatcher dashboard when service is approaching.
          </p>
          <Button
            type="button"
            size="sm"
            variant={open ? "outline" : "default"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              "Cancel"
            ) : (
              <>
                <Plus className="size-4" />
                Log service
              </>
            )}
          </Button>
        </div>
      ) : null}

      {open && canEdit ? (
        <form
          onSubmit={submit}
          className="grid grid-cols-1 gap-3 rounded-lg border border-border/70 bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Service type
            </label>
            <Select
              value={serviceType}
              onValueChange={(v) => {
                const next = v as MaintenanceServiceType
                setServiceType(next)
                applyDefaults(next, serviceDate, odometer)
              }}
            >
              <SelectTrigger>
                <SelectValue>
                  {() => MAINTENANCE_SERVICE_LABEL[serviceType]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MAINTENANCE_SERVICE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {MAINTENANCE_SERVICE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Service date
            </label>
            <Input
              type="date"
              value={serviceDate}
              onChange={(e) => {
                setServiceDate(e.target.value)
                applyDefaults(serviceType, e.target.value, odometer)
              }}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Odometer (km)
            </label>
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              value={odometer}
              onChange={(e) => {
                setOdometer(e.target.value)
                applyDefaults(serviceType, serviceDate, e.target.value)
              }}
              placeholder="e.g. 184000"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Cost (CAD)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="e.g. 320.00"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Vendor / shop
            </label>
            <Input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. North York Truck Service"
              maxLength={120}
            />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
            <label className="text-xs font-medium text-muted-foreground">
              Description / notes
            </label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Replaced front pads, turned rotors, road-tested."
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Next due — date
            </label>
            <Input
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Next due — odometer (km)
            </label>
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              value={nextDueKm}
              onChange={(e) => setNextDueKm(e.target.value)}
              placeholder="auto"
            />
          </div>

          <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-1">
            <Button type="submit" disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wrench className="size-4" />
              )}
              Save record
            </Button>
          </div>
        </form>
      ) : null}

      {sortedRecords.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
          No maintenance recorded yet for this truck.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border/70 bg-card">
          {sortedRecords.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex shrink-0 flex-col items-start gap-1 sm:w-44">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    SERVICE_TONE[r.service_type],
                  )}
                >
                  <Wrench className="size-3" />
                  {MAINTENANCE_SERVICE_LABEL[r.service_type]}
                </span>
                <span className="text-sm font-semibold">
                  {format(parseISO(r.service_date), "MMM d, yyyy")}
                </span>
                {r.odometer_km !== null ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Gauge className="size-3" />
                    {r.odometer_km.toLocaleString()} km
                  </span>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col gap-1 leading-tight">
                {r.description ? (
                  <p className="whitespace-pre-wrap text-sm">
                    {r.description}
                  </p>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    No description.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {r.vendor ? <span>· {r.vendor}</span> : null}
                  {r.cost_cad !== null ? (
                    <span className="inline-flex items-center gap-1">
                      <CircleDollarSign className="size-3" />
                      {formatCAD(r.cost_cad)}
                    </span>
                  ) : null}
                  {r.created_by_name ? (
                    <span>· logged by {r.created_by_name}</span>
                  ) : null}
                </div>
                {(r.next_due_date || r.next_due_odometer_km !== null) ? (
                  <NextDueRow
                    today={today}
                    currentOdometerKm={currentOdometerKm}
                    dueDate={r.next_due_date}
                    dueKm={r.next_due_odometer_km}
                  />
                ) : null}
              </div>

              {canEdit ? (
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
                  title="Delete record"
                  aria-label="Delete record"
                  disabled={busy}
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NextDueRow({
  today,
  currentOdometerKm,
  dueDate,
  dueKm,
}: {
  today: string
  currentOdometerKm: number | null
  dueDate: string | null
  dueKm: number | null
}) {
  const dateChip = (() => {
    if (!dueDate) return null
    const days = daysBetween(today, dueDate)
    const sev =
      days < 0 ? "expired" : days <= 7 ? "critical" : days <= 30 ? "warning" : "ok"
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
          SEVERITY_TONE[sev],
        )}
      >
        <CalendarClock className="size-3" />
        next: {format(parseISO(dueDate), "MMM d, yyyy")} ·{" "}
        {days < 0
          ? `overdue ${relativeExpiryLabel(days)}`
          : relativeExpiryLabel(days)}
      </span>
    )
  })()

  const kmChip = (() => {
    if (dueKm === null) return null
    if (currentOdometerKm === null) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          <Gauge className="size-3" />
          due at {dueKm.toLocaleString()} km
        </span>
      )
    }
    const remaining = dueKm - currentOdometerKm
    const sev =
      remaining < 0
        ? "expired"
        : remaining <= 1000
          ? "critical"
          : remaining <= 5000
            ? "warning"
            : "ok"
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
          SEVERITY_TONE[sev],
        )}
      >
        <Gauge className="size-3" />
        {remaining < 0
          ? `${Math.abs(remaining).toLocaleString()} km overdue`
          : `${remaining.toLocaleString()} km to go`}
      </span>
    )
  })()

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {dateChip}
      {kmChip}
    </div>
  )
}
