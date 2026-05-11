import "server-only"

import type { Role } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { InspectionMessageNotice } from "@/components/shared/inspection-message-toast"

// Returns the most recent inspection-thread message addressed to the current
// user (from someone other than themselves) so the layout can pop a toast.
// Looks back 24 hours; the toast component handles per-id seen tracking via
// localStorage.
export async function getLatestInspectionMessageFor(
  userId: string,
  role: Role,
): Promise<InspectionMessageNotice | null> {
  if (role !== "admin" && role !== "dispatcher" && role !== "driver") {
    return null
  }

  const supabase = await createClient()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const baseQuery = supabase
    .from("inspection_messages")
    .select(
      `id, inspection_id, author_id, author_role, message, created_at,
       inspections!inner(truck_id, driver_id, trucks!inner(truck_number))`,
    )
    .neq("author_id", userId)
    .gte("created_at", oneDayAgo)
    .order("created_at", { ascending: false })
    .limit(1)

  const { data } =
    role === "driver"
      ? await baseQuery.eq("inspections.driver_id", userId)
      : await baseQuery

  const row = (data ?? [])[0]
  if (!row) return null

  type Insp = {
    truck_id: string
    driver_id: string
    trucks: { truck_number: string } | { truck_number: string }[] | null
  }
  type Row = {
    id: string
    inspection_id: string
    author_id: string
    author_role: "admin" | "dispatcher" | "driver" | "accounting"
    message: string
    created_at: string
    inspections: Insp | Insp[] | null
  }
  const r = row as Row
  const insp = Array.isArray(r.inspections) ? r.inspections[0] : r.inspections
  if (!insp) return null
  const truck = Array.isArray(insp.trucks) ? insp.trucks[0] : insp.trucks

  // Resolve author name in a separate query — saves us from another join hint
  // and keeps the relation count predictable.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", r.author_id)
    .maybeSingle()

  const href =
    role === "driver"
      ? `/dashboard#inspection-${r.inspection_id}`
      : `/trucks/${insp.truck_id}#inspection-${r.inspection_id}`

  return {
    id: r.id,
    authorName: profile?.full_name ?? "Member",
    authorRole: r.author_role,
    truckNumber: truck?.truck_number ?? "Truck",
    truckId: insp.truck_id,
    inspectionId: r.inspection_id,
    href,
    message: r.message,
    createdAt: r.created_at,
  }
}
