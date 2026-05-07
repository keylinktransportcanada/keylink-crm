import Link from "next/link"
import { notFound } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ChevronLeft, Pencil } from "lucide-react"

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

export default async function TruckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const me = await requireRole(["admin", "dispatcher", "accounting"])
  const canEdit = me.role === "admin" || me.role === "dispatcher"
  const { id } = await params

  const supabase = await createClient()
  const { data: truck, error } = await supabase
    .from("trucks")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error || !truck) notFound()

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

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-3xl font-semibold tracking-tight">
              {truck.truck_number}
            </h1>
            <Badge
              className={cn("border-transparent", STATUS_TONE[truck.status])}
            >
              {EQUIPMENT_STATUS_LABEL[truck.status]}
            </Badge>
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
