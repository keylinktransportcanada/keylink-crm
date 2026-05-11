import Link from "next/link"
import { notFound } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ChevronLeft, Pencil, ShieldAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { requireRole } from "@/lib/auth"
import {
  EQUIPMENT_STATUS_LABEL,
  type EQUIPMENT_STATUS_VALUES,
} from "@/lib/schemas/equipment"
import {
  daysBetween,
  relativeExpiryLabel,
  SEVERITY_TONE,
  severityFor,
  todayInToronto,
} from "@/lib/expiry"
import { regionLabel } from "@/lib/regions"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

import {
  EntityDocumentsSection,
  type EntityDocument,
} from "@/components/shared/entity-documents-section"
import {
  MaintenanceSection,
  type MaintenanceRecord,
} from "@/components/shared/maintenance-section"
import { TRUCK_DOCUMENT_TYPES } from "@/lib/schemas/documents"

import {
  InspectionHistory,
  type InspectionHistoryItem,
} from "./inspection-history"

type TruckStatus = (typeof EQUIPMENT_STATUS_VALUES)[number]

const STATUS_TONE: Record<TruckStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  maintenance: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  out_of_service: "bg-red-500/15 text-red-700 dark:text-red-300",
  retired: "bg-muted text-muted-foreground",
}

const formatDate = (iso: string | null) => {
  if (!iso) return "—"
  try {
    return format(parseISO(iso), "PPP")
  } catch {
    return iso
  }
}

const HISTORY_PAGE_SIZE = 3

