"use client"

import { useEffect } from "react"
import { format, parseISO } from "date-fns"
import { CircleCheck } from "lucide-react"
import { toast } from "sonner"

const SEEN_KEY = "keylink:driver-corrected-seen"

export type RecentCorrection = {
  id: string
  truckNumber: string
  truckId: string
  correctedAt: string
  correctedByName: string
  correctedNotes: string | null
}

// Pops a sonner toast (bottom-right, closable) the first time a driver lands
// on the dashboard after admin has approved one of their inspections back in
// service. Acknowledged ids are tracked in localStorage so the toast doesn't
// re-fire on every page load.
export function DriverCorrectionToast({
  correction,
}: {
  correction: RecentCorrection | null
}) {
  useEffect(() => {
    if (!correction) return
    let seen: string[] = []
    try {
      const raw = window.localStorage.getItem(SEEN_KEY)
      if (raw) seen = JSON.parse(raw) as string[]
    } catch {
      seen = []
    }
    if (seen.includes(correction.id)) return

    const stamp = format(parseISO(correction.correctedAt), "MMM d · h:mm a")
    toast.success(
      `${correction.truckNumber} approved back in service`,
      {
        description: (
          (correction.correctedNotes?.trim() ||
            "Admin signed off on your inspection.") +
          ` · ${correction.correctedByName} · ${stamp}`
        ),
        duration: Infinity,
        closeButton: true,
        icon: <CircleCheck className="size-4" />,
        onDismiss: () => persistSeen(seen, correction.id),
        onAutoClose: () => persistSeen(seen, correction.id),
      },
    )
    // Mark as seen optimistically so refreshes don't re-fire even if the user
    // navigates away before tapping close.
    persistSeen(seen, correction.id)
  }, [correction])

  return null
}

function persistSeen(prev: string[], id: string) {
  if (prev.includes(id)) return
  const next = [id, ...prev].slice(0, 50)
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(next))
  } catch {
    // localStorage unavailable (private mode) — fine, toast still showed.
  }
}
