"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { Hash, Pencil, Plus, Wrench } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  TRAILER_TYPE_LABEL,
  type EQUIPMENT_STATUS_VALUES,
  type TRAILER_TYPE_VALUES,
} from "@/lib/schemas/equipment"
import {
  daysBetween,
  nextExpiry,
  relativeExpiryLabel,
  SEVERITY_TONE,
  severityFor,
  todayInToronto,
} from "@/lib/expiry"

import { TrailerDialog } from "./trailer-dialog"

export type TrailerRow = {
  id: string
  trailer_number: string
  type: (typeof TRAILER_TYPE_VALUES)[number]
  status: (typeof EQUIPMENT_STATUS_VALUES)[number]
  plate: string | null
  plate_province: string | null
  plate_expiry: string | null
  vin: string | null
  last_inspection_date: string | null
  next_inspection_due: string | null
  notes: string | null
}

const STATUS_TONE: Record<TrailerRow["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  maintenance: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  out_of_service: "bg-red-500/15 text-red-700 dark:text-red-300",
  retired: "bg-muted text-muted-foreground",
}

export function TrailersTable({
  trailers,
  canEdit,
}: {
  trailers: TrailerRow[]
  canEdit: boolean
}) {
  const [editing, setEditing] = useState<TrailerRow | null>(null)
  const [adding, setAdding] = useState(false)
  const today = todayInToronto()

  return (
    <>
      {canEdit ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus />
            Add Trailer
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trailer #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Plate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Next expiry</TableHead>
              {canEdit ? (
                <TableHead className="text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {trailers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 6 : 5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No trailers yet.
                  {canEdit ? (
                    <>
                      {" "}
                      Click <strong>Add Trailer</strong> to register your
                      first one.
                    </>
                  ) : null}
                </TableCell>
              </TableRow>
            ) : (
              trailers.map((t) => {
                const expiry = nextExpiry(today, [
                  { label: "Plate", date: t.plate_expiry },
                  { label: "Inspection", date: t.next_inspection_due },
                ])
                return (
                  <PreviewCard key={t.id}>
                    <PreviewCardTrigger
                      delay={350}
                      closeDelay={120}
                      render={
                        <TableRow
                          tabIndex={canEdit ? 0 : -1}
                          onClick={canEdit ? () => setEditing(t) : undefined}
                          onKeyDown={
                            canEdit
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    setEditing(t)
                                  }
                                }
                              : undefined
                          }
                          className={cn(
                            "transition-colors hover:bg-muted/40",
                            canEdit
                              ? "cursor-pointer focus-visible:bg-muted/40 focus-visible:outline-none"
                              : "",
                          )}
                        />
                      }
                    >
                      <TableCell className="font-mono font-medium">
                        {t.trailer_number}
                      </TableCell>
                      <TableCell>{TRAILER_TYPE_LABEL[t.type]}</TableCell>
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
                      {canEdit ? (
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditing(t)
                            }}
                          >
                            <Pencil className="size-3.5" /> Edit
                          </Button>
                        </TableCell>
                      ) : null}
                    </PreviewCardTrigger>
                    <PreviewCardContent
                      side="left"
                      align="start"
                      sideOffset={16}
                      className="w-[340px]"
                    >
                      <TrailerPreview trailer={t} today={today} />
                    </PreviewCardContent>
                  </PreviewCard>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <TrailerDialog mode="create" open={adding} onOpenChange={setAdding} />

      {editing ? (
        <TrailerDialog
          key={editing.id}
          mode="edit"
          trailer={editing}
          open={!!editing}
          onOpenChange={(o) => {
            if (!o) setEditing(null)
          }}
        />
      ) : null}
    </>
  )
}

function TrailerPreview({
  trailer,
  today,
}: {
  trailer: TrailerRow
  today: string
}) {
  const expiries = [
    { label: "Plate expiry", date: trailer.plate_expiry },
    { label: "Inspection due", date: trailer.next_inspection_due },
  ]

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-sm font-semibold">
            {trailer.trailer_number}
          </span>
          <span className="text-xs opacity-70">
            {TRAILER_TYPE_LABEL[trailer.type]}
          </span>
        </div>
        <Badge
          className={cn("border-transparent", STATUS_TONE[trailer.status])}
        >
          {EQUIPMENT_STATUS_LABEL[trailer.status]}
        </Badge>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <Field
            icon={<Hash className="size-3.5" />}
            label="Plate"
            value={
              trailer.plate
                ? `${trailer.plate}${trailer.plate_province ? ` · ${trailer.plate_province}` : ""}`
                : null
            }
          />
          <Field
            icon={<Wrench className="size-3.5" />}
            label="Last inspection"
            value={
              trailer.last_inspection_date
                ? format(parseISO(trailer.last_inspection_date), "MMM d, yyyy")
                : null
            }
          />
          {trailer.vin ? (
            <div className="col-span-2">
              <Field
                icon={<Hash className="size-3.5" />}
                label="VIN"
                value={trailer.vin}
                mono
              />
            </div>
          ) : null}
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
                    {relativeExpiryLabel(days)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {trailer.notes ? (
          <div className="flex flex-col gap-0.5 rounded-md bg-white/5 px-2.5 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
              Notes
            </span>
            <span className="line-clamp-3 text-xs">{trailer.notes}</span>
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
  mono = false,
}: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 opacity-60">{icon}</span>
      <div className="flex flex-1 flex-col gap-0.5 leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
          {label}
        </span>
        <span className={mono ? "break-all font-mono" : ""}>
          {value ?? "—"}
        </span>
      </div>
    </div>
  )
}
