"use client"

import { useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Image as ImageIcon,
  Maximize2,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  DOCUMENT_TYPE_LABEL,
  type DocumentType,
} from "@/lib/schemas/documents"

export type LoadDocument = {
  id: string
  type: DocumentType
  file_name: string
  mime_type: string
  size_bytes: number
  uploaded_at: string
  signed_url: string | null
}

function isImage(mime: string) {
  return mime.startsWith("image/")
}

function isPdf(mime: string) {
  return mime === "application/pdf" || mime.endsWith("/pdf")
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

// Controlled, headless dialog. Used both by the load detail page (which wraps
// it with a thumbnail grid) and by the loads list table column (which puts
// inline thumbnails on each row).
export function LoadDocumentsDialog({
  documents,
  openIndex,
  onClose,
  onIndexChange,
}: {
  documents: LoadDocument[]
  openIndex: number | null
  onClose: () => void
  onIndexChange: (i: number) => void
}) {
  const active = openIndex !== null ? documents[openIndex] : null
  const next = () =>
    openIndex !== null && onIndexChange((openIndex + 1) % documents.length)
  const prev = () =>
    openIndex !== null &&
    onIndexChange((openIndex - 1 + documents.length) % documents.length)

  return (
    <Dialog open={active !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(92vh,1100px)] w-[min(92vw,1100px)] max-w-[92vw] flex-col gap-0 p-0 sm:max-w-[1100px]"
      >
        {active ? (
          <>
            <header className="flex items-center gap-3 border-b border-border px-4 py-3">
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                <h2 className="truncate text-sm font-semibold">
                  {active.file_name}
                </h2>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span className="rounded-sm bg-brand-teal/15 px-1.5 py-0.5 font-semibold text-brand-teal-light">
                    {DOCUMENT_TYPE_LABEL[active.type]}
                  </span>
                  <span>{formatBytes(active.size_bytes)}</span>
                  <span>{active.mime_type}</span>
                </div>
              </div>
              {documents.length > 1 ? (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {(openIndex ?? 0) + 1} / {documents.length}
                </span>
              ) : null}
              {active.signed_url ? (
                <a
                  href={active.signed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  <Download className="size-4" />
                  Open
                </a>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </header>

            <div className="relative flex-1 overflow-hidden bg-muted/40">
              {active.signed_url ? (
                isImage(active.mime_type) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={active.signed_url}
                    alt={active.file_name}
                    className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
                  />
                ) : isPdf(active.mime_type) ? (
                  <iframe
                    src={active.signed_url}
                    title={active.file_name}
                    className="absolute inset-0 size-full border-0"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                    <FileText className="size-10 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Preview isn&apos;t supported for this file type. Use
                      Open to download.
                    </p>
                  </div>
                )
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Couldn&apos;t generate a preview link. Try refreshing the
                  page.
                </div>
              )}

              {documents.length > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label="Previous document"
                    onClick={prev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow-md transition-colors hover:bg-background"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next document"
                    onClick={next}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow-md transition-colors hover:bg-background"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

// Detail-page version: thumbnail grid + viewer dialog.
export function LoadDocumentsViewer({
  documents,
}: {
  documents: LoadDocument[]
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No documents attached. Use the Edit page to upload BOLs, PODs, customs
        paperwork, and more.
      </p>
    )
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {documents.map((d, i) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => setActiveIndex(i)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-md border border-border bg-card/40 p-2 text-left",
                "transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal-light",
              )}
            >
              <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                {d.signed_url && isImage(d.mime_type) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.signed_url}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : isImage(d.mime_type) ? (
                  <ImageIcon className="size-5 text-muted-foreground" />
                ) : (
                  <FileText className="size-5 text-muted-foreground" />
                )}
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-brand-midnight/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <Maximize2 className="size-4 text-white" />
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-0.5 leading-tight overflow-hidden">
                <span className="truncate text-sm font-medium">
                  {d.file_name}
                </span>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span className="rounded-sm bg-brand-teal/15 px-1.5 py-0.5 font-semibold text-brand-teal-light">
                    {DOCUMENT_TYPE_LABEL[d.type]}
                  </span>
                  <span>{formatBytes(d.size_bytes)}</span>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <LoadDocumentsDialog
        documents={documents}
        openIndex={activeIndex}
        onClose={() => setActiveIndex(null)}
        onIndexChange={setActiveIndex}
      />
    </>
  )
}
