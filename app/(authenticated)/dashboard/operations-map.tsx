"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { geoAlbers, geoPath } from "d3-geo"
import { feature } from "topojson-client"
import type { Feature, FeatureCollection, Geometry } from "geojson"
import type { Topology } from "topojson-specification"
import { Map as MapIcon } from "lucide-react"

import countries110m from "@/lib/geo/countries-110m.json"
import { Badge } from "@/components/ui/badge"
import {
  LOAD_STATUS_LABEL,
  type LOAD_STATUS_VALUES,
} from "@/lib/schemas/loads"
import { cn } from "@/lib/utils"

type LoadStatus = (typeof LOAD_STATUS_VALUES)[number]

export type MapPoint = {
  id: string
  loadNumber: string
  status: LoadStatus
  origin: [number, number]
  destination: [number, number]
  isCrossBorder: boolean
  customerName: string | null
  driverName: string | null
  pickupDate: string | null
  totalBilledCad: number | null
  originLabel: string
  destinationLabel: string
}

type Filter = "active" | "today" | "week"

const ACTIVE_STATUSES = new Set<LoadStatus>([
  "assigned",
  "dispatched",
  "at_pickup",
  "loaded",
  "in_transit",
  "at_delivery",
])

const STATUS_TONE_GLASS: Record<LoadStatus, string> = {
  draft: "bg-white/10 text-brand-cloud/70",
  assigned: "bg-blue-400/20 text-blue-100",
  dispatched: "bg-blue-400/20 text-blue-100",
  at_pickup: "bg-amber-400/25 text-amber-100",
  loaded: "bg-amber-400/25 text-amber-100",
  in_transit: "bg-indigo-400/25 text-indigo-100",
  at_delivery: "bg-amber-400/25 text-amber-100",
  delivered: "bg-emerald-400/25 text-emerald-100",
  invoiced: "bg-emerald-400/25 text-emerald-100",
  paid: "bg-emerald-500/30 text-emerald-50",
  cancelled: "bg-red-400/25 text-red-100",
}

const W = 800
const H = 500

// One-time topojson → geojson conversion at module scope. Only Canada (124),
// USA (840), and Mexico (484) are kept; everything else is dropped from the
// FeatureCollection so the projection's fitSize tightens around North America.
const allFeatures = feature(
  countries110m as unknown as Topology,
  (countries110m as unknown as Topology).objects.countries,
) as FeatureCollection<Geometry, { name: string }>

const NA_IDS = new Set(["124", "840", "484"])
const naFeatures: FeatureCollection<Geometry, { name: string }> = {
  type: "FeatureCollection",
  features: allFeatures.features.filter((f) => NA_IDS.has(String(f.id))),
}

const projection = geoAlbers()
  .rotate([100, 0])
  .center([0, 12])
  .parallels([29.5, 55])
projection.fitExtent(
  [
    [16, 16],
    [W - 16, H - 16],
  ],
  naFeatures,
)
const path = geoPath(projection)

// Round to 3 decimals (~1/1000 of a viewBox unit, well below sub-pixel) so
// SSR and client hydration agree exactly. d3-geo's floating-point arithmetic
// drifts in the last few decimals between Node and V8, which otherwise trips
// React's hydration mismatch warning on every <circle cx/cy> and <path d>.
const round3 = (n: number) => Math.round(n * 1000) / 1000

type CountryPath = { id: string; d: string }
const countryPaths: CountryPath[] = naFeatures.features
  .map((f): CountryPath | null => {
    const raw = path(f as Feature<Geometry>)
    if (!raw) return null
    // Quantize every number in the d-string.
    const d = raw.replace(/-?\d+\.\d+/g, (m) => round3(parseFloat(m)).toString())
    return { id: String(f.id), d }
  })
  .filter((v): v is CountryPath => v !== null)

function project(coord: [number, number]): [number, number] | null {
  const p = projection(coord)
  return p ? [round3(p[0]), round3(p[1])] : null
}

