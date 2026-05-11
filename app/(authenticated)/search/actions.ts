"use server"

import { createClient } from "@/lib/supabase/server"

export type SearchLoadHit = {
  id: string
  load_number: string
  status: string
  origin_city: string | null
  origin_province: string | null
  destination_city: string | null
  destination_province: string | null
  customer_name: string | null
}

export type SearchCustomerHit = {
  id: string
  name: string
  contact_name: string | null
}

export type SearchPersonHit = {
  id: string
  full_name: string | null
  role: string
  employee_id: string | null
}

export type SearchTruckHit = {
  id: string
  truck_number: string
  status: string
  make: string | null
  model: string | null
}

export type SearchTrailerHit = {
  id: string
  trailer_number: string
  status: string
  type: string | null
}

export type SearchResults = {
  loads: SearchLoadHit[]
  customers: SearchCustomerHit[]
  people: SearchPersonHit[]
  trucks: SearchTruckHit[]
  trailers: SearchTrailerHit[]
}

const EMPTY: SearchResults = {
  loads: [],
  customers: [],
  people: [],
  trucks: [],
  trailers: [],
}

const PER_GROUP = 6

// Escapes %, _ and , so they can't break out of an ILIKE pattern or a
// PostgREST .or() filter expression.
function escapePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, "\\$&").replace(/,/g, "")
}

export async function searchEntitiesAction(
  rawQuery: string,
): Promise<SearchResults> {
  const query = rawQuery.trim()
  if (query.length < 2) return EMPTY

  const pattern = `%${escapePattern(query)}%`
  const supabase = await createClient()

  // RLS scopes each query: drivers see only their own loads, accounting can
  // read but not write, etc. No need to gate per-role here.
  const [
    customersRes,
    peopleRes,
    trucksRes,
    trailersRes,
    loadsByNumberRes,
    loadsByCityRes,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, contact_name")
      .or(`name.ilike.${pattern},contact_name.ilike.${pattern}`)
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(PER_GROUP),
    supabase
      .from("profiles")
      .select("id, full_name, role, employee_id")
      .or(`full_name.ilike.${pattern},employee_id.ilike.${pattern}`)
      .eq("active", true)
      .order("full_name", { ascending: true })
      .limit(PER_GROUP),
    supabase
      .from("trucks")
      .select("id, truck_number, status, make, model")
      .or(`truck_number.ilike.${pattern},make.ilike.${pattern},model.ilike.${pattern}`)
      .order("truck_number", { ascending: true })
      .limit(PER_GROUP),
    supabase
      .from("trailers")
      .select("id, trailer_number, status, type")
      .or(`trailer_number.ilike.${pattern},type.ilike.${pattern}`)
      .order("trailer_number", { ascending: true })
      .limit(PER_GROUP),
    supabase
      .from("loads")
      .select(
        "id, load_number, status, origin_city, origin_province, destination_city, destination_province, customer_id",
      )
      .or(`load_number.ilike.${pattern},reference_number.ilike.${pattern},po_number.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(PER_GROUP),
    supabase
      .from("loads")
      .select(
        "id, load_number, status, origin_city, origin_province, destination_city, destination_province, customer_id",
      )
      .or(
        `origin_city.ilike.${pattern},destination_city.ilike.${pattern},origin_company.ilike.${pattern},destination_company.ilike.${pattern}`,
      )
      .order("created_at", { ascending: false })
      .limit(PER_GROUP),
  ])

  // Merge load result sets, prefer hits by number, dedupe by id.
  const loadById = new Map<
    string,
    NonNullable<typeof loadsByNumberRes.data>[number]
  >()
  for (const l of loadsByNumberRes.data ?? []) loadById.set(l.id, l)
  for (const l of loadsByCityRes.data ?? []) {
    if (loadById.size >= PER_GROUP) break
    if (!loadById.has(l.id)) loadById.set(l.id, l)
  }

  // Pull customer names for the hits we surface.
  const customerIds = [
    ...new Set(
      Array.from(loadById.values())
        .map((l) => l.customer_id)
        .filter((v): v is string => !!v),
    ),
  ]
  const { data: customerLookup } = customerIds.length
    ? await supabase
        .from("customers")
        .select("id, name")
        .in("id", customerIds)
    : { data: [] }
  const customerNameById = new Map(
    (customerLookup ?? []).map((c) => [c.id, c.name] as const),
  )

  const loads: SearchLoadHit[] = Array.from(loadById.values()).map((l) => ({
    id: l.id,
    load_number: l.load_number,
    status: l.status,
    origin_city: l.origin_city,
    origin_province: l.origin_province,
    destination_city: l.destination_city,
    destination_province: l.destination_province,
    customer_name: l.customer_id
      ? customerNameById.get(l.customer_id) ?? null
      : null,
  }))

  return {
    loads,
    customers: customersRes.data ?? [],
    people: (peopleRes.data ?? []) as SearchPersonHit[],
    trucks: (trucksRes.data ?? []) as SearchTruckHit[],
    trailers: (trailersRes.data ?? []) as SearchTrailerHit[],
  }
}
