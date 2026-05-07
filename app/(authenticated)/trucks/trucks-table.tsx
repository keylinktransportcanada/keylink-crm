"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { format, parseISO } from "date-fns"

import { Badge } from "@/components/ui/badge"
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
  nextExpiry,
  relativeExpiryLabel,
  SEVERITY_TONE,
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
                <TableRow
                  key={t.id}
                  tabIndex={0}
                  onClick={() => navigateTo(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      navigateTo(t.id)
                    }
                  }}
                  className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
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
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
