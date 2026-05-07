import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { TruckInput } from "@/lib/schemas/equipment"

import { TruckForm } from "../../truck-form"

export default async function EditTruckPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole(["admin", "dispatcher"])
  const { id } = await params

  const supabase = await createClient()
  const { data: truck } = await supabase
    .from("trucks")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (!truck) notFound()

  const initialValues: TruckInput = {
    truck_number: truck.truck_number,
    make: truck.make ?? "",
    model: truck.model ?? "",
    year: truck.year,
    status: truck.status,
    plate: truck.plate ?? "",
    plate_province: truck.plate_province ?? "",
    plate_expiry: truck.plate_expiry ?? "",
    vin: truck.vin ?? "",
    current_odometer_km: truck.current_odometer_km,
    insurance_policy: truck.insurance_policy ?? "",
    insurance_expiry: truck.insurance_expiry ?? "",
    ifta_decal_year: truck.ifta_decal_year,
    ifta_decal_expiry: truck.ifta_decal_expiry ?? "",
    safety_sticker_expiry: truck.safety_sticker_expiry ?? "",
    cvor_certificate_expiry: truck.cvor_certificate_expiry ?? "",
    notes: truck.notes ?? "",
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/trucks/${truck.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to truck
        </Link>
      </div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit{" "}
          <span className="font-mono">{truck.truck_number}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Update identity, plate, insurance, IFTA, and provincial compliance.
        </p>
      </header>

      <TruckForm
        mode={{
          kind: "edit",
          truckId: truck.id,
          initialValues,
        }}
      />
    </div>
  )
}
