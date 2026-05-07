"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  MapPin,
  Package,
  PackageCheck,
  Send,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react"
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
import { cn } from "@/lib/utils"

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

const STATUS_ICON: Record<Status, LucideIcon> = {
  draft: Package,
  assigned: Send,
  dispatched: Send,
  at_pickup: MapPin,
  loaded: Package,
  in_transit: Truck,
  at_delivery: MapPin,
  delivered: PackageCheck,
  invoiced: FileText,
  paid: CircleDollarSign,
  cancelled: X,
}

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

  // Split forward-progress actions from the cancellation so they render with
  // distinct visual weight (primary CTA vs subtle ghost-destructive).
  const forwardActions = candidates.filter((s) => s !== "cancelled")
  const cancelAction = candidates.find((s) => s === "cancelled")

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {forwardActions.map((s, i) => {
          const Icon = STATUS_ICON[s]
          // First forward action is the primary CTA (gold). Any additional
          // forward actions stay outlined so the next-step is unambiguous.
          const isPrimary = i === 0
          return (
            <Button
              key={s}
              size="sm"
              disabled={pending}
              onClick={() => handleClick(s)}
              className={cn(
                "gap-1.5",
                isPrimary
                  ? "bg-brand-gold text-brand-navy hover:bg-brand-gold-light"
                  : "border border-border bg-background text-foreground hover:bg-muted",
              )}
            >
              <Icon className="size-3.5" />
              {pending ? "Saving…" : `Mark ${LOAD_STATUS_LABEL[s].toLowerCase()}`}
              {isPrimary ? <ArrowRight className="size-3.5 opacity-70" /> : null}
            </Button>
          )
        })}

        {cancelAction ? (
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => handleClick(cancelAction)}
            className="ml-auto gap-1.5"
          >
            <X className="size-3.5" />
            Cancel load
          </Button>
        ) : null}
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
              {pickedStatus ? (
                <span className="inline-flex items-center gap-2">
                  {(() => {
                    const Icon = STATUS_ICON[pickedStatus]
                    return <Icon className="size-4" />
                  })()}
                  Mark {LOAD_STATUS_LABEL[pickedStatus].toLowerCase()}
                </span>
              ) : (
                ""
              )}
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
              <CheckCircle2 className="size-3.5" />
              {pending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
