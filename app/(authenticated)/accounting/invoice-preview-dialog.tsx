"use client"

// Click-to-preview invoice dialog for the /accounting invoice queue.
// Renders the same PDF the /loads/[id]/invoice route returns, inside a
// modal with a blurred backdrop. The "Mark invoiced" action posts to
// /api/loads/[id]/mark-invoiced (a regular route handler, not a server
// action) — earlier attempts to import a server action into a client
// component on this page produced a reproducible SSR crash.

import { useState } from "react"
import { CheckCircle2, Download, Loader2, Pencil, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Phase = "view" | "confirming" | "submitting" | "done" | "error"

export function InvoicePreviewDialog({
  loadId,
  loadNumber,
  customerName,
  amountLabel,
  deliveredAtLabel,
  children,
}: {
  loadId: string
  loadNumber: string
  customerName: string | null
  amountLabel: string
  deliveredAtLabel: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>("view")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState<boolean | null>(null)
  const src = `/loads/${loadId}/invoice`

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      // Reset phase next render so the dialog returns to view-mode on
      // the next open.
      setTimeout(() => {
        setPhase("view")
        setErrorMsg(null)
        setEmailSent(null)
      }, 250)
    }
  }

  const submit = async () => {
    setPhase("submitting")
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/loads/${loadId}/mark-invoiced`, {
        method: "POST",
      })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        emailSent?: boolean
      }
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }
      setEmailSent(Boolean(body.emailSent))
      setPhase("done")
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error")
      setPhase("error")
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full cursor-pointer rounded-md text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="flex h-[85vh] w-[min(900px,95vw)] max-w-[95vw] flex-col gap-0 p-0 sm:max-w-[95vw]"
        >
          <DialogHeader className="flex flex-row items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="flex flex-col gap-1">
              <DialogTitle className="font-mono text-base font-semibold">
                {loadNumber}
                {customerName ? (
                  <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">
                    · {customerName}
                  </span>
                ) : null}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {deliveredAtLabel} · {amountLabel}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={`/loads/${loadId}/edit`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
              >
                <Pencil className="size-3.5" />
                Edit load
              </a>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
              >
                <Download className="size-3.5" />
                Open / Download
              </a>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                aria-label="Close preview"
              >
                <X className="size-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden bg-muted/30">
            {open ? (
              <iframe
                src={src}
                title={`Invoice ${loadNumber}`}
                className="size-full border-0"
              />
            ) : null}
          </div>

          {/* Action bar — view → confirm → submit → done/error.
              No toast / router.refresh import — uses a full reload on
              success so the queue row drops without any client-side
              navigation hooks. */}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border bg-card px-5 py-3">
            {phase === "view" ? (
              <>
                <p className="mr-auto text-xs text-muted-foreground">
                  Review the invoice above. When ready, mark it invoiced —
                  this flips the load&apos;s status and emails the customer.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setPhase("confirming")}
                >
                  <CheckCircle2 className="size-4" />
                  Mark invoiced
                </Button>
              </>
            ) : null}

            {phase === "confirming" ? (
              <>
                <p className="mr-auto text-xs">
                  Confirm: mark <span className="font-mono">{loadNumber}</span>{" "}
                  invoiced and email the customer?
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPhase("view")}
                >
                  Back
                </Button>
                <Button type="button" size="sm" onClick={submit}>
                  <CheckCircle2 className="size-4" />
                  Confirm
                </Button>
              </>
            ) : null}

            {phase === "submitting" ? (
              <>
                <p className="mr-auto text-xs text-muted-foreground">
                  Updating status and sending email…
                </p>
                <Button type="button" size="sm" disabled>
                  <Loader2 className="size-4 animate-spin" />
                  Working…
                </Button>
              </>
            ) : null}

            {phase === "done" ? (
              <>
                <p className="mr-auto text-xs text-emerald-700">
                  <CheckCircle2 className="mr-1 inline size-3.5" />
                  Marked invoiced
                  {emailSent ? " — email sent to customer." : "."}
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    // Full reload so the queue refreshes without needing
                    // useRouter (kept this component dep-light).
                    window.location.reload()
                  }}
                >
                  Done
                </Button>
              </>
            ) : null}

            {phase === "error" ? (
              <>
                <p className="mr-auto text-xs text-destructive">
                  {errorMsg ?? "Something went wrong."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPhase("view")}
                >
                  Back
                </Button>
                <Button type="button" size="sm" onClick={submit}>
                  Retry
                </Button>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
