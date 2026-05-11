"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
  LOAD_DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  type DocumentType,
} from "@/lib/schemas/documents"

import {
  deleteLoadDocument,
  uploadLoadDocument,
} from "@/app/(authenticated)/loads/[id]/documents/actions"

export type ExistingDocument = {
  id: string
  file_name: string
  mime_type: string
  size_bytes: number
  type: DocumentType
  uploaded_at: string
  signed_url: string | null
}

export type PendingDocument = {
  // Local-only id so we can address rows in pending state.
  localId: string
  file: File
  type: DocumentType
}

function isImage(mime: string) {
  return mime.startsWith("image/")
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

// Used in the create-load form: collects files in local state and exposes
// them to the parent via `onPendingChange`. The parent uploads them after the
// load is created. In edit mode (loadId provided), uploads are immediate.
export function LoadDocumentsSection({
  loadId,
  initialDocuments = [],
  onPendingChange,
}: {
  loadId?: string
  initialDocuments?: ExistingDocument[]
  onPendingChange?: (pending: PendingDocument[]) => void
}) {
  const router = useRouter()
  const [pending, setPending] = useState<PendingDocument[]>([])
  const [existing, setExisting] = useState<ExistingDocument[]>(initialDocuments)
  const [uploadType, setUploadType] = useState<DocumentType>("bol")
  const [busy, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    onPendingChange?.(pending)
  }, [pending, onPendingChange])

  // If the parent reloads the page after adding a doc, the initial list
  // changes — keep our state in sync.
  useEffect(() => {
    setExisting(initialDocuments)
  }, [initialDocuments])

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

    if (loadId) {
      // Edit mode: upload immediately so the user gets feedback per-file.
      startTransition(async () => {
        for (const file of Array.from(fileList)) {
          const fd = new FormData()
          fd.set("load_id", loadId)
          fd.set("type", uploadType)
          fd.set("file", file)
          const result = await uploadLoadDocument(fd)
          if ("error" in result) {
            toast.error(`${file.name}: ${result.error}`)
            continue
          }
          toast.success(`Uploaded ${file.name}`)
        }
        router.refresh()
      })
    } else {
      // Create mode: stash for upload after the load is saved.
      const next = Array.from(fileList).map((file) => ({
        localId: crypto.randomUUID(),
        file,
        type: uploadType,
      }))
      setPending((p) => [...p, ...next])
    }

    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removePending = (localId: string) =>
    setPending((p) => p.filter((d) => d.localId !== localId))

  const removeExisting = (id: string) => {
    startTransition(async () => {
      const result = await deleteLoadDocument(id)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setExisting((docs) => docs.filter((d) => d.id !== id))
      toast.success("Document removed.")
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
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
              {LOAD_DOCUMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {DOCUMENT_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
          {loadId ? "Upload file" : "Attach file"}
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

      {existing.length === 0 && pending.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
          No documents attached yet. BOLs, PODs, customs paperwork — drop them
          here so dispatch and accounting can see them later.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {existing.map((d) => (
            <DocumentRow
              key={d.id}
              type={d.type}
              fileName={d.file_name}
              mime={d.mime_type}
              size={d.size_bytes}
              previewUrl={isImage(d.mime_type) ? d.signed_url : null}
              downloadUrl={d.signed_url}
              onRemove={
                loadId ? () => removeExisting(d.id) : undefined
              }
            />
          ))}
          {pending.map((d) => (
            <DocumentRow
              key={d.localId}
              type={d.type}
              fileName={d.file.name}
              mime={d.file.type}
              size={d.file.size}
              previewUrl={
                isImage(d.file.type) ? URL.createObjectURL(d.file) : null
              }
              downloadUrl={null}
              pending
              onRemove={() => removePending(d.localId)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function DocumentRow({
  type,
  fileName,
  mime,
  size,
  previewUrl,
  downloadUrl,
  pending,
  onRemove,
}: {
  type: DocumentType
  fileName: string
  mime: string
  size: number
  previewUrl: string | null
  downloadUrl: string | null
  pending?: boolean
  onRemove?: () => void
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-md border border-border bg-card/40 p-2",
        pending && "border-dashed",
      )}
    >
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : isImage(mime) ? (
          <ImageIcon className="size-5 text-muted-foreground" />
        ) : (
          <FileText className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 leading-tight overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{fileName}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="rounded-sm bg-brand-teal/15 px-1.5 py-0.5 font-semibold text-brand-teal-light">
            {DOCUMENT_TYPE_LABEL[type]}
          </span>
          <span>{formatBytes(size)}</span>
          {pending ? <span className="italic">pending upload</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {downloadUrl ? (
          <a
            href={downloadUrl}
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
