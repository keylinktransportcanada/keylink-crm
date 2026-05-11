"use client"

import { useEffect } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { MessageSquare } from "lucide-react"
import { toast } from "sonner"

const SEEN_KEY = "keylink:inspection-message-toast-seen"

export type InspectionMessageNotice = {
  id: string                 // inspection_messages.id
  authorName: string
  authorRole: "admin" | "dispatcher" | "driver" | "accounting"
  truckNumber: string
  truckId: string
  inspectionId: string
  // Where the "Open" action should navigate. Driver gets the dashboard with
  // a hash anchor to their inspection row; admin/dispatcher get the truck
  // detail page with the same anchor so it scrolls right into view.
  href: string
  message: string
  createdAt: string
}

// Pops a sonner toast (bottom-right, closable, persistent) for the latest
// unseen inspection message. Acknowledged ids are remembered in localStorage
// so the toast doesn't re-fire on every page load.
export function InspectionMessageToast({
  notice,
}: {
  notice: InspectionMessageNotice | null
}) {
  useEffect(() => {
    if (!notice) return
    let seen: string[] = []
    try {
      const raw = window.localStorage.getItem(SEEN_KEY)
      if (raw) seen = JSON.parse(raw) as string[]
    } catch {
      seen = []
    }
    if (seen.includes(notice.id)) return

    const stamp = format(parseISO(notice.createdAt), "MMM d · h:mm a")
    const roleLabel =
      notice.authorRole === "driver"
        ? "Driver"
        : notice.authorRole === "admin"
          ? "Admin"
          : notice.authorRole === "dispatcher"
            ? "Dispatcher"
            : "Member"

    const trimmed =
      notice.message.length > 200
        ? notice.message.slice(0, 200) + "…"
        : notice.message
    toast(`${roleLabel} replied on ${notice.truckNumber}`, {
      description: (
        <div className="flex flex-col gap-1">
          <span className="text-brand-cloud">“{trimmed}”</span>
          <span className="text-[11px] text-brand-cloud/55">
            {notice.authorName} · {stamp}
          </span>
        </div>
      ),
      duration: Infinity,
      closeButton: true,
      icon: <MessageSquare className="size-4 text-brand-teal-light" />,
      action: {
        label: "Open",
        onClick: () => {
          window.location.href = notice.href
        },
      },
      onDismiss: () => persistSeen(seen, notice.id),
      onAutoClose: () => persistSeen(seen, notice.id),
    })
    persistSeen(seen, notice.id)
  }, [notice])

  // Render an offscreen prefetch link so the destination page is ready when
  // the user taps "Open" — small UX win for drivers on mobile data.
  return notice ? (
    <Link href={notice.href} prefetch className="hidden" />
  ) : null
}

function persistSeen(prev: string[], id: string) {
  if (prev.includes(id)) return
  const next = [id, ...prev].slice(0, 50)
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}
