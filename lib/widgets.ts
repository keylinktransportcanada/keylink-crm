import "server-only"

// Live data sources for the dashboard header widgets. All endpoints are free
// and key-less so the widgets work in any environment. Failures degrade to
// `null` so the header still renders if a source is unreachable.

// ---------------------------------------------------------------------------
// Weather — Open-Meteo (no key, no auth). Toronto for the head office.
// ---------------------------------------------------------------------------

const OPEN_METEO_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=43.6532&longitude=-79.3832&current=temperature_2m,weather_code&timezone=America%2FToronto"

export type Weather = {
  tempC: number
  code: number
  label: string
  city: string
}

// WMO weather code → short label. Buckets are intentionally coarse; the widget
// pill has room for ~14 characters of subtitle.
function weatherLabel(code: number): string {
  if (code === 0) return "Clear"
  if (code <= 2) return "Mostly sunny"
  if (code === 3) return "Cloudy"
  if (code <= 48) return "Foggy"
  if (code <= 57) return "Drizzle"
  if (code <= 67) return "Rain"
  if (code <= 77) return "Snow"
  if (code <= 82) return "Showers"
  if (code <= 86) return "Snow showers"
  return "Thunderstorm"
}

export async function getTorontoWeather(): Promise<Weather | null> {
  try {
    const res = await fetch(OPEN_METEO_URL, {
      next: { revalidate: 600 }, // 10 minutes
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number }
    }
    const temp = json.current?.temperature_2m
    const code = json.current?.weather_code
    if (typeof temp !== "number" || typeof code !== "number") return null
    return {
      tempC: Math.round(temp),
      code,
      label: weatherLabel(code),
      city: "Toronto",
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Border wait — CBP public BWT feed. We surface the Ambassador Bridge
// commercial vehicle lane because that's Keylink's busiest crossing into the
// US (Detroit/Windsor corridor).
// ---------------------------------------------------------------------------

const CBP_BWT_URL = "https://bwt.cbp.gov/api/bwtnew/CrossingTimes"
// CBP's port number for Detroit-Ambassador Bridge.
const AMBASSADOR_BRIDGE_PORT = "3801"

export type BorderWait = {
  port: string
  waitMinutes: number | null // null means "no delay" or "lanes closed"
  status: string
}

type CbpCrossing = {
  port_number?: string
  port_name?: string
  commercial_vehicle_lanes?: {
    standard_lanes?: { delay_minutes?: string; operational_status?: string }
  }
}

export async function getAmbassadorBridgeWait(): Promise<BorderWait | null> {
  try {
    const res = await fetch(CBP_BWT_URL, {
      next: { revalidate: 300 }, // 5 minutes
      headers: {
        "User-Agent":
          "KeylinkCRM/1.0 (border wait widget; +https://keylinktransport.ca)",
        Accept: "application/json",
      },
    })
    if (!res.ok) return null
    const arr = (await res.json()) as CbpCrossing[]
    const port = Array.isArray(arr)
      ? arr.find((p) => p.port_number === AMBASSADOR_BRIDGE_PORT)
      : null
    if (!port) return null
    const lane = port.commercial_vehicle_lanes?.standard_lanes
    const raw = lane?.delay_minutes
    const status = lane?.operational_status ?? "Open"
    const minutes = raw === undefined ? NaN : Number(raw)
    return {
      port: "Ambassador Bridge",
      waitMinutes: Number.isFinite(minutes) ? minutes : null,
      status,
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Driver availability — how many active drivers are not currently on an
// in-progress load. Surfaced as a percentage in the header widget.
// ---------------------------------------------------------------------------

import { createClient } from "@/lib/supabase/server"

export type DriverAvailability = {
  totalActive: number
  busy: number
  free: number
  pct: number | null
}

// Statuses that mean "this driver is currently committed to a load".
const ON_LOAD_STATUSES = [
  "assigned",
  "dispatched",
  "at_pickup",
  "loaded",
  "in_transit",
  "at_delivery",
] as const

export async function getDriverAvailability(): Promise<DriverAvailability> {
  const supabase = await createClient()

  const [{ count: totalActive }, { data: busyRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "driver")
      .eq("active", true),
    supabase
      .from("loads")
      .select("driver_id")
      .in("status", ON_LOAD_STATUSES)
      .not("driver_id", "is", null),
  ])

  const total = totalActive ?? 0
  const busy = new Set((busyRows ?? []).map((r) => r.driver_id)).size
  const free = Math.max(0, total - busy)
  const pct = total > 0 ? Math.round((free / total) * 100) : null
  return { totalActive: total, busy, free, pct }
}
