import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { format, parseISO } from "date-fns"

import { requireRole } from "@/lib/auth"
import {
  daysBetween,
  relativeExpiryLabel,
  SEVERITY_TONE,
  severityFor,
  todayInToronto,
} from "@/lib/expiry"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import {
  EntityDocumentsSection,
  type EntityDocument,
} from "@/components/shared/entity-documents-section"
import { DRIVER_DOCUMENT_TYPES } from "@/lib/schemas/documents"

import { DriverComplianceForm } from "./driver-compliance-form"

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const me = await requireRole(["admin", "dispatcher"])
  const canEdit = me.role === "admin"
  const { id } = await params

  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, employee_id, role, phone, active")
    .eq("id", id)
    .maybeSingle()

  if (error || !profile || profile.role !== "driver") {
    notFound()
  }

  const { data: dp } = await supabase
    .from("driver_profiles")
    .select("*")
    .eq("profile_id", id)
    .maybeSingle()

  const today = todayInToronto()

  const expiries: Array<{
    label: string
    date: string | null
  }> = [
    { label: "Driver licence", date: dp?.licence_expiry ?? null },
    { label: "Medical certificate", date: dp?.medical_cert_expiry ?? null },
    { label: "FAST card", date: dp?.fast_card_expiry ?? null },
  ]

  // Personal compliance docs for the driver (licence, medical, FAST card).
  // Skip anything tied to an inspection — those live on the truck history.
  const { data: rawDriverDocs } = await supabase
    .from("documents")
    .select(
      "id, type, file_path, file_name, mime_type, size_bytes, expiry_date, uploaded_at",
    )
    .eq("driver_id", id)
    .is("inspection_id", null)
    .is("inspection_message_id", null)
    .order("uploaded_at", { ascending: false })

  const driverDocuments: EntityDocument[] = []
  for (const d of rawDriverDocs ?? []) {
    const { data: signed } = await supabase.storage
      .from("load-documents")
      .createSignedUrl(d.file_path, 600)
    driverDocuments.push({
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

  const initialValues = {
    profile_id: id,
    licence_number: dp?.licence_number ?? "",
    licence_class: dp?.licence_class ?? "",
    licence_province: dp?.licence_province ?? "",
    licence_expiry: dp?.licence_expiry ?? "",
    medical_cert_expiry: dp?.medical_cert_expiry ?? "",
    fast_card_number: dp?.fast_card_number ?? "",
    fast_card_expiry: dp?.fast_card_expiry ?? "",
    abstract_last_pulled: dp?.abstract_last_pulled ?? "",
    emergency_contact_name: dp?.emergency_contact_name ?? "",
    emergency_contact_phone: dp?.emergency_contact_phone ?? "",
    hire_date: dp?.hire_date ?? "",
    notes: dp?.notes ?? "",
    pay_method: dp?.pay_method ?? ("percent_revenue" as const),
    pay_rate: Number(dp?.pay_rate ?? 0),
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/drivers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to drivers
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            {profile.full_name || "Unnamed driver"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {profile.employee_id ?? "No employee ID"}
            {profile.phone ? ` · ${profile.phone}` : ""}
            {profile.active ? "" : " · Inactive"}
          </p>
        </div>
      </header>

      {/* Compliance summary cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {expiries.map((e) => {
          if (!e.date) {
            return (
              <div
                key={e.label}
                className="flex flex-col gap-1 rounded-xl border border-dashed border-border bg-card p-4"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
                  {e.label}
                </span>
                <span className="text-sm text-muted-foreground italic">
                  not set
                </span>
              </div>
            )
          }
          const days = daysBetween(today, e.date)
          const sev = severityFor(days)
          return (
            <div
              key={e.label}
              className={cn(
                "flex flex-col gap-1 rounded-xl border p-4",
                "border-border bg-card",
              )}
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
                {e.label}
              </span>
              <span className="text-2xl font-bold tracking-tight tabular-nums text-brand-navy">
                {format(parseISO(e.date), "MMM d, yyyy")}
              </span>
              <span
                className={cn(
                  "inline-flex w-fit items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                  SEVERITY_TONE[sev],
                )}
              >
                {days < 0
                  ? `expired ${relativeExpiryLabel(days)}`
                  : relativeExpiryLabel(days)}
              </span>
            </div>
          )
        })}
      </section>

      <DriverComplianceForm initialValues={initialValues} canEdit={canEdit} />

      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Personal compliance documents
          </h2>
          <span className="text-xs text-muted-foreground">
            Driver licence, medical cert, FAST card scans.
          </span>
        </div>
        <EntityDocumentsSection
          scope="driver"
          entityId={id}
          initialDocuments={driverDocuments}
          availableTypes={DRIVER_DOCUMENT_TYPES}
          canEdit={canEdit}
          emptyHint="No personal compliance docs on file. Upload scans of the driver's licence, medical cert, and FAST card so they're available at audit time."
        />
      </section>
    </div>
  )
}
