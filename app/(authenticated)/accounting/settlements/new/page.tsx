import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

import { NewSettlementForm } from "./new-settlement-form"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function NewSettlementPage() {
  await requireRole(["admin", "accounting"])
  const supabase = await createClient()

  // Active drivers + their pay config — sourced from profiles + driver_profiles.
  // The form shows the configured pay method/rate so the user knows what
  // the settlement will be calculated against before they click Create.
  const { data: drivers } = await supabase
    .from("profiles")
    .select(
      `id, full_name, employee_id, active,
       driver_profiles ( pay_method, pay_rate )`,
    )
    .eq("role", "driver")
    .eq("active", true)
    .order("full_name", { ascending: true })

  const driverList = (drivers ?? []).map((d) => {
    const dp = d.driver_profiles as
      | { pay_method: string | null; pay_rate: number | null }
      | { pay_method: string | null; pay_rate: number | null }[]
      | null
    const cfg = Array.isArray(dp) ? dp[0] : dp
    return {
      id: d.id,
      full_name: d.full_name ?? "Unnamed driver",
      employee_id: d.employee_id,
      pay_method:
        (cfg?.pay_method as
          | "percent_revenue"
          | "flat_per_load"
          | "per_km"
          | null) ?? "percent_revenue",
      pay_rate: Number(cfg?.pay_rate ?? 0),
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/accounting/settlements"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to settlements
        </Link>
      </div>

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl uppercase tracking-wide text-brand-navy">
          New settlement
        </h1>
        <p className="text-sm text-muted-foreground">
          Pick a driver and a pay period. We'll preview every delivered load
          for that driver in the range that hasn't already been paid out.
        </p>
      </header>

      <NewSettlementForm drivers={driverList} />
    </div>
  )
}
