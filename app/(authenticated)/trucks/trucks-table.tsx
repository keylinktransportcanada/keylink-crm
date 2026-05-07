"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { Hash } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
import { cn } from "@/lib/utils"
import {
  EQUIPMENT_STATUS_LABEL,
  type EQUIPMENT_STATUS_VALUES,
} from "@/lib/schemas/equipment"
import {
  daysBetween,
  nextExpiry,
  relativeExpiryLabel,
  SEVERITY_TONE,
  severityFor,
  todayInToronto,
} from "@/lib/expiry"

export type TruckRow = {
  id: string
  truck_number: string
  make: string | null
  model: string | null
  year: number | null
  status: (typeof EQUIPMENT_STATUS_VALUES)[number]
  plate: string | null
  plate_province: string | null
  plate_expiry: string | null
  insurance_expiry: string | null
  ifta_decal_expiry: string | null
  safety_sticker_expiry: string | null
  cvor_certificate_expiry: string | null
  notes: string | null
}

const STATUS_TONE: Record<TruckRow["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  maintenance: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  out_of_service: "bg-red-500/15 text-red-700 dark:text-red-300",
  retired: "bg-muted text-muted-foreground",
}

export function TrucksTable({ trucks }: { trucks: TruckRow[] }) {
  const router = useRouter()
  const today = todayInToronto()

  const navigateTo = (id: string) => router.push(`/trucks/${id}`)

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Truck #</TableHead>
            <TableHead>Make / Model</TableHead>
            <TableHead>Year</TableHead>
            <TableHead>Plate</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Next expiry</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trucks.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                No trucks yet. Click <strong>Add Truck</strong> to register
                your fleet.
              </TableCell>
            </TableRow>
          ) : (
            trucks.map((t) => {
              const expiry = nextExpiry(today, [
                { label: "Plate", date: t.plate_expiry },
                { label: "Insurance", date: t.insurance_expiry },
                { label: "IFTA decal", date: t.ifta_decal_expiry },
                { label: "Safety sticker", date: t.safety_sticker_expiry },
                { label: "CVOR cert", date: t.cvor_certificate_expiry },
              ])
              return (
                <PreviewCard key={t.id}>
                  <PreviewCardTrigger
                    delay={350}
                    closeDelay={120}
                    render={
                      <TableRow
                        tabIndex={0}
                        onClick={() => navigateTo(t.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            navigateTo(t.id)
                          }
                        }}
                        className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                      />
                    }
                  >
                    <TableCell className="font-mono font-medium">
                      <Link
                        href={`/trucks/${t.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {t.truck_number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {t.make || t.model ? (
                        <span>
                          {[t.make, t.model].filter(Boolean).join(" ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{t.year ?? "—"}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {t.plate
                        ? `${t.plate}${t.plate_province ? ` (${t.plate_province})` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "border-transparent",
                          STATUS_TONE[t.status],
                        )}
                      >
                        {EQUIPMENT_STATUS_LABEL[t.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {expiry ? (
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={cn(
                              "inline-flex w-fit items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                              SEVERITY_TONE[expiry.severity],
                            )}
                          >
                            {expiry.label}
                            <span className="opacity-70">
                              {expiry.severity === "expired"
                                ? `expired ${relativeExpiryLabel(expiry.daysUntil)}`
                                : relativeExpiryLabel(expiry.daysUntil)}
                            </span>
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(parseISO(expiry.date), "MMM d, yyyy")}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          no dates set
                        </span>
                      )}
                    </TableCell>
                  </PreviewCardTrigger>
                  <PreviewCardContent
                    side="left"
                    align="start"
                    sideOffset={16}
                    className="w-[360px]"
                  >
                    <TruckPreview truck={t} today={today} />
                  </PreviewCardContent>
                </PreviewCard>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function TruckPreview({ truck, today }: { truck: TruckRow; today: string }) {
  const expiries = [
    { label: "Plate", date: truck.plate_expiry },
    { label: "Insurance", date: truck.insurance_expiry },
    { label: "IFTA", date: truck.ifta_decal_expiry },
    { label: "Safety", date: truck.safety_sticker_expiry },
    { label: "CVOR", date: truck.cvor_certificate_expiry },
  ]

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-sm font-semibold">
            {truck.truck_number}
          </span>
          {truck.make || truck.model || truck.year ? (
            <span className="text-xs opacity-70">
              {[truck.year, truck.make, truck.model]
                .filter(Boolean)
                .join(" ")}
            </span>
          ) : null}
        </div>
        <Badge
          className={cn("border-transparent", STATUS_TONE[truck.status])}
        >
          {EQUIPMENT_STATUS_LABEL[truck.status]}
        </Badge>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <Field
            icon={<Hash className="size-3.5" />}
            label="Plate"
            value={
              truck.plate
                ? `${truck.plate}${truck.plate_province ? ` · ${truck.plate_province}` : ""}`
                : null
            }
          />
        </div>

        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
            Compliance
          </span>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {expiries.map((e) => {
              if (!e.date) {
                return (
                  <div
                    key={e.label}
                    className="flex flex-col gap-0.5 rounded-md border border-dashed border-white/15 px-2 py-1"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
                      {e.label}
                    </span>
                    <span className="text-[10px] italic opacity-50">
                      not set
                    </span>
                  </div>
                )
              }
              const days = daysBetween(today, e.date)
              const sev = severityFor(days)
              return (
                <div
                  key={e.label}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-md border border-transparent px-2 py-1",
                    SEVERITY_TONE[sev],
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                    {e.label}
                  </span>
                  <span className="text-[11px] font-semibold">
                    {format(parseISO(e.date), "MMM d")}
                  </span>
                  <span className="text-[10px] opacity-70">
                    {days < 0
                      ? `${relativeExpiryLabel(days)}`
                      : relativeExpiryLabel(days)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {truck.notes ? (
          <div className="flex flex-col gap-0.5 rounded-md bg-white/5 px-2.5 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
              Notes
            </span>
            <span className="line-clamp-3 text-xs">{truck.notes}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Field({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 opacity-60">{icon}</span>
      <div className="flex flex-1 flex-col gap-0.5 leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
          {label}
        </span>
        <span>{value ?? "—"}</span>
      </div>
    </div>
  )
}

