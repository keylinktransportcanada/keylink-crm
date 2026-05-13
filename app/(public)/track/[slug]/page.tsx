// Public, no-auth tracking page. Customers/shippers share or follow a
// signed slug URL to watch a load progress without an account.
// Data comes through the get_load_by_tracking_slug SECURITY DEFINER
// function so loads RLS stays locked down.

import { format, parseISO } from "date-fns"
import { notFound } from "next/navigation"
import { CheckCircle2, MapPin, Truck } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { LOAD_STATUS_LABEL } from "@/lib/schemas/loads"
import type { LoadStatus } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

type TimelineEvent = {
  status: LoadStatus
  location_note: string | null
  created_at: string
}

const STATUS_TONE: Record<LoadStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  assigned: "bg-violet-100 text-violet-700",
  dispatched: "bg-indigo-100 text-indigo-700",
  at_pickup: "bg-amber-100 text-amber-800",
  loaded: "bg-sky-100 text-sky-700",
  in_transit: "bg-blue-100 text-blue-700",
  at_delivery: "bg-orange-100 text-orange-700",
  delivered: "bg-emerald-100 text-emerald-700",
  invoiced: "bg-teal-100 text-teal-700",
  paid: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-700",
}

function placeLabel(
  city: string | null,
  province: string | null,
  country: string | null,
): string {
  return [city, province, country].filter(Boolean).join(", ") || "—"
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_load_by_tracking_slug", {
    p_slug: slug,
  })

  if (error || !data || data.length === 0) {
    notFound()
  }

  const load = data[0]
  const events = (load.events ?? []) as TimelineEvent[]

  const currentTone = STATUS_TONE[load.status] ?? "bg-slate-100 text-slate-700"

  return (
    <div className="min-h-screen bg-brand-midnight text-brand-cloud">
      {/* Header band */}
      <header className="border-b border-white/10 bg-gradient-to-br from-brand-midnight via-brand-navy to-brand-midnight">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-6 py-8">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-gold">
            Keylink Transport · Live tracking
          </span>
          <h1 className="font-display text-3xl tracking-wide text-white">
            Load {load.load_number}
          </h1>
          {load.customer_name ? (
            <p className="text-sm text-brand-cloud/80">
              Tracking shipment for{" "}
              <span className="font-medium text-white">
                {load.customer_name}
              </span>
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-8">
        {/* Status card */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                currentTone,
              )}
            >
              <Truck className="size-3.5" aria-hidden="true" />
              {LOAD_STATUS_LABEL[load.status]}
            </span>
            {load.is_cross_border ? (
              <span className="inline-flex items-center rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
                Cross-border
              </span>
            ) : null}
          </div>

          {/* Route */}
          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto_1fr]">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-cloud/60">
                Pickup
              </span>
              <span className="text-sm font-semibold text-white">
                {load.origin_company ??
                  placeLabel(
                    load.origin_city,
                    load.origin_province,
                    load.origin_country,
                  )}
              </span>
              {load.origin_company ? (
                <span className="text-xs text-brand-cloud/70">
                  {placeLabel(
                    load.origin_city,
                    load.origin_province,
                    load.origin_country,
                  )}
                </span>
              ) : null}
              {load.pickup_date ? (
                <span className="text-xs text-brand-cloud/60">
                  {format(parseISO(load.pickup_date), "EEE MMM d, yyyy")}
                </span>
              ) : null}
            </div>
            <div className="hidden items-center text-brand-teal-light sm:flex">
              →
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-cloud/60">
                Delivery
              </span>
              <span className="text-sm font-semibold text-white">
                {load.destination_company ??
                  placeLabel(
                    load.destination_city,
                    load.destination_province,
                    load.destination_country,
                  )}
              </span>
              {load.destination_company ? (
                <span className="text-xs text-brand-cloud/70">
                  {placeLabel(
                    load.destination_city,
                    load.destination_province,
                    load.destination_country,
                  )}
                </span>
              ) : null}
              {load.delivery_date ? (
                <span className="text-xs text-brand-cloud/60">
                  {format(parseISO(load.delivery_date), "EEE MMM d, yyyy")}
                </span>
              ) : null}
            </div>
          </div>

          {load.reference_number ? (
            <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-brand-cloud/70">
              <span className="font-semibold uppercase tracking-wider">
                Reference
              </span>
              <span className="font-mono text-white">
                {load.reference_number}
              </span>
            </div>
          ) : null}
        </section>

        {/* Timeline */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-cloud/70">
            Timeline
          </h2>
          {events.length === 0 ? (
            <p className="mt-3 text-sm text-brand-cloud/60">
              No timeline events yet — updates will appear here as the
              shipment moves.
            </p>
          ) : (
            <ol className="mt-4 flex flex-col gap-3">
              {events
                .slice()
                .reverse()
                .map((e, i) => (
                  <li
                    key={`${e.created_at}-${i}`}
                    className="flex items-start gap-3"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                        i === 0
                          ? "bg-brand-teal text-white"
                          : "bg-white/10 text-brand-cloud/70",
                      )}
                      aria-hidden="true"
                    >
                      {i === 0 ? (
                        <Truck className="size-3.5" />
                      ) : (
                        <CheckCircle2 className="size-3.5" />
                      )}
                    </span>
                    <div className="flex flex-col gap-0.5 leading-tight">
                      <span className="text-sm font-medium text-white">
                        {LOAD_STATUS_LABEL[e.status]}
                      </span>
                      {e.location_note ? (
                        <span className="flex items-center gap-1 text-xs text-brand-cloud/70">
                          <MapPin className="size-3" aria-hidden="true" />
                          {e.location_note}
                        </span>
                      ) : null}
                      <span className="text-[11px] tabular-nums text-brand-cloud/60">
                        {format(parseISO(e.created_at), "EEE MMM d, h:mm a")}
                      </span>
                    </div>
                  </li>
                ))}
            </ol>
          )}
        </section>

        <p className="mt-2 text-center text-[11px] text-brand-cloud/40">
          This page updates automatically as the shipment progresses. Bookmark it
          to follow along.
        </p>
      </main>
    </div>
  )
}
