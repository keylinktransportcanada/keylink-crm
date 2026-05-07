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
  TRAILER_TYPE_LABEL,
  type EQUIPMENT_STATUS_VALUES,
  type TRAILER_TYPE_VALUES,
} from "@/lib/schemas/equipment"

import { TrailerDialog } from "./trailer-dialog"

export type TrailerRow = {
  id: string
  trailer_number: string
  type: (typeof TRAILER_TYPE_VALUES)[number]
  status: (typeof EQUIPMENT_STATUS_VALUES)[number]
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
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              {canEdit ? (
                <TableHead className="text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {trailers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 5 : 4}
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
              trailers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono font-medium">
                    {t.trailer_number}
                  </TableCell>
                  <TableCell>{TRAILER_TYPE_LABEL[t.type]}</TableCell>
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
