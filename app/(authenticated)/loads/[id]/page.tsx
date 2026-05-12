import Link from "next/link"
import { notFound } from "next/navigation"
import { format, parseISO } from "date-fns"
import {
  ChevronLeft,
  FileDown,
  MapPin,
  MessageCircle,
  Pencil,
} from "lucide-react"

import { LoadDocumentsViewer } from "@/components/loads/load-documents-viewer"
import type { DocumentType } from "@/lib/schemas/documents"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { requireRole } from "@/lib/auth"
import { cn } from "@/lib/utils"
import {
  EQUIPMENT_REQUIRED_LABEL,
  LOAD_STATUS_LABEL,
  LOAD_TYPE_LABEL,
  type LOAD_STATUS_VALUES,
} from "@/lib/schemas/loads"
import { createClient } from "@/lib/supabase/server"

import { DeleteLoadButton } from "./delete-button"
import { StatusActions } from "./status-actions"
import { TripDistancesCard } from "./trip-distances-card"

type Status = (typeof LOAD_STATUS_VALUES)[number]

const STATUS_TONE: Record<Status, string> = {
  draft: "bg-muted text-muted-foreground",
  assigned: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  dispatched: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  at_pickup: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  loaded: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  in_transit: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  at_delivery: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  invoiced: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  paid: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-300",
}

const formatCAD = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
      }).format(value)

const formatCurrency = (value: number | null, currency: string) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency,
      }).format(value)

const formatDate = (iso: string | null) => {
  if (!iso) return "—"
  try {
    return format(parseISO(iso), "PPP")
  } catch {
    return iso
  }
}

const formatDateTime = (iso: string) => {
  try {
    return format(parseISO(iso), "PPp")
  } catch {
    return iso
  }
}

