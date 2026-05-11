import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import {
  INSPECTION_TYPE_LABEL,
  INSPECTION_TYPE_VALUES,
} from "@/lib/schemas/inspections"

import { InspectionForm, type InspectionFormOptions } from "./inspection-form"

import type { LOAD_STATUS_VALUES } from "@/lib/schemas/loads"

type LoadStatus = (typeof LOAD_STATUS_VALUES)[number]
const ACTIVE_STATUSES: LoadStatus[] = [
  "assigned",
  "dispatched",
  "at_pickup",
  "loaded",
  "in_transit",
  "at_delivery",
]

function isInspectionType(
  v: string | undefined,
): v is (typeof INSPECTION_TYPE_VALUES)[number] {
  return (
    v === "pre_trip" ||
    v === "post_trip" ||
    v === "en_route"
  )
}

export default async function NewInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; load?: string }>
}) {
  const me = await requireRole(["admin", "dispatcher", "driver"])
  const params = await searchParams
  const initialType = isInspectionType(params.type) ? params.type : "pre_trip"
  const supabase = await createClient()

  // Drivers see only the trucks attached to their currently-active loads —
  // that's the operating reality (no truck "checkout" in v1). Dispatch and
  // admin see every truck.
  let trucks: Array<{ id: string; truck_number: string }> = []
  let trailers: Array<{ id: string; trailer_number: string }> = []
  let activeLoads: Array<{
    id: string
    load_number: string
    truck_id: string | null
    trailer_id: string | null
  }> = []

  if (me.role === "driver") {
    const { data: myLoads } = await supabase
      .from("loads")
      .select("id, load_number, truck_id, trailer_id")
      .eq("driver_id", me.id)
      .in("status", ACTIVE_STATUSES)
      .order("pickup_date", { ascending: true, nullsFirst: false })
    activeLoads = myLoads ?? []
    const truckIds = [
      ...new Set(activeLoads.map((l) => l.truck_id).filter((v): v is string => !!v)),
    ]
    const trailerIds = [
      ...new Set(
        activeLoads.map((l) => l.trailer_id).filter((v): v is string => !!v),
      ),
    ]
    if (truckIds.length > 0) {
      const { data } = await supabase
        .from("trucks")
        .select("id, truck_number")
        .in("id", truckIds)
      trucks = data ?? []
    }
    if (trailerIds.length > 0) {
      const { data } = await supabase
        .from("trailers")
        .select("id, trailer_number")
        .in("id", trailerIds)
      trailers = data ?? []
    }
  } else {
    const [{ data: t }, { data: tr }] = await Promise.all([
      supabase
        .from("trucks")
        .select("id, truck_number")
        .neq("status", "retired")
        .order("truck_number"),
      supabase
        .from("trailers")
        .select("id, trailer_number")
        .neq("status", "retired")
        .order("trailer_number"),
    ])
    trucks = t ?? []
    trailers = tr ?? []
  }

  const options: InspectionFormOptions = {
    trucks,
    trailers,
    activeLoads,
  }

  // If the URL points at a specific load, we use that to preselect truck +
  // trailer + load id on the form.
  const loadParam = params.load
  let preselect: Partial<{
    load_id: string
    truck_id: string
    trailer_id: string
  }> = {}
  if (loadParam) {
    const matched = activeLoads.find((l) => l.id === loadParam)
    if (matched) {
      preselect = {
        load_id: matched.id,
        truck_id: matched.truck_id ?? undefined,
        trailer_id: matched.trailer_id ?? undefined,
      }
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to dashboard
        </Link>
      </div>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {INSPECTION_TYPE_LABEL[initialType]} inspection
        </h1>
        <p className="text-sm text-muted-foreground">
          Walk around the truck, check critical items, and sign before rolling.
          Major defects automatically take the truck out of service.
        </p>
      </header>

      <InspectionForm
        options={options}
        defaultType={initialType}
        preselect={preselect}
      />
    </div>
  )
}
