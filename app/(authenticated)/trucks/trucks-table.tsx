"use client"

import { useState } from "react"
import { Pencil, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

import { TruckDialog } from "./truck-dialog"

export type TruckRow = {
  id: string
  truck_number: string
  make: string | null
  model: string | null
  year: number | null
  status: (typeof EQUIPMENT_STATUS_VALUES)[number]
  notes: string | null
}

const STATUS_TONE: Record<TruckRow["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  maintenance: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  out_of_service: "bg-red-500/15 text-red-700 dark:text-red-300",
  retired: "bg-muted text-muted-foreground",
}

export function TrucksTable({
  trucks,
  canEdit,
}: {
  trucks: TruckRow[]
  canEdit: boolean
}) {
  const [editing, setEditing] = useState<TruckRow | null>(null)
  const [adding, setAdding] = useState(false)

  return (
    <>
      {canEdit ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus />
            Add Truck
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Truck #</TableHead>
              <TableHead>Make / Model</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              {canEdit ? (
                <TableHead className="text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {trucks.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 6 : 5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No trucks yet.
                  {canEdit ? (
                    <>
                      {" "}
                      Click <strong>Add Truck</strong> to register your fleet.
                    </>
                  ) : null}
                </TableCell>
              </TableRow>
            ) : (
              trucks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono font-medium">
                    {t.truck_number}
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
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {t.notes ?? "—"}
                  </TableCell>
                  {canEdit ? (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(t)}
                      >
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TruckDialog mode="create" open={adding} onOpenChange={setAdding} />

      {editing ? (
        <TruckDialog
          key={editing.id}
          mode="edit"
          truck={editing}
          open={!!editing}
          onOpenChange={(o) => {
            if (!o) setEditing(null)
          }}
        />
      ) : null}
    </>
  )
}
