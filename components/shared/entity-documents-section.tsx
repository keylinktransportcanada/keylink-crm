"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import {
  CalendarClock,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  DOCUMENT_TYPE_LABEL,
  EXPIRY_BEARING_TYPES,
  MAX_DOCUMENT_BYTES,
  type DocumentType,
} from "@/lib/schemas/documents"
import {
  daysBetween,
  relativeExpiryLabel,
  SEVERITY_TONE,
  severityFor,
  todayInToronto,
} from "@/lib/expiry"

import {
  deleteEntityDocument,
  uploadEntityDocument,
  type DocumentScope,
} from "@/app/(authenticated)/documents/actions"

export type EntityDocument = {
  id: string
  file_name: string
  mime_type: string
  size_bytes: number
  type: DocumentType
  expiry_date: string | null
  uploaded_at: string
  signed_url: string | null
}

function isImage(mime: string) {
  return mime.startsWith("image/")
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function EntityDocumentsSection({
  scope,
  entityId,
  initialDocuments,
  availableTypes,
  canEdit,
  emptyHint,
}: {
  scope: DocumentScope
  entityId: string
  initialDocuments: EntityDocument[]
  availableTypes: DocumentType[]
  canEdit: boolean
  emptyHint?: string
}) {
  const router = useRouter()
  const [documents, setDocuments] = useState<EntityDocument[]>(initialDocuments)
  const [uploadType, setUploadType] = useState<DocumentType>(availableTypes[0])
  const [expiry, setExpiry] = useState<string>("")
  const [busy, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const today = todayInToronto()
  const showExpiryPicker = EXPIRY_BEARING_TYPES.includes(uploadType)

  const onFilesPicked = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const tooBig = Array.from(fileList).filter(
      (f) => f.size > MAX_DOCUMENT_BYTES,
    )
    if (tooBig.length > 0) {
      toast.error(
        `${tooBig[0].name} is over ${MAX_DOCUMENT_BYTES / 1024 / 1024} MiB.`,
      )
      return
    }

    startTransition(async () => {
      for (const file of Array.from(fileList)) {
        const fd = new FormData()
        fd.set("scope", scope)
        fd.set("entity_id", entityId)
        fd.set("type", uploadType)
        fd.set("file", file)
        if (showExpiryPicker && expiry) fd.set("expiry_date", expiry)
        const result = await uploadEntityDocument(fd)
        if ("error" in result) {
          toast.error(`${file.name}: ${result.error}`)
          continue
        }
        toast.success(`Uploaded ${file.name}`)
      }
      router.refresh()
    })

    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deleteEntityDocument(id)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setDocuments((docs) => docs.filter((d) => d.id !== id))
      toast.success("Document removed.")
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Document type
            </label>
            <Select
              value={uploadType}
              onValueChange={(v) => setUploadType(v as DocumentType)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue>
                  {() => DOCUMENT_TYPE_LABEL[uploadType]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DOCUMENT_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showExpiryPicker ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Expires
              </label>
              <Input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-[160px]"
              />
            </div>
          ) : null}

          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Upload file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => onFilesPicked(e.target.files)}
          />
          <p className="text-xs text-muted-foreground">
            PDF or image, up to {MAX_DOCUMENT_BYTES / 1024 / 1024} MiB each.
          </p>
        </div>
      ) : null}

      {documents.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
          {emptyHint ?? "No documents uploaded yet."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {documents.map((d) => (
            <DocumentRow
              key={d.id}
              doc={d}
              today={today}
              onRemove={canEdit ? () => remove(d.id) : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function DocumentRow({
  doc,
  today,
  onRemove,
}: {
  doc: EntityDocument
  today: string
  onRemove?: () => void
}) {
  const previewUrl = isImage(doc.mime_type) ? doc.signed_url : null
  const days = doc.expiry_date ? daysBetween(today, doc.expiry_date) : null
  const sev = days !== null ? severityFor(days) : null

  return (
    <li className="flex items-center gap-3 rounded-md border border-border bg-card/40 p-2">
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : isImage(doc.mime_type) ? (
          <ImageIcon className="size-5 text-muted-foreground" />
        ) : (
          <FileText className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 leading-tight overflow-hidden">
        <span className="truncate text-sm font-medium">{doc.file_name}</span>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="rounded-sm bg-brand-teal/15 px-1.5 py-0.5 font-semibold text-brand-teal-light">
            {DOCUMENT_TYPE_LABEL[doc.type]}
          </span>
          <span>{formatBytes(doc.size_bytes)}</span>
          {doc.expiry_date && days !== null && sev ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-semibold normal-case",
                SEVERITY_TONE[sev],
              )}
            >
              <CalendarClock className="size-3" />
              {format(parseISO(doc.expiry_date), "MMM d, yyyy")}
              <span className="opacity-70">
                · {days < 0
                  ? `expired ${relativeExpiryLabel(days)}`
                  : relativeExpiryLabel(days)}
              </span>
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {doc.signed_url ? (
          <a
            href={doc.signed_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Open"
            aria-label="Open document"
          >
            <Paperclip className="size-4" />
          </a>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
            title="Remove"
            aria-label="Remove document"
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
    </li>
  )
}
