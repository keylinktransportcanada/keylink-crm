"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  ImageIcon,
  Paperclip,
  ShieldAlert,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  INSPECTION_SEVERITY_HINT,
  INSPECTION_SEVERITY_LABEL,
  INSPECTION_TYPE_LABEL,
  INSPECTION_TYPE_VALUES,
  inspectionSchema,
  type InspectionInput,
} from "@/lib/schemas/inspections"

import { createInspection, uploadInspectionDocument } from "../actions"

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
type PendingAttachment = { localId: string; file: File }

export type InspectionFormOptions = {
  trucks: Array<{ id: string; truck_number: string }>
  trailers: Array<{ id: string; trailer_number: string }>
  activeLoads: Array<{
    id: string
    load_number: string
    truck_id: string | null
    trailer_id: string | null
  }>
}

// Plain-language checklist shown above the severity picker. Drivers walk
// through the list mentally before answering; if anything fails, they note it
// in the description box. Future iteration could turn each item into a
// per-row checkbox stored in JSON, but Phase 5 keeps it lightweight.
const CHECKLIST = [
  "Tires, wheels, rims",
  "Brakes (air pressure, service, parking)",
  "Lights and reflectors",
  "Fluid levels (oil, coolant, washer)",
  "Steering, suspension, frame",
  "Coupling, fifth wheel, kingpin (if trailer)",
  "Cargo securement, doors",
  "Emergency equipment (triangles, fire extinguisher)",
  "Mirrors, windshield, wipers",
  "Horn, gauges, defrost",
] as const

