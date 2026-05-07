import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

import { LoadForm, type LoadFormOptions } from "../load-form"

export default async function NewLoadPage() {
  await requireRole(["admin", "dispatcher"])
  const supabase = await createClient()

  const [customersRes, driversRes, trucksRes, trailersRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, active")
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "driver")
      .eq("active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("trucks")
      .select("id, truck_number, status")
      .neq("status", "retired")
      .order("truck_number", { ascending: true }),
    supabase
      .from("trailers")
      .select("id, trailer_number, status")
      .neq("status", "retired")
      .order("trailer_number", { ascending: true }),
  ])

  const options: LoadFormOptions = {
    customers: customersRes.data ?? [],
    drivers: driversRes.data ?? [],
    trucks: trucksRes.data ?? [],
    trailers: trailersRes.data ?? [],
  }

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
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New load</h1>
        <p className="text-sm text-muted-foreground">
          Fields you skip become editable once the load is created. Assigning
          a driver immediately moves the load from draft to assigned.
        </p>
      </header>

      <LoadForm options={options} mode={{ kind: "create" }} />
    </div>
  )
}