const formatCAD = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0,
      }).format(value)

type ProjectedPoint = MapPoint & {
  ox: number
  oy: number
  dx: number
  dy: number
}

export function OperationsMap({ points }: { points: MapPoint[] }) {
  const [filter, setFilter] = useState<Filter>("active")
  const [hoverId, setHoverId] = useState<string | null>(null)

  const today = useMemo(
    () =>
      new Date().toLocaleDateString("en-CA", {
        timeZone: "America/Toronto",
      }),
    [],
  )
  const weekTo = useMemo(() => {
    const d = new Date(`${today}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 6)
    return d.toISOString().slice(0, 10)
  }, [today])

  const filtered = useMemo(() => {
    if (filter === "active") {
      return points.filter((p) => ACTIVE_STATUSES.has(p.status))
    }
    if (filter === "today") {
      return points.filter((p) => p.pickupDate === today)
    }
    return points.filter(
      (p) =>
        p.pickupDate !== null &&
        p.pickupDate >= today &&
        p.pickupDate <= weekTo,
    )
  }, [filter, points, today, weekTo])

  const projected: ProjectedPoint[] = useMemo(() => {
    const out: ProjectedPoint[] = []
    for (const p of filtered) {
      const o = project(p.origin)
      const d = project(p.destination)
      if (!o || !d) continue
      out.push({ ...p, ox: o[0], oy: o[1], dx: d[0], dy: d[1] })
    }
    return out
  }, [filtered])

  const skipped = filtered.length - projected.length
  const hovered = hoverId
    ? projected.find((p) => p.id === hoverId) ?? null
    : null

  return (
    <section
      className={cn(
        "relative isolate flex h-full flex-col gap-4 overflow-hidden rounded-xl p-5 text-brand-cloud",
        "border border-white/10 bg-brand-midnight/80 backdrop-blur-2xl backdrop-saturate-150",
        "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.12),0_24px_48px_-16px_rgba(10,14,26,0.45),0_4px_16px_-4px_rgba(10,14,26,0.25)]",
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,160,146,0.22)_0%,transparent_70%)]"
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div
            className={cn(
              "inline-flex w-fit rounded-full p-1 text-xs font-medium",
              "border border-white/10 bg-white/[0.06] backdrop-blur-md",
              "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.08)]",
            )}
          >
            <Tab
              active={filter === "active"}
              onClick={() => setFilter("active")}
            >
              Active
            </Tab>
            <Tab
              active={filter === "today"}
              onClick={() => setFilter("today")}
            >
              Today
            </Tab>
            <Tab active={filter === "week"} onClick={() => setFilter("week")}>
              Week
            </Tab>
          </div>
          <div className="flex items-end gap-3">
            <span className="font-display text-3xl tracking-wide tabular-nums text-brand-cloud">
              {projected.length.toLocaleString()}
            </span>
            <span className="pb-1 text-xs text-brand-cloud/65">
              {projected.length === 1 ? "load" : "loads"} on the map
              {skipped > 0
                ? ` · ${skipped} hidden (city not mapped)`
                : ""}
            </span>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-cloud/65">
            North America · live operations
          </p>
        </div>
        <MapIcon
          aria-hidden="true"
          className="size-5 shrink-0 text-brand-cloud/40"
        />
      </div>

      <div
        className="relative w-full"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 block h-full w-full"
        >
          <defs>
            <linearGradient id="opMapStroke" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgb(224 180 83)" />
              <stop offset="100%" stopColor="rgb(94 215 197)" />
            </linearGradient>
            <radialGradient id="opMapPin" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgb(255 220 140)" stopOpacity="1" />
              <stop offset="100%" stopColor="rgb(224 180 83)" stopOpacity="1" />
            </radialGradient>
            <radialGradient id="opMapPinDest" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgb(140 235 220)" stopOpacity="1" />
              <stop offset="100%" stopColor="rgb(34 160 146)" stopOpacity="1" />
            </radialGradient>
          </defs>

          {countryPaths.map((c) => {
            const isPrimary = c.id === "124" || c.id === "840"
            return (
              <path
                key={c.id}
                d={c.d}
                fill={
                  isPrimary
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(255,255,255,0.025)"
                }
                stroke="rgba(255,255,255,0.16)"
                strokeWidth={0.6}
              />
            )
          })}

          {projected.map((p) => {
            const dim = hoverId !== null && hoverId !== p.id
            return <Arc key={`arc-${p.id}`} p={p} dim={dim} />
          })}

          {projected.map((p) => (
            <PinPair
              key={`pins-${p.id}`}
              p={p}
              hovered={hoverId === p.id}
              dim={hoverId !== null && hoverId !== p.id}
              onEnter={() => setHoverId(p.id)}
              onLeave={() => setHoverId((id) => (id === p.id ? null : id))}
            />
          ))}
        </svg>

        {projected.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-md border border-dashed border-white/15 bg-brand-midnight/60 px-4 py-2 text-sm text-brand-cloud/65">
              {filter === "active"
                ? "No active loads on the map."
                : filter === "today"
                  ? "No loads picking up today."
                  : "No loads scheduled this week."}
            </p>
          </div>
        ) : null}

        {hovered ? <HoverCard p={hovered} /> : null}
      </div>

      <Legend />
    </section>
  )
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 transition-colors",
        active
          ? "bg-white/15 text-brand-cloud [box-shadow:inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(10,14,26,0.4)]"
          : "text-brand-cloud/55 hover:text-brand-cloud",
      )}
    >
      {children}
    </button>
  )
}

function Arc({ p, dim }: { p: ProjectedPoint; dim: boolean }) {
  // Quadratic curve with a control point pushed perpendicular to the chord
  // so the arc bows outward instead of cutting straight across. Rounded to
  // 2 decimals so server-side and client-side renders produce byte-identical
  // d-strings (avoids hydration mismatch).
  const q2 = (n: number) => Math.round(n * 100) / 100
  const mx = (p.ox + p.dx) / 2
  const my = (p.oy + p.dy) / 2
  const dx = p.dx - p.ox
  const dy = p.dy - p.oy
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const lift = Math.min(80, len * 0.22)
  const cx = q2(mx + nx * lift)
  const cy = q2(my + ny * lift - Math.min(20, len * 0.05))

  return (
    <path
      d={`M ${p.ox} ${p.oy} Q ${cx} ${cy} ${p.dx} ${p.dy}`}
      fill="none"
      stroke="url(#opMapStroke)"
      strokeWidth={1.5}
      strokeOpacity={dim ? 0.18 : 0.65}
      strokeLinecap="round"
      strokeDasharray={p.isCrossBorder ? "6 4" : undefined}
      style={{ transition: "stroke-opacity 120ms" }}
    />
  )
}

function PinPair({
  p,
  hovered,
  dim,
  onEnter,
  onLeave,
}: {
  p: ProjectedPoint
  hovered: boolean
  dim: boolean
  onEnter: () => void
  onLeave: () => void
}) {
  const opacity = dim ? 0.35 : 1
  return (
    <Link
      href={`/loads/${p.id}`}
      style={{ opacity, transition: "opacity 120ms" }}
    >
      {/* origin pin (gold) */}
      <circle
        cx={p.ox}
        cy={p.oy}
        r={hovered ? 11 : 7}
        fill="rgb(224 180 83)"
        fillOpacity={0.18}
        style={{ transition: "r 120ms", pointerEvents: "none" }}
      />
      <circle
        cx={p.ox}
        cy={p.oy}
        r={hovered ? 5 : 4}
        fill="url(#opMapPin)"
        stroke="rgb(15 23 42)"
        strokeWidth={1.2}
        style={{ transition: "r 120ms", pointerEvents: "none" }}
      />
      {/* origin hit-target — only this triggers hover */}
      <circle
        cx={p.ox}
        cy={p.oy}
        r={12}
        fill="transparent"
        style={{ cursor: "pointer" }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onEnter}
        onBlur={onLeave}
      />
      {/* destination pin (teal) */}
      <circle
        cx={p.dx}
        cy={p.dy}
        r={hovered ? 9 : 6}
        fill="rgb(34 160 146)"
        fillOpacity={0.16}
        style={{ transition: "r 120ms", pointerEvents: "none" }}
      />
      <circle
        cx={p.dx}
        cy={p.dy}
        r={hovered ? 4 : 3}
        fill="url(#opMapPinDest)"
        stroke="rgb(15 23 42)"
        strokeWidth={1}
        style={{ transition: "r 120ms", pointerEvents: "none" }}
      />
      {/* destination hit-target */}
      <circle
        cx={p.dx}
        cy={p.dy}
        r={11}
        fill="transparent"
        style={{ cursor: "pointer" }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onEnter}
        onBlur={onLeave}
      />
    </Link>
  )
}

function HoverCard({ p }: { p: ProjectedPoint }) {
  // Anchor to the origin pin in viewBox space, converted to percent so the
  // overlay stays glued to the right spot at any container width.
  const xPct = (p.ox / W) * 100
  const yPct = (p.oy / H) * 100
  // Flip horizontally if we'd run off the right edge.
  const flipLeft = xPct > 60
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-10 flex w-[260px] flex-col gap-2 rounded-xl px-3.5 py-3 text-xs text-brand-cloud",
        "border border-white/10 bg-brand-midnight/90 backdrop-blur-2xl backdrop-saturate-150",
        "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.12),0_16px_32px_-12px_rgba(10,14,26,0.55)]",
      )}
      style={{
        left: flipLeft ? undefined : `calc(${xPct}% + 14px)`,
        right: flipLeft ? `calc(${100 - xPct}% + 14px)` : undefined,
        top: `calc(${yPct}% - 14px)`,
        transform: "translateY(-50%)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold tracking-tight text-brand-cloud">
          {p.loadNumber}
        </span>
        <Badge
          className={cn("border-transparent", STATUS_TONE_GLASS[p.status])}
        >
          {LOAD_STATUS_LABEL[p.status]}
        </Badge>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wider text-brand-cloud/55">
          Customer
        </span>
        <span className="font-medium">{p.customerName ?? "—"}</span>
      </div>
      <div className="flex flex-col gap-0.5 text-[11px]">
        <span className="text-brand-cloud/65">{p.originLabel}</span>
        <span className="text-brand-cloud/45">↓</span>
        <span className="text-brand-cloud/65">{p.destinationLabel}</span>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-[11px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-brand-cloud/55">
            Driver
          </span>
          <span>
            {p.driverName ?? (
              <span className="italic text-brand-cloud/55">unassigned</span>
            )}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-brand-cloud/55">
            {p.pickupDate ? "Pickup" : ""}
          </span>
          <span className="tabular-nums">
            {p.pickupDate
              ? format(parseISO(p.pickupDate), "MMM d")
              : ""}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-brand-cloud/55">
            Rate
          </span>
          <span className="font-medium tabular-nums">
            {formatCAD(p.totalBilledCad)}
          </span>
        </div>
      </div>
      {p.isCrossBorder ? (
        <span className="inline-flex w-fit items-center rounded bg-brand-teal/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-teal-light">
          Cross-border
        </span>
      ) : null}
    </div>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] uppercase tracking-wider text-brand-cloud/55">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-[rgb(224_180_83)]" />
        Pickup
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-[rgb(34_160_146)]" />
        Delivery
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-px w-6 bg-gradient-to-r from-[rgb(224_180_83)] to-[rgb(34_160_146)]" />
        Active lane
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-px w-6 border-t border-dashed border-brand-cloud/45" />
        Cross-border
      </span>
    </div>
  )
}