export function InspectionForm({
  options,
  defaultType,
  preselect,
}: {
  options: InspectionFormOptions
  defaultType: (typeof INSPECTION_TYPE_VALUES)[number]
  preselect: Partial<{ load_id: string; truck_id: string; trailer_id: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onPickFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const next: PendingAttachment[] = []
    for (const f of Array.from(fileList)) {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${f.name} exceeds 25 MiB.`)
        continue
      }
      next.push({ localId: crypto.randomUUID(), file: f })
    }
    if (next.length > 0) {
      setAttachments((prev) => [...prev, ...next])
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.localId !== id))

  const form = useForm<InspectionInput>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      truck_id: preselect.truck_id ?? "",
      trailer_id: preselect.trailer_id ?? null,
      load_id: preselect.load_id ?? null,
      inspection_type: defaultType,
      severity: "none",
      defects_description: "",
      notes: "",
      signed_by_driver: false,
    },
  })

  const severity = form.watch("severity")

  const onSubmit = (values: InspectionInput) => {
    startTransition(async () => {
      const result = await createInspection(values)
      if ("error" in result) {
        const formError = result.error._form?.[0]
        if (formError) toast.error(formError)
        for (const [field, messages] of Object.entries(result.error)) {
          if (field === "_form") continue
          if (messages && messages.length > 0) {
            form.setError(field as keyof InspectionInput, {
              message: messages[0],
            })
          }
        }
        return
      }

      // Upload any attached photos / files now that we have an inspection id.
      if (attachments.length > 0) {
        let uploaded = 0
        for (const a of attachments) {
          const fd = new FormData()
          fd.set("inspection_id", result.id)
          fd.set("file", a.file)
          const r = await uploadInspectionDocument(fd)
          if ("error" in r) {
            toast.error(`${a.file.name}: ${r.error}`)
            continue
          }
          uploaded++
        }
        if (uploaded > 0) {
          toast.success(
            `Uploaded ${uploaded} attachment${uploaded === 1 ? "" : "s"}.`,
          )
        }
      }

      if (result.severity === "major") {
        toast.warning(
          "Major defect logged. Truck has been taken out of service — dispatch will be notified.",
          { duration: 6000 },
        )
      } else if (result.severity === "minor") {
        toast.success("Inspection saved with a minor defect noted.")
      } else {
        toast.success("Inspection saved. Safe to roll.")
      }
      router.push("/dashboard")
      router.refresh()
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        {/* Type + load + truck/trailer */}
        <Section title="What are you inspecting?">
          <FormField
            control={form.control}
            name="inspection_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Inspection type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string | null) =>
                          v
                            ? INSPECTION_TYPE_LABEL[
                                v as keyof typeof INSPECTION_TYPE_LABEL
                              ] ?? v
                            : ""
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {INSPECTION_TYPE_VALUES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {INSPECTION_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {options.activeLoads.length > 0 ? (
            <FormField
              control={form.control}
              name="load_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Linked load{" "}
                    <span className="text-xs text-muted-foreground">
                      (optional)
                    </span>
                  </FormLabel>
                  <Select
                    value={field.value ?? "_none"}
                    onValueChange={(v) => {
                      const next = v === "_none" ? null : v
                      field.onChange(next)
                      // When a load is picked, auto-fill truck and trailer.
                      const matched = options.activeLoads.find(
                        (l) => l.id === next,
                      )
                      if (matched) {
                        if (matched.truck_id)
                          form.setValue("truck_id", matched.truck_id)
                        form.setValue("trailer_id", matched.trailer_id ?? null)
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            if (!v || v === "_none") return "Not load-linked"
                            const m = options.activeLoads.find((l) => l.id === v)
                            return m ? m.load_number : v
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none">Not load-linked</SelectItem>
                      {options.activeLoads.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.load_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          <FormField
            control={form.control}
            name="truck_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Truck</FormLabel>
                <Select
                  value={field.value || ""}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pick a truck…">
                        {(v: string | null) =>
                          v
                            ? options.trucks.find((t) => t.id === v)
                                ?.truck_number ?? "—"
                            : "Pick a truck…"
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {options.trucks.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No active trucks linked to your loads.
                      </div>
                    ) : (
                      options.trucks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.truck_number}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="trailer_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Trailer{" "}
                  <span className="text-xs text-muted-foreground">
                    (if attached)
                  </span>
                </FormLabel>
                <Select
                  value={field.value ?? "_none"}
                  onValueChange={(v) =>
                    field.onChange(v === "_none" ? null : v)
                  }
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string | null) =>
                          !v || v === "_none"
                            ? "No trailer"
                            : options.trailers.find((t) => t.id === v)
                                ?.trailer_number ?? "—"
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="_none">No trailer</SelectItem>
                    {options.trailers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.trailer_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        {/* Checklist */}
        <Section
          title="Walkaround checklist"
          description="Mentally tick each item. Anything failing goes in the defect notes below."
        >
          <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
            {CHECKLIST.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Severity */}
        <Section title="What did you find?">
          <FormField
            control={form.control}
            name="severity"
            render={({ field }) => (
              <FormItem>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(["none", "minor", "major"] as const).map((s) => {
                    const active = field.value === s
                    const Icon =
                      s === "none"
                        ? CheckCircle2
                        : s === "minor"
                          ? AlertTriangle
                          : ShieldAlert
                    return (
                      <button
                        type="button"
                        key={s}
                        onClick={() => field.onChange(s)}
                        className={cn(
                          "flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors",
                          "min-h-[88px]",
                          active
                            ? s === "major"
                              ? "border-red-500 bg-red-50 text-red-900"
                              : s === "minor"
                                ? "border-amber-500 bg-amber-50 text-amber-900"
                                : "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-border bg-card hover:bg-muted/40",
                        )}
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <Icon className="size-4 shrink-0" />
                          {INSPECTION_SEVERITY_LABEL[s]}
                        </span>
                        <span className="text-xs leading-snug opacity-80">
                          {INSPECTION_SEVERITY_HINT[s]}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {severity !== "none" ? (
            <FormField
              control={form.control}
              name="defects_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Defect description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="What's wrong? Where? Anything dispatch should know?"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Notes{" "}
                  <span className="text-xs text-muted-foreground">
                    (optional)
                  </span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    placeholder="Anything else worth recording?"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        {/* Attachments — optional photos / PDFs of the defect. */}
        <Section
          title="Photos & files"
          description="Optional. Snap a photo of the defect or attach a shop report — admins see these on top of the inspection record."
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border border-dashed border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted/40",
              )}
            >
              <Paperclip className="size-4" />
              Add photo or file
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
            <p className="text-xs text-muted-foreground">
              JPG / PNG / HEIC / PDF. Up to 25 MiB each.
            </p>
          </div>

          {attachments.length > 0 ? (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {attachments.map((a) => {
                const isImage = a.file.type.startsWith("image/")
                return (
                  <li
                    key={a.localId}
                    className="flex items-center gap-3 rounded-md border border-border bg-card/40 p-2"
                  >
                    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={URL.createObjectURL(a.file)}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <FileText className="size-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5 leading-tight overflow-hidden">
                      <span className="truncate text-sm font-medium">
                        {a.file.name}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {(a.file.size / 1024).toFixed(0)} KB · pending upload
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.localId)}
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600"
                      aria-label="Remove"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </Section>

        {/* Sign */}
        <Section title="Sign">
          <FormField
            control={form.control}
            name="signed_by_driver"
            render={({ field }) => (
              <FormItem>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="mt-1 size-5"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold">
                      I certify this inspection is complete and accurate.
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Required by Canadian NSC and US FMCSA. The inspection
                      will be timestamped on save.
                    </span>
                  </span>
                </label>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <div className="sticky bottom-0 -mx-2 flex justify-end gap-2 border-t border-border bg-background/95 px-2 py-3 backdrop-blur">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Submit inspection"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card/40 p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}