export default async function TruckDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const me = await requireRole(["admin", "dispatcher", "accounting"])
  const canEdit = me.role === "admin" || me.role === "dispatcher"
  const { id } = await params
  const sp = await searchParams
  const pageNum = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)

  const supabase = await createClient()
  const { data: truck, error } = await supabase
    .from("trucks")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error || !truck) notFound()

  // Inspection history for this truck — paginated to keep the page tight.
  // We fetch a single page of HISTORY_PAGE_SIZE rows + the total count for
  // the pager controls.
  const fromIdx = (pageNum - 1) * HISTORY_PAGE_SIZE
  const toIdx = fromIdx + HISTORY_PAGE_SIZE - 1
  const { data: rawInspections, count: inspectionsCount } = await supabase
    .from("inspections")
    .select(
      `id, inspection_type, severity, inspection_date, defects_description,
       notes, driver_id, corrected_at, corrected_by, corrected_notes`,
      { count: "exact" },
    )
    .eq("truck_id", id)
    .order("inspection_date", { ascending: false })
    .range(fromIdx, toIdx)

  const totalInspections = inspectionsCount ?? 0
  const totalPages =
    Math.max(1, Math.ceil(totalInspections / HISTORY_PAGE_SIZE))

  // Pull every message on the displayed inspections so we can render the
  // thread chronologically inside each row.
  const inspectionIdsForMessages = (rawInspections ?? []).map((r) => r.id)
  const { data: rawMessages } = inspectionIdsForMessages.length
    ? await supabase
        .from("inspection_messages")
        .select("id, inspection_id, author_id, author_role, message, created_at")
        .in("inspection_id", inspectionIdsForMessages)
        .order("created_at", { ascending: true })
    : { data: [] }

  // Per-message attachments — joined to messages for the thread render.
  const messageIds = (rawMessages ?? []).map((m) => m.id)
  const { data: rawMessageAttachments } = messageIds.length
    ? await supabase
        .from("documents")
        .select(
          "id, inspection_message_id, file_path, file_name, mime_type, size_bytes, uploaded_at",
        )
        .in("inspection_message_id", messageIds)
        .order("uploaded_at", { ascending: true })
    : { data: [] }
  const msgAttachmentsByMessage = new Map<
    string,
    Array<{
      id: string
      file_name: string
      mime_type: string
      size_bytes: number
      uploaded_at: string
      signed_url: string | null
    }>
  >()
  for (const att of rawMessageAttachments ?? []) {
    if (!att.inspection_message_id) continue
    const { data: signed } = await supabase.storage
      .from("load-documents")
      .createSignedUrl(att.file_path, 600)
    const list = msgAttachmentsByMessage.get(att.inspection_message_id) ?? []
    list.push({
      id: att.id,
      file_name: att.file_name,
      mime_type: att.mime_type,
      size_bytes: Number(att.size_bytes),
      uploaded_at: att.uploaded_at,
      signed_url: signed?.signedUrl ?? null,
    })
    msgAttachmentsByMessage.set(att.inspection_message_id, list)
  }

  const involvedIds = [
    ...new Set(
      [
        ...(rawInspections ?? []).flatMap((r) =>
          [r.driver_id, r.corrected_by].filter((v): v is string => !!v),
        ),
        ...(rawMessages ?? []).map((m) => m.author_id),
      ],
    ),
  ]
  const { data: involvedProfiles } = involvedIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", involvedIds)
    : { data: [] }
  const nameById = new Map(
    (involvedProfiles ?? []).map(
      (p) => [p.id, p.full_name ?? "Unnamed"] as const,
    ),
  )

  type LocalMsg = {
    id: string
    authorId: string
    authorName: string
    authorRole: "admin" | "dispatcher" | "driver" | "accounting"
    message: string
    createdAt: string
    attachments: Array<{
      id: string
      file_name: string
      mime_type: string
      size_bytes: number
      uploaded_at: string
      signed_url: string | null
    }>
  }
  const messagesByInspection = new Map<string, LocalMsg[]>()
  for (const m of rawMessages ?? []) {
    const list = messagesByInspection.get(m.inspection_id) ?? []
    list.push({
      id: m.id,
      authorId: m.author_id,
      authorName: nameById.get(m.author_id) ?? "—",
      authorRole: m.author_role,
      message: m.message,
      createdAt: m.created_at,
      attachments: msgAttachmentsByMessage.get(m.id) ?? [],
    })
    messagesByInspection.set(m.inspection_id, list)
  }

  // Attachments for the displayed inspections — image thumbnails / PDFs the
  // driver uploaded with the report. Sign URLs (10 min) so the admin can
  // open them inline.
  const inspectionIds = (rawInspections ?? []).map((r) => r.id)
  const { data: rawAttachments } = inspectionIds.length
    ? await supabase
        .from("documents")
        .select(
          "id, inspection_id, type, file_path, file_name, mime_type, size_bytes, uploaded_at",
        )
        .in("inspection_id", inspectionIds)
        .order("uploaded_at", { ascending: true })
    : { data: [] }
  const attachmentsByInspection = new Map<
    string,
    Array<{
      id: string
      file_name: string
      mime_type: string
      size_bytes: number
      uploaded_at: string
      signed_url: string | null
    }>
  >()
  for (const att of rawAttachments ?? []) {
    if (!att.inspection_id) continue
    const { data: signed } = await supabase.storage
      .from("load-documents")
      .createSignedUrl(att.file_path, 600)
    const list = attachmentsByInspection.get(att.inspection_id) ?? []
    list.push({
      id: att.id,
      file_name: att.file_name,
      mime_type: att.mime_type,
      size_bytes: Number(att.size_bytes),
      uploaded_at: att.uploaded_at,
      signed_url: signed?.signedUrl ?? null,
    })
    attachmentsByInspection.set(att.inspection_id, list)
  }

  const inspectionItems: InspectionHistoryItem[] = (rawInspections ?? []).map(
    (r) => ({
      id: r.id,
      inspection_type: r.inspection_type,
      severity: r.severity,
      inspection_date: r.inspection_date,
      defects_description: r.defects_description,
      notes: r.notes,
      driverName: nameById.get(r.driver_id) ?? "Unknown driver",
      correctedAt: r.corrected_at,
      correctedByName: r.corrected_by
        ? nameById.get(r.corrected_by) ?? null
        : null,
      correctedNotes: r.corrected_notes,
      messages: messagesByInspection.get(r.id) ?? [],
      attachments: attachmentsByInspection.get(r.id) ?? [],
    }),
  )

  const today = todayInToronto()
  const expiries = [
    { key: "plate_expiry", label: "Plate", date: truck.plate_expiry },
    { key: "insurance_expiry", label: "Insurance", date: truck.insurance_expiry },
    { key: "ifta_decal_expiry", label: "IFTA decal", date: truck.ifta_decal_expiry },
    {
      key: "safety_sticker_expiry",
      label: "Safety sticker",
      date: truck.safety_sticker_expiry,
    },
    {
      key: "cvor_certificate_expiry",
      label: "CVOR certificate",
      date: truck.cvor_certificate_expiry,
    },
  ]

  const isOOS = truck.status === "out_of_service"
  const openMajor = inspectionItems.find(
    (i) => i.severity === "major" && !i.correctedAt,
  )

  // Truck-scoped documents — insurance, registration, inspection PDFs, etc.
  // Excludes inspection-attached docs (those are scoped to inspection_id).
  const { data: rawTruckDocs } = await supabase
    .from("documents")
    .select(
      "id, type, file_path, file_name, mime_type, size_bytes, expiry_date, uploaded_at",
    )
    .eq("truck_id", id)
    .is("inspection_id", null)
    .is("inspection_message_id", null)
    .order("uploaded_at", { ascending: false })

  const truckDocuments: EntityDocument[] = []
  for (const d of rawTruckDocs ?? []) {
    const { data: signed } = await supabase.storage
      .from("load-documents")
      .createSignedUrl(d.file_path, 600)
    truckDocuments.push({
      id: d.id,
      file_name: d.file_name,
      mime_type: d.mime_type,
      size_bytes: Number(d.size_bytes),
      type: d.type,
      expiry_date: d.expiry_date,
      uploaded_at: d.uploaded_at,
      signed_url: signed?.signedUrl ?? null,
    })
  }

  // Maintenance log — every recorded service for this truck, newest first.
  const { data: rawMaintenance } = await supabase
    .from("maintenance_records")
    .select(
      `id, service_type, service_date, odometer_km, cost_cad, vendor,
       description, next_due_date, next_due_odometer_km, created_by`,
    )
    .eq("truck_id", id)
    .order("service_date", { ascending: false })

  const maintenanceCreatorIds = [
    ...new Set(
      (rawMaintenance ?? [])
        .map((r) => r.created_by)
        .filter((v): v is string => !!v),
    ),
  ]
  const { data: maintenanceCreators } = maintenanceCreatorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", maintenanceCreatorIds)
    : { data: [] }
  const maintenanceCreatorById = new Map(
    (maintenanceCreators ?? []).map(
      (p) => [p.id, p.full_name ?? null] as const,
    ),
  )
  const maintenanceRecords: MaintenanceRecord[] = (rawMaintenance ?? []).map(
    (r) => ({
      id: r.id,
      service_type: r.service_type,
      service_date: r.service_date,
      odometer_km: r.odometer_km,
      cost_cad: r.cost_cad === null ? null : Number(r.cost_cad),
      vendor: r.vendor,
      description: r.description,
      next_due_date: r.next_due_date,
      next_due_odometer_km: r.next_due_odometer_km,
      created_by_name: r.created_by
        ? maintenanceCreatorById.get(r.created_by) ?? null
        : null,
    }),
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/trucks"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to trucks
        </Link>
      </div>

      {isOOS ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 shadow-[0_1px_2px_rgba(220,38,38,0.08),0_8px_24px_-12px_rgba(220,38,38,0.25)]">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-500 text-white">
            <ShieldAlert className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-sm font-semibold text-red-900">
              Truck is out of service
            </p>
            <p className="text-xs text-red-800/85">
              Don&apos;t assign this truck to any new loads.{" "}
              {openMajor ? (
                <>
                  An open major defect was logged by{" "}
                  <span className="font-semibold">{openMajor.driverName}</span>.
                  Mark the inspection corrected below to put it back in
                  service.
                </>
              ) : (
                <>
                  Status was set manually — switch it back from the Edit page
                  once the issue is resolved.
                </>
              )}
            </p>
          </div>
        </div>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-3xl font-semibold tracking-tight">
              {truck.truck_number}
            </h1>
            {isOOS ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-red-400 bg-red-500 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                <ShieldAlert className="size-3.5" />
                Out of service
              </span>
            ) : (
              <Badge
                className={cn(
                  "border-transparent",
                  STATUS_TONE[truck.status],
                )}
              >
                {EQUIPMENT_STATUS_LABEL[truck.status]}
              </Badge>
            )}
          </div>
          {truck.make || truck.model || truck.year ? (
            <p className="text-sm text-muted-foreground">
              {[truck.year, truck.make, truck.model].filter(Boolean).join(" ")}
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <Link
            href={`/trucks/${truck.id}/edit`}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            <Pencil />
            Edit
          </Link>
        ) : null}
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Inspection history
          </h2>
          <span className="text-xs text-muted-foreground">
            {totalInspections === 0
              ? "No inspections yet."
              : `${totalInspections} total · page ${pageNum} of ${totalPages}`}
          </span>
        </div>
        <InspectionHistory
          items={inspectionItems}
          canCorrect={me.role === "admin"}
          canMessage={me.role === "admin" || me.role === "dispatcher"}
          pagination={{
            currentPage: pageNum,
            totalPages,
            truckId: id,
          }}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Compliance summary
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {expiries.map((e) => {
            if (!e.date) {
              return (
                <div
                  key={e.key}
                  className="flex flex-col gap-1 rounded-lg border border-dashed border-border bg-muted/20 p-3"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {e.label}
                  </span>
                  <span className="text-sm text-muted-foreground italic">
                    Not set
                  </span>
                </div>
              )
            }
            const days = daysBetween(today, e.date)
            const severity = severityFor(days)
            return (
              <div
                key={e.key}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border border-transparent p-3",
                  SEVERITY_TONE[severity],
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                  {e.label}
                </span>
                <span className="text-sm font-semibold">
                  {format(parseISO(e.date), "MMM d, yyyy")}
                </span>
                <span className="text-xs opacity-70">
                  {days < 0
                    ? `expired ${relativeExpiryLabel(days)}`
                    : `expires ${relativeExpiryLabel(days)}`}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Documents
          </h2>
          <span className="text-xs text-muted-foreground">
            Insurance certs, registration, safety paperwork.
          </span>
        </div>
        <EntityDocumentsSection
          scope="truck"
          entityId={id}
          initialDocuments={truckDocuments}
          availableTypes={TRUCK_DOCUMENT_TYPES}
          canEdit={canEdit}
          emptyHint="No truck documents on file. Upload insurance, registration, IFTA decal, or safety inspection PDFs so dispatch and the driver can pull them on the road."
        />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Maintenance log
          </h2>
          <span className="text-xs text-muted-foreground">
            Service history with next-due reminders.
          </span>
        </div>
        <MaintenanceSection
          truckId={id}
          currentOdometerKm={truck.current_odometer_km}
          records={maintenanceRecords}
          canEdit={canEdit}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Plate & VIN">
          <Grid>
            <Field label="Plate #" value={truck.plate} />
            <Field
              label="Jurisdiction"
              value={
                truck.plate_province
                  ? regionLabel("CA", truck.plate_province) ||
                    regionLabel("US", truck.plate_province) ||
                    truck.plate_province
                  : null
              }
            />
            <Field
              label="Plate expiry"
              value={formatDate(truck.plate_expiry)}
            />
            <Field label="VIN" value={truck.vin} mono />
            <Field
              label="Odometer"
              value={
                truck.current_odometer_km
                  ? `${Number(truck.current_odometer_km).toLocaleString()} km`
                  : null
              }
            />
          </Grid>
        </Card>

        <Card title="Insurance">
          <Grid>
            <Field label="Policy #" value={truck.insurance_policy} mono />
            <Field
              label="Expiry"
              value={formatDate(truck.insurance_expiry)}
            />
          </Grid>
        </Card>

        <Card title="IFTA decal">
          <Grid>
            <Field label="Decal year" value={truck.ifta_decal_year?.toString()} />
            <Field
              label="Decal expiry"
              value={formatDate(truck.ifta_decal_expiry)}
            />
          </Grid>
        </Card>

        <Card title="Provincial compliance">
          <Grid>
            <Field
              label="Safety sticker expiry"
              value={formatDate(truck.safety_sticker_expiry)}
            />
            <Field
              label="CVOR certificate expiry"
              value={formatDate(truck.cvor_certificate_expiry)}
            />
          </Grid>
        </Card>
      </div>

      {truck.notes ? (
        <section className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Notes
          </h2>
          <p className="whitespace-pre-wrap text-sm">{truck.notes}</p>
        </section>
      ) : null}
    </div>
  )
}

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {children}
    </div>
  )
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn("text-sm", mono && "font-mono")}>
        {value ? value : <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  )
}
