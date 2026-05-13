"use client"

// Trigger button for the manual "send compliance digest now" flow. Lives
// inside the compliance card on the admin dashboard. Posts to
// /api/admin/compliance-digest/send and shows a small toast on result.

import { useState } from "react"
import { Loader2, Mail } from "lucide-react"
import { toast } from "sonner"

export function SendDigestButton() {
  const [pending, setPending] = useState(false)

  const onClick = async () => {
    if (pending) return
    setPending(true)
    try {
      const res = await fetch("/api/admin/compliance-digest/send", {
        method: "POST",
      })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        totalItems?: number
        sent?: number
        failed?: number
      }
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }
      const sent = body.sent ?? 0
      const items = body.totalItems ?? 0
      toast.success(
        `Digest sent to ${sent} admin${sent === 1 ? "" : "s"} · ${items} item${items === 1 ? "" : "s"} flagged`,
      )
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Couldn't send digest: ${err.message}`
          : "Couldn't send digest.",
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300/60 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-amber-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Mail className="size-3" />
      )}
      {pending ? "Sending…" : "Email digest"}
    </button>
  )
}
