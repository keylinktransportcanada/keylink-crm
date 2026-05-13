"use client"

// Click-to-preview invoice dialog for the /accounting invoice queue.
// Renders the same PDF the /loads/[id]/invoice route returns, inside a
// modal with a blurred backdrop. Minimal client component — no server
// action imports — to keep SSR of the accounting page stable.

import { useState } from "react"
import { Download, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  // The row content acts as the trigger — passed in so the parent
  // controls the row layout.
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const src = `/loads/${loadId}/invoice`

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full cursor-pointer rounded-md text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
        showCloseButton={false}
        className="flex h-[85vh] w-[min(900px,95vw)] max-w-[95vw] flex-col gap-3 p-0 sm:max-w-[95vw]"
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
              onClick={() => setOpen(false)}
              aria-label="Close preview"
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

          {/* Inline PDF preview. Browsers ship a built-in PDF viewer for
              iframes pointing at application/pdf responses. Only mount the
              iframe when the dialog is open so the page doesn't fetch
              every preview on initial render. */}
          <div className="flex-1 overflow-hidden bg-muted/30">
            {open ? (
              <iframe
                src={src}
                title={`Invoice ${loadNumber}`}
                className="size-full border-0"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