export default async function LoadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const me = await requireRole(["admin", "dispatcher", "accounting", "driver"])
  const { id } = await params
  const supabase = await createClient()

  const { data: load, error } = await supabase
    .from("loads")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error || !load) {
    notFound()
  }

  const [
    { data: customer },
    { data: driver },
    { data: truck },
    { data: trailer },
    { data: events },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, contact_name, email, phone")
      .eq("id", load.customer_id)
      .maybeSingle(),
    load.driver_id
      ? supabase
          .from("profiles")
          .select("id, full_name, employee_id, phone")
          .eq("id", load.driver_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    load.truck_id
      ? supabase
          .from("trucks")
          .select("id, truck_number, make, model")
          .eq("id", load.truck_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    load.trailer_id
      ? supabase
          .from("trailers")
          .select("id, trailer_number, type")
          .eq("id", load.trailer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("load_status_events")
      .select("id, status, location_note, created_at, created_by")
      .eq("load_id", id)
      .order("created_at", { ascending: false }),
  ])

  const [{ data: documentRows }, { data: distanceRows }] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, type, file_path, file_name, mime_type, size_bytes, uploaded_at",
      )
      .eq("load_id", id)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("trip_distances")
      .select("id, jurisdiction, distance_km")
      .eq("load_id", id)
      .order("jurisdiction", { ascending: true }),
  ])

  const tripDistances = (distanceRows ?? []).map((d) => ({
    id: d.id,
    jurisdiction: d.jurisdiction,
    distance_km: Number(d.distance_km ?? 0),
  }))

  const documents = await Promise.all(
    (documentRows ?? []).map(async (d) => {
      const { data: signed } = await supabase.storage
        .from("load-documents")
        .createSignedUrl(d.file_path, 600)
      return {
        id: d.id,
        type: d.type as DocumentType,
        file_name: d.file_name,
        mime_type: d.mime_type,
        size_bytes: Number(d.size_bytes),
        uploaded_at: d.uploaded_at,
        signed_url: signed?.signedUrl ?? null,
      }
    }),
  )

  const eventActorIds = [
    ...new Set(
      (events ?? [])
        .map((e) => e.created_by)
        .filter((v): v is string => !!v),
    ),
  ]
  const { data: eventActors } = eventActorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", eventActorIds)
    : { data: [] }
  const actorById = new Map(
    (eventActors ?? []).map((p) => [p.id, p.full_name] as const),
  )

  const canEdit = me.role === "admin" || me.role === "dispatcher"
  const canDelete = me.role === "admin" || me.role === "dispatcher"
  const role = me.role
  const canInvoice =
    (role === "admin" || role === "dispatcher" || role === "accounting") &&
    (load.status === "delivered" ||
      load.status === "invoiced" ||
      load.status === "paid")

  const fxRate = Number(load.fx_rate_to_cad ?? 1)
  const enteredRate =
    load.rate_cad === null ? null : Number(load.rate_cad) / fxRate
  const enteredFuel =
    load.fuel_surcharge_cad === null
      ? null
      : Number(load.fuel_surcharge_cad) / fxRate
  const enteredAcc =
    load.accessorial_charges_cad === null
      ? null
      : Number(load.accessorial_charges_cad) / fxRate

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/loads"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to loads
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-3xl font-semibold tracking-tight">
              {load.load_number}
            </h1>
            <Badge
              className={cn("border-transparent", STATUS_TONE[load.status])}
            >
              {LOAD_STATUS_LABEL[load.status]}
            </Badge>
            {load.is_cross_border ? (
              <Badge className="border-transparent bg-brand-teal/20 text-brand-teal-light">
                Cross-border
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Created {formatDateTime(load.created_at)}
            {load.updated_at !== load.created_at
              ? ` · Updated ${formatDateTime(load.updated_at)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {load.driver_id && (role === "admin" || role === "dispatcher") ? (
            <Link
              href={`/messages?with=${load.driver_id}`}
              className={buttonVariants({ size: "sm" })}
            >
              <MessageCircle />
              Chat with driver
            </Link>
          ) : null}
          {canInvoice ? (
            <a
              href={`/loads/${load.id}/invoice`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              <FileDown />
              Invoice PDF (draft)
            </a>
          ) : null}
          {canEdit ? (
            <Link
              href={`/loads/${load.id}/edit`}
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              <Pencil />
              Edit
            </Link>
          ) : null}
          {canDelete ? (
            <DeleteLoadButton loadId={load.id} loadNumber={load.load_number} />
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          {/* Status workflow */}
          <Card title="Status workflow">
            <p className="text-sm text-muted-foreground">
              Current status:{" "}
              <span className="font-medium text-foreground">
                {LOAD_STATUS_LABEL[load.status]}
              </span>
            </p>
            <StatusActions
              loadId={load.id}
              currentStatus={load.status}
              role={role}
            />
          </Card>

          {/* Pickup & delivery */}
          <Card title="Origin & destination">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Address
                label="Origin"
                company={load.origin_company}
                address={load.origin_address}
                city={load.origin_city}
                province={load.origin_province}
                country={load.origin_country}
                date={load.pickup_date}
                dateLabel="Pickup"
              />
              <Address
                label="Destination"
                company={load.destination_company}
                address={load.destination_address}
                city={load.destination_city}
                province={load.destination_province}
                country={load.destination_country}
                date={load.delivery_date}
                dateLabel="Delivery"
              />
            </div>
          </Card>

          {/* Cargo */}
          <Card title="Cargo">
            <Grid>
              <Field label="Type" value={LOAD_TYPE_LABEL[load.load_type]} />
              <Field
                label="Equipment"
                value={
                  load.equipment_required
                    ? EQUIPMENT_REQUIRED_LABEL[
                        load.equipment_required as keyof typeof EQUIPMENT_REQUIRED_LABEL
                      ] ?? load.equipment_required
                    : "None"
                }
              />
              <Field label="Commodity" value={load.commodity} />
              <Field
                label="Weight"
                value={load.weight_kg ? `${load.weight_kg} kg` : null}
              />
              <Field label="Pieces" value={load.pieces?.toString()} />
            </Grid>
          </Card>

          {/* Rates */}
          <Card title="Rates">
            <Grid>
              <Field label="Currency" value={load.currency} />
              <Field
                label={`Line haul (${load.currency})`}
                value={formatCurrency(enteredRate, load.currency)}
              />
              <Field
                label={`Fuel surcharge (${load.currency})`}
                value={formatCurrency(enteredFuel, load.currency)}
              />
              <Field
                label={`Accessorials (${load.currency})`}
                value={formatCurrency(enteredAcc, load.currency)}
              />
              <Field
                label="Subtotal (CAD)"
                value={formatCAD(
                  load.total_billed_cad === null
                    ? null
                    : Number(load.total_billed_cad),
                )}
              />
              {Number(load.tax_rate_pct ?? 0) > 0 ? (
                <Field
                  label={`Tax @ ${Number(load.tax_rate_pct).toFixed(load.tax_rate_pct % 1 === 0 ? 0 : 2)}%${load.tax_jurisdiction ? ` (${load.tax_jurisdiction})` : ""}`}
                  value={formatCAD(Number(load.tax_amount_cad ?? 0))}
                />
              ) : (
                <Field label="Tax" value="—" />
              )}
              <Field
                label="Grand total (CAD)"
                value={formatCAD(
                  load.total_billed_cad === null
                    ? null
                    : Number(load.total_billed_cad) +
                        Number(load.tax_amount_cad ?? 0),
                )}
              />
              {load.currency !== "CAD" ? (
                <Field
                  label="FX rate"
                  value={`1 ${load.currency} = ${fxRate.toFixed(4)} CAD`}
                />
              ) : null}
            </Grid>
          </Card>

          {/* Cross-border */}
          {load.is_cross_border ? (
            <Card title="Cross-border">
              <Grid>
                <Field label="Customs broker" value={load.customs_broker} />
                <Field label="PARS pass #" value={load.pars_pass_number} />
                <Field label="ACI / ACE #" value={load.aci_aces_number} />
              </Grid>
            </Card>
          ) : null}

          {/* Trip distances — IFTA per-jurisdiction kilometres */}
          <Card title="Trip distances (IFTA)">
            <TripDistancesCard
              loadId={load.id}
              distances={tripDistances}
              canEdit={role === "admin" || role === "dispatcher" || role === "accounting"}
            />
          </Card>

          {/* Documents */}
          <Card title="Documents">
            <LoadDocumentsViewer documents={documents} />
          </Card>

          {/* References + notes */}
          <Card title="References & notes">
            <Grid>
              <Field
                label="Customer reference"
                value={load.reference_number}
              />
              <Field label="PO #" value={load.po_number} />
            </Grid>
            {load.notes ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes (driver-visible)
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{load.notes}</p>
              </div>
            ) : null}
            {load.internal_notes && (role === "admin" || role === "dispatcher" || role === "accounting") ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Internal notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {load.internal_notes}
                </p>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {/* Customer */}
          <Card title="Customer">
            {customer ? (
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{customer.name}</span>
                {customer.contact_name ? (
                  <span className="text-muted-foreground">
                    {customer.contact_name}
                  </span>
                ) : null}
                {customer.phone ? (
                  <span className="text-muted-foreground">
                    {customer.phone}
                  </span>
                ) : null}
                {customer.email ? (
                  <a
                    href={`mailto:${customer.email}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {customer.email}
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Customer not found.
              </p>
            )}
          </Card>

          {/* Assignment */}
          <Card title="Assignment">
            <Grid columns={1}>
              <Field
                label="Driver"
                value={
                  driver
                    ? `${driver.full_name || "Unnamed"}${
                        driver.employee_id ? ` · ${driver.employee_id}` : ""
                      }`
                    : null
                }
                empty="unassigned"
              />
              <Field
                label="Truck"
                value={
                  truck
                    ? `${truck.truck_number}${
                        truck.make || truck.model
                          ? ` · ${[truck.make, truck.model].filter(Boolean).join(" ")}`
                          : ""
                      }`
                    : null
                }
                empty="unassigned"
              />
              <Field
                label="Trailer"
                value={
                  trailer
                    ? `${trailer.trailer_number} · ${trailer.type.replace("_", " ")}`
                    : null
                }
                empty="unassigned"
              />
            </Grid>
          </Card>

          {/* Timeline */}
          <Card title="Status timeline">
            {events && events.length > 0 ? (
              <ol className="flex flex-col gap-3">
                {events.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-col gap-1 border-l-2 border-border pl-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={cn(
                          "border-transparent",
                          STATUS_TONE[e.status],
                        )}
                      >
                        {LOAD_STATUS_LABEL[e.status]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(e.created_at)}
                      </span>
                    </div>
                    {e.location_note ? (
                      <div className="flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 size-3" />
                        <span>{e.location_note}</span>
                      </div>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      by{" "}
                      {e.created_by
                        ? actorById.get(e.created_by) ?? "—"
                        : "system"}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                No status events yet.
              </p>
            )}
          </Card>
        </div>
      </div>
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
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

function Grid({
  children,
  columns = 2,
}: {
  children: React.ReactNode
  columns?: 1 | 2
}) {
  return (
    <div
      className={cn(
        "grid gap-x-6 gap-y-3",
        columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
      )}
    >
      {children}
    </div>
  )
}

function Field({
  label,
  value,
  empty = "—",
}: {
  label: string
  value: string | null | undefined
  empty?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm">
        {value ? value : <span className="text-muted-foreground">{empty}</span>}
      </p>
    </div>
  )
}

function Address({
  label,
  company,
  address,
  city,
  province,
  country,
  date,
  dateLabel,
}: {
  label: string
  company: string | null
  address: string | null
  city: string | null
  province: string | null
  country: string | null
  date: string | null
  dateLabel: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {company ? <p className="text-sm font-medium">{company}</p> : null}
      {address ? (
        <p className="text-sm text-muted-foreground">{address}</p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {[city, province, country].filter(Boolean).join(", ") || "—"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {dateLabel}: {formatDate(date)}
      </p>
    </div>
  )
}
