"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Paperclip,
  Send,
  ShieldAlert,
  Trash2,
  TriangleAlert,
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
import { Textarea } from "@/components/ui/textarea"
import {
  LoadDocumentsDialog,
  type LoadDocument,
} from "@/components/loads/load-documents-viewer"
import { cn } from "@/lib/utils"
import {
  INSPECTION_SEVERITY_LABEL,
  INSPECTION_TYPE_LABEL,
} from "@/lib/schemas/inspections"

import {
  markInspectionCorrected,
  postInspectionMessage,
  uploadInspectionMessageDocument,
} from "@/app/(authenticated)/inspections/actions"

const MAX_MSG_ATTACHMENT_BYTES = 25 * 1024 * 1024
type PendingMsgAttachment = { localId: string; file: File }

export type InspectionAttachment = {
  id: string
  file_name: string
  mime_type: string
  size_bytes: number
  uploaded_at: string
  signed_url: string | null
}

export type InspectionMessageAttachment = {
  id: string
  file_name: string
  mime_type: string
  size_bytes: number
  uploaded_at: string
  signed_url: string | null
}

export type InspectionMessage = {
  id: string
  authorId: string
  authorName: string
  authorRole: "admin" | "dispatcher" | "driver" | "accounting"
  message: string
  createdAt: string
  attachments: InspectionMessageAttachment[]
}

export type InspectionHistoryItem = {
  id: string
  inspection_type: "pre_trip" | "post_trip" | "en_route"
  severity: "none" | "minor" | "major"
  inspection_date: string
  defects_description: string | null
  notes: string | null
  driverName: string
  correctedAt: string | null
  correctedByName: string | null
  correctedNotes: string | null
  messages: InspectionMessage[]
  attachments: InspectionAttachment[]
}

