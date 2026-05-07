"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  LOAD_STATUS_LABEL,
  type LOAD_STATUS_VALUES,
} from "@/lib/schemas/loads"
import type { Role } from "@/lib/auth"

import { transitionLoadStatus } from "../actions"

type Status = (typeof LOAD_STATUS_VALUES)[number]

const NEXT_FOR_STATUS: Record<Status, Status[]> = {
  draft: ["assigned", "cancelled"],
  assigned: ["dispatched", "cancelled"],
  dispatched: ["at_pickup", "cancelled"],
  at_pickup: ["loaded", "cancelled"],
  loaded: ["in_transit", "cancelled"],
  in_transit: ["at_delivery", "cancelled"],
  at_delivery: ["delivered", "cancelled"],
  delivered: ["invoiced", "cancelled"],
  invoiced: ["paid"],
  paid: [],
  cancelled: [],
}

const DRIVER_ALLOWED = new Set<Status>([
  "at_pickup",
  "loaded",
  "in_transit",
  "at_delivery",
  "delivered",
])

const ACCOUNTING_ALLOWED = new Set<Status>(["invoiced", "paid"])

function nextStatusesForRole(current: Status, role: Role): Status[] {
  const candidates = NEXT_FOR_STATUS[current]
  if (role === "driver") return candidates.filter((s) => DRIVER_ALLOWED.has(s))
  if (role === "accounting")
    return candidates.filter((s) => ACCOUNTING_ALLOWED.has(s))
  return candidates
}

export function StatusActions({
  loadId,
  currentStatus,
  role,
}: {
  loadId: string
  currentStatus: Status
  role: Role
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [pickedStatus, setPickedStatus] = useState<Status | null>(null)
  const [locationNote, setLocationNote] = useState("")

  const candidates = nextStatusesForRole(currentStatus, role)

  const apply = (status: Status, note: string) => {
    startTransition(async () => {
      const result = await transitionLoadStatus({
        id: loadId,
        status,
        location_note: note,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(`Status set to ${LOAD_STATUS_LABEL[status]}.`)
      setPickedStatus(null)
      setLocationNote("")
      router.refresh()
    })
  }

  const handleClick = (status: Status) => {
    // Drivers get a location-note prompt for operational transitions.
    if (role === "driver") {
      setPickedStatus(status)
    } else {
      apply(status, "")
    }
  }

  if (candidates.length === 0) return null

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {candidates.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={s === "cancelled" ? "destructive" : "default"}
            disabled={pending}
            onClick={() => handleClick(s)}
          >
            {pending ? "…" : `Mark ${LOAD_STATUS_LABEL[s].toLowerCase()}`}
          </Button>
        ))}
      </div>

      <Dialog
        open={!!pickedStatus}
        onOpenChange={(o) => {
          if (!o) {
            setPickedStatus(null)
            setLocationNote("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pickedStatus
                ? `Mark ${LOAD_STATUS_LABEL[pickedStatus].toLowerCase()}`
                : ""}
            </DialogTitle>
            <DialogDescription>
              Optionally add a quick location note (e.g. &quot;crossed Peace
              Bridge&quot;).
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Location note (optional)"
            value={locationNote}
            onChange={(e) => setLocationNote(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPickedStatus(null)
                setLocationNote("")
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() => pickedStatus && apply(pickedStatus, locationNote)}
            >
              {pending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
