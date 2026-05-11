import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

import { DriversTable, type DriverRow } from "./drivers-table"

export default async function DriversPage() {
  await requireRole(["admin", "dispatcher"])
  const supabase = await createClient()

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, employee_id, active, phone")
    .eq("role", "driver")
    .order("full_name", { ascending: true })

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Couldn&apos;t load drivers: {error.message}
      </div>
    )
  }

  const ids = (profiles ?? []).map((p) => p.id)
  const { data: compliance } = ids.length
    ? await supabase
        .from("driver_profiles")
        .select(
          "profile_id, licence_class, licence_province, licence_expiry, medical_cert_expiry, fast_card_expiry, hire_date",
        )
        .in("profile_id", ids)
    : { data: [] }

  const byId = new Map(
    (compliance ?? []).map((c) => [c.profile_id, c] as const),
  )

  const drivers: DriverRow[] = (profiles ?? []).map((p) => {
    const c = byId.get(p.id)
    return {
      id: p.id,
      full_name: p.full_name,
      employee_id: p.employee_id,
      active: p.active,
      phone: p.phone,
      licence_class: c?.licence_class ?? null,
      licence_province: c?.licence_province ?? null,
      licence_expiry: c?.licence_expiry ?? null,
      medical_cert_expiry: c?.medical_cert_expiry ?? null,
      fast_card_expiry: c?.fast_card_expiry ?? null,
      hire_date: c?.hire_date ?? null,
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Drivers</h1>
          <p className="text-sm text-muted-foreground">
            Compliance-tracked driver roster. Onboard new drivers from{" "}
            <a
              href="/admin/employees"
              className="text-brand-teal hover:underline"
            >
              Employees
            </a>
            ; their compliance row is created automatically.
          </p>
        </div>
      </header>

      <DriversTable drivers={drivers} />
    </div>
  )
}