export function InspectionHistory({
  items,
  canCorrect,
  canMessage,
  pagination,
}: {
  items: InspectionHistoryItem[]
  canCorrect: boolean
  canMessage: boolean
  pagination: { currentPage: number; totalPages: number; truckId: string }
}) {
  const router = useRouter()
  const [correctTarget, setCorrectTarget] =
    useState<InspectionHistoryItem | null>(null)
  const [correctNotes, setCorrectNotes] = useState("")
  const [pending, startTransition] = useTransition()

  // Photo/file viewer (reuses the loads' dialog).
  const [viewerDocs, setViewerDocs] = useState<LoadDocument[] | null>(null)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        No inspections logged for this truck yet.
      </p>
    )
  }

  const submitCorrection = () => {
    if (!correctTarget) return
    const payload = { id: correctTarget.id, notes: correctNotes }
    startTransition(async () => {
      const result = await markInspectionCorrected(payload)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(
        "Inspection marked corrected. If no other open major defects remain, the truck is now active.",
      )
      setCorrectTarget(null)
      setCorrectNotes("")
      router.refresh()
    })
  }

  const openViewer = (item: InspectionHistoryItem, index: number) => {
    const docs: LoadDocument[] = item.attachments.map((a) => ({
      id: a.id,
      type: "inspection",
      file_name: a.file_name,
      mime_type: a.mime_type,
      size_bytes: a.size_bytes,
      uploaded_at: a.uploaded_at,
      signed_url: a.signed_url,
    }))
    setViewerDocs(docs)
    setViewerIndex(index)
  }

  return (
    <>
      <ol className="flex flex-col gap-3">
        {items.map((it) => (
          <InspectionRow
            key={it.id}
            item={it}
            canCorrect={canCorrect}
            canMessage={canMessage}
            onCorrect={() => {
              setCorrectTarget(it)
              setCorrectNotes("")
            }}
            onOpenAttachment={(index) => openViewer(it, index)}
          />
        ))}
      </ol>

      {pagination.totalPages > 1 ? (
        <Pager
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          truckId={pagination.truckId}
        />
      ) : null}

      {/* Mark corrected dialog */}
      <Dialog
        open={!!correctTarget}
        onOpenChange={(o) => {
          if (!o) {
            setCorrectTarget(null)
            setCorrectNotes("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark inspection corrected</DialogTitle>
            <DialogDescription>
              Confirms the issue has been repaired. The truck will be restored
              to <strong>active</strong> automatically if no other open major
              defects remain.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              Correction notes{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (optional — what was repaired?)
              </span>
            </label>
            <Textarea
              rows={3}
              value={correctNotes}
              onChange={(e) => setCorrectNotes(e.target.value)}
              placeholder="e.g. Replaced front-left brake pads, retested at shop."
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCorrectTarget(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={submitCorrection} disabled={pending}>
              {pending ? "Saving…" : "Mark corrected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachment viewer */}
      <LoadDocumentsDialog
        documents={viewerDocs ?? []}
        openIndex={viewerIndex}
        onClose={() => {
          setViewerIndex(null)
          setViewerDocs(null)
        }}
        onIndexChange={setViewerIndex}
      />
    </>
  )
}

function InspectionRow({
  item,
  canCorrect,
  canMessage,
  onCorrect,
  onOpenAttachment,
}: {
  item: InspectionHistoryItem
  canCorrect: boolean
  canMessage: boolean
  onCorrect: () => void
  onOpenAttachment: (index: number) => void
}) {
  const sev = item.severity
  const tone =
    sev === "major"
      ? "border-red-300 bg-red-50"
      : sev === "minor"
        ? "border-amber-300 bg-amber-50"
        : "border-emerald-200 bg-emerald-50"
  const Icon =
    sev === "major"
      ? ShieldAlert
      : sev === "minor"
        ? TriangleAlert
        : CheckCircle2
  const iconTone =
    sev === "major"
      ? "text-red-700"
      : sev === "minor"
        ? "text-amber-700"
        : "text-emerald-700"

  const isOpenMajor = sev === "major" && !item.correctedAt
  const attCount = item.attachments.length
  const imgAttCount = item.attachments.filter((a) =>
    a.mime_type.startsWith("image/"),
  ).length

  return (
    <li
      id={`inspection-${item.id}`}
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3 scroll-mt-24 target:ring-2 target:ring-brand-teal-light",
        tone,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Icon className={cn("mt-0.5 size-4 shrink-0", iconTone)} />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">
              {INSPECTION_TYPE_LABEL[item.inspection_type]} ·{" "}
              {INSPECTION_SEVERITY_LABEL[sev]}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(parseISO(item.inspection_date), "MMM d, yyyy · h:mm a")}{" "}
              · marked by{" "}
              <span className="font-medium text-foreground">
                {item.driverName}
              </span>
            </span>
          </div>
        </div>
        {isOpenMajor && canCorrect ? (
          <Button size="sm" onClick={onCorrect}>
            <ClipboardCheck className="size-4" />
            Mark corrected
          </Button>
        ) : isOpenMajor ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-800">
            Truck OOS
          </span>
        ) : null}
      </div>

      {item.defects_description ? (
        <p className="text-xs">
          <span className="font-medium">Defect: </span>
          {item.defects_description}
        </p>
      ) : null}
      {item.notes ? (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Notes: </span>
          {item.notes}
        </p>
      ) : null}

      {/* Attachment callout — clear "files attached" hint above the
          thumbnails so the admin notices them at a glance. */}
      {attCount > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-blue-300 bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-900">
            <Paperclip className="size-3" />
            {attCount} {attCount === 1 ? "file" : "files"} from driver
            {imgAttCount > 0 && imgAttCount === attCount
              ? " · all photos"
              : imgAttCount > 0
                ? ` · ${imgAttCount} photo${imgAttCount === 1 ? "" : "s"}`
                : ""}
            <span className="text-blue-900/70">· click to preview</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {item.attachments.map((att, idx) => (
              <button
                key={att.id}
                type="button"
                onClick={() => onOpenAttachment(idx)}
                title={att.file_name}
                className={cn(
                  "group relative flex size-16 items-center justify-center overflow-hidden rounded-md border border-border bg-white",
                  "transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal-light",
                )}
              >
                {att.signed_url && att.mime_type.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={att.signed_url}
                    alt=""
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : att.mime_type.startsWith("image/") ? (
                  <ImageIcon className="size-5 text-muted-foreground" />
                ) : (
                  <FileText className="size-5 text-muted-foreground" />
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Message thread */}
      <MessageThread
        inspectionId={item.id}
        messages={item.messages}
        canMessage={canMessage}
      />

      {item.correctedAt ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-100/70 px-2.5 py-1.5 text-xs text-emerald-900">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5" />
            <span>
              <span className="font-semibold">Corrected</span>{" "}
              {format(parseISO(item.correctedAt), "MMM d, yyyy · h:mm a")} · by{" "}
              <span className="font-medium">
                {item.correctedByName ?? "—"}
              </span>
            </span>
          </div>
          {item.correctedNotes ? (
            <p className="mt-1 pl-5 text-emerald-900/80">
              {item.correctedNotes}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

// Thread component used in both contexts (admin truck detail + driver
// dashboard widget). Shows messages chronologically with per-message
// attachment thumbnails, and an inline composer (with optional file picker)
// when the caller can post.
export function MessageThread({
  inspectionId,
  messages,
  canMessage,
}: {
  inspectionId: string
  messages: InspectionMessage[]
  canMessage: boolean
}) {
  const router = useRouter()
  const [draft, setDraft] = useState("")
  const [pendingFiles, setPendingFiles] = useState<PendingMsgAttachment[]>([])
  const [pending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Photo viewer for tapping a message attachment.
  const [viewerDocs, setViewerDocs] = useState<LoadDocument[] | null>(null)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const onPickFiles = (fl: FileList | null) => {
    if (!fl || fl.length === 0) return
    const next: PendingMsgAttachment[] = []
    for (const f of Array.from(fl)) {
      if (f.size > MAX_MSG_ATTACHMENT_BYTES) {
        toast.error(`${f.name} exceeds 25 MiB.`)
        continue
      }
      next.push({ localId: crypto.randomUUID(), file: f })
    }
    if (next.length > 0) setPendingFiles((p) => [...p, ...next])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }
  const removePending = (id: string) =>
    setPendingFiles((p) => p.filter((a) => a.localId !== id))

  const submit = () => {
    const text = draft.trim()
    if (!text && pendingFiles.length === 0) {
      toast.error("Add a message or a file.")
      return
    }
    startTransition(async () => {
      // Always post a message even when only files are attached — empty
      // message-only chat rows would render oddly. If the user only picked
      // files, the message body becomes a placeholder.
      const result = await postInspectionMessage({
        inspection_id: inspectionId,
        message: text || "📎 Sent files",
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      let uploaded = 0
      for (const a of pendingFiles) {
        const fd = new FormData()
        fd.set("inspection_id", inspectionId)
        fd.set("message_id", result.id)
        fd.set("file", a.file)
        const r = await uploadInspectionMessageDocument(fd)
        if ("error" in r) {
          toast.error(`${a.file.name}: ${r.error}`)
          continue
        }
        uploaded++
      }
      if (uploaded > 0) {
        toast.success(
          `Sent message with ${uploaded} attachment${uploaded === 1 ? "" : "s"}.`,
        )
      } else {
        toast.success("Message sent.")
      }
      setDraft("")
      setPendingFiles([])
      router.refresh()
    })
  }

  const openViewer = (m: InspectionMessage, index: number) => {
    const docs: LoadDocument[] = m.attachments.map((a) => ({
      id: a.id,
      type: "inspection",
      file_name: a.file_name,
      mime_type: a.mime_type,
      size_bytes: a.size_bytes,
      uploaded_at: a.uploaded_at,
      signed_url: a.signed_url,
    }))
    setViewerDocs(docs)
    setViewerIndex(index)
  }

  if (messages.length === 0 && !canMessage) return null

  return (
    <div className="flex flex-col gap-2">
      {messages.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-blue-200 bg-blue-50/70 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-900/80">
            <MessageSquare className="size-3" />
            Messages ({messages.length})
          </div>
          <ul className="flex flex-col gap-1.5">
            {messages.map((m) => (
              <li
                key={m.id}
                className="rounded-md bg-white px-2.5 py-1.5 text-xs"
              >
                <div className="flex items-baseline justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {m.authorName}
                    <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[8px] font-medium normal-case tracking-wider text-muted-foreground">
                      {m.authorRole}
                    </span>
                  </span>
                  <span className="tabular-nums">
                    {format(parseISO(m.createdAt), "MMM d · h:mm a")}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-foreground">
                  {m.message}
                </p>
                {m.attachments.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.attachments.map((a, idx) => {
                      const isImg = a.mime_type.startsWith("image/")
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => openViewer(m, idx)}
                          title={a.file_name}
                          className={cn(
                            "relative flex size-12 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40",
                            "transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal-light",
                          )}
                        >
                          {isImg && a.signed_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={a.signed_url}
                              alt=""
                              className="size-full object-cover"
                              loading="lazy"
                            />
                          ) : isImg ? (
                            <ImageIcon className="size-4 text-muted-foreground" />
                          ) : (
                            <FileText className="size-4 text-muted-foreground" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canMessage ? (
        <div className="flex flex-col gap-2">
          {/* Pending file thumbnails (before send) */}
          {pendingFiles.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {pendingFiles.map((p) => {
                const isImg = p.file.type.startsWith("image/")
                return (
                  <li
                    key={p.localId}
                    className="relative flex size-14 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-card"
                  >
                    {isImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={URL.createObjectURL(p.file)}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <FileText className="size-5 text-muted-foreground" />
                    )}
                    <button
                      type="button"
                      onClick={() => removePending(p.localId)}
                      title="Remove"
                      className="absolute -right-1 -top-1 inline-flex size-5 items-center justify-center rounded-full bg-red-500 text-white shadow"
                      aria-label="Remove attachment"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach file"
              aria-label="Attach file"
              className={cn(
                "inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground",
                "transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal-light",
              )}
            >
              <Paperclip className="size-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => onPickFiles(e.target.files)}
            />
            <Textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Reply to this inspection…"
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  submit()
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={pending || (!draft.trim() && pendingFiles.length === 0)}
            >
              <Send className="size-4" />
              {pending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      ) : null}

      <LoadDocumentsDialog
        documents={viewerDocs ?? []}
        openIndex={viewerIndex}
        onClose={() => {
          setViewerIndex(null)
          setViewerDocs(null)
        }}
        onIndexChange={setViewerIndex}
      />
    </div>
  )
}

function Pager({
  currentPage,
  totalPages,
  truckId,
}: {
  currentPage: number
  totalPages: number
  truckId: string
}) {
  const buttons: Array<number | "…"> = []
  const max = totalPages
  if (max <= 7) {
    for (let i = 1; i <= max; i++) buttons.push(i)
  } else {
    buttons.push(1)
    if (currentPage > 3) buttons.push("…")
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(max - 1, currentPage + 1)
    for (let i = start; i <= end; i++) buttons.push(i)
    if (currentPage < max - 2) buttons.push("…")
    buttons.push(max)
  }

  const linkFor = (n: number) =>
    `/trucks/${truckId}${n > 1 ? `?page=${n}` : ""}`

  return (
    <nav
      aria-label="Inspection history pages"
      className="flex items-center justify-end gap-1 pt-1"
    >
      <PagerLink
        disabled={currentPage <= 1}
        href={linkFor(currentPage - 1)}
        ariaLabel="Previous page"
      >
        <ChevronLeft className="size-3.5" />
      </PagerLink>
      {buttons.map((b, i) =>
        b === "…" ? (
          <span
            key={`gap-${i}`}
            className="px-1 text-xs text-muted-foreground"
          >
            …
          </span>
        ) : (
          <Link
            key={b}
            href={linkFor(b)}
            aria-current={b === currentPage ? "page" : undefined}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md border text-xs font-medium tabular-nums",
              b === currentPage
                ? "border-brand-navy bg-brand-navy text-white"
                : "border-border bg-card text-foreground hover:bg-muted/50",
            )}
          >
            {b}
          </Link>
        ),
      )}
      <PagerLink
        disabled={currentPage >= totalPages}
        href={linkFor(currentPage + 1)}
        ariaLabel="Next page"
      >
        <ChevronRight className="size-3.5" />
      </PagerLink>
    </nav>
  )
}

function PagerLink({
  href,
  disabled,
  ariaLabel,
  children,
}: {
  href: string
  disabled: boolean
  ariaLabel: string
  children: React.ReactNode
}) {
  if (disabled) {
    return (
      <span
        aria-label={ariaLabel}
        aria-disabled="true"
        className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground/40"
      >
        {children}
      </span>
    )
  }
  return (
    <Link
      aria-label={ariaLabel}
      href={href}
      className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted/50"
    >
      {children}
    </Link>
  )
}
