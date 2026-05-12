"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { geoAlbers, geoPath } from "d3-geo"
import { feature } from "topojson-client"
import type { Feature, FeatureCollection, Geometry } from "geojson"
import type { Topology } from "topojson-specification"
import { Crosshair, Maximize2, Minus, Plus } from "lucide-react"

import countries110m from "@/lib/geo/countries-110m.json"
import admin1NA from "@/lib/geo/admin1-na.json"
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

// Operational categories mirroring industry fleet dashboards. We derive these
// from the load's status (plus a "delayed" check against pickup_date) so the
// map can read at a glance — In Transit / In Progress / Delayed / Idle —
// instead of the eleven raw status values.
type FleetCategory = "in_transit" | "in_progress" | "delayed" | "idle"

const ACTIVE_STATUSES = new Set<LoadStatus>([
  "assigned",
  "dispatched",
  "at_pickup",
  "loaded",
  "in_transit",
  "at_delivery",
])

function categorize(p: MapPoint, today: string): FleetCategory {
  // A load is "delayed" the moment its pickup date is in the past and it
  // hasn't actually started moving yet — that's the carrier's pain signal.
  if (
    p.pickupDate &&
    p.pickupDate < today &&
    ACTIVE_STATUSES.has(p.status) &&
    p.status !== "in_transit" &&
    p.status !== "at_delivery"
  ) {
    return "delayed"
  }
  if (p.status === "in_transit" || p.status === "at_delivery") return "in_transit"
  if (
    p.status === "assigned" ||
    p.status === "dispatched" ||
    p.status === "at_pickup" ||
    p.status === "loaded"
  ) {
    return "in_progress"
  }
  return "idle"
}

const CATEGORY_META: Record<
  FleetCategory,
  { label: string; dot: string; truck: string; glow: string; stroke: string }
> = {
  in_transit: {
    label: "In Transit",
    dot: "#60a5fa",
    truck: "#dbeafe",
    glow: "rgba(96,165,250,0.45)",
    stroke: "#3b82f6",
  },
  in_progress: {
    label: "In Progress",
    dot: "#4ade80",
    truck: "#dcfce7",
    glow: "rgba(74,222,128,0.40)",
    stroke: "#22c55e",
  },
  delayed: {
    label: "Delayed",
    dot: "#fb923c",
    truck: "#ffedd5",
    glow: "rgba(251,146,60,0.50)",
    stroke: "#f97316",
  },
  idle: {
    label: "Idle",
    dot: "#94a3b8",
    truck: "#e2e8f0",
    glow: "rgba(148,163,184,0.30)",
    stroke: "#64748b",
  },
}

const STATUS_TONE: Record<LoadStatus, string> = {
  draft: "bg-slate-500/15 text-slate-300",
  assigned: "bg-blue-500/20 text-blue-200",
  dispatched: "bg-blue-500/20 text-blue-200",
  at_pickup: "bg-amber-500/20 text-amber-200",
  loaded: "bg-amber-500/20 text-amber-200",
  in_transit: "bg-sky-500/20 text-sky-200",
  at_delivery: "bg-amber-500/20 text-amber-200",
  delivered: "bg-emerald-500/20 text-emerald-200",
  invoiced: "bg-emerald-500/20 text-emerald-200",
  paid: "bg-emerald-600/30 text-emerald-100",
  cancelled: "bg-red-500/20 text-red-200",
}

const W = 800
const H = 460

// One-time topojson → geojson conversion at module scope. Only Canada (124),
// USA (840), and Mexico (484) are kept so the projection's fitSize tightens
// around North America.
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

const round3 = (n: number) => Math.round(n * 1000) / 1000

type CountryPath = { id: string; d: string }
const countryPaths: CountryPath[] = naFeatures.features
  .map((f): CountryPath | null => {
    const raw = path(f as Feature<Geometry>)
    if (!raw) return null
    const d = raw.replace(/-?\d+\.\d+/g, (m) => round3(parseFloat(m)).toString())
    return { id: String(f.id), d }
  })
  .filter((v): v is CountryPath => v !== null)

// State + province outlines (US + CA) projected against the same Albers used
// for countries above. Rendered as a faint layer between the country fills
// and the route lanes, so the map reads like an admin-1 reference without
// fighting the marker visuals.
type AdminProps = { name: string; country: string; code: string | null }
type AdminFeature = Feature<Geometry, AdminProps>
const admin1Collection = admin1NA as unknown as FeatureCollection<
  Geometry,
  AdminProps
>
type StatePath = {
  key: string
  d: string
  code: string | null
  cx: number
  cy: number
}
const statePaths: StatePath[] = admin1Collection.features
  .map((f, i): StatePath | null => {
    const raw = path(f as AdminFeature)
    if (!raw) return null
    const d = raw.replace(/-?\d+\.\d+/g, (m) => round3(parseFloat(m)).toString())
    // Centroid in viewBox pixel space, used to anchor the postal-code label.
    // Skip features whose centroid lands off-canvas (Alaska, Hawaii) so we
    // don't render orphan labels in the margins.
    const c = path.centroid(f as AdminFeature)
    if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null
    return {
      key: `${f.properties.country}-${f.properties.name}-${i}`,
      d,
      code: f.properties.code,
      cx: round3(c[0]),
      cy: round3(c[1]),
    }
  })
  .filter((v): v is StatePath => v !== null)

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
  category: FleetCategory
}

export function OperationsMap({ points }: { points: MapPoint[] }) {
  const today = useMemo(
    () =>
      new Date().toLocaleDateString("en-CA", {
        timeZone: "America/Toronto",
      }),
    [],
  )

  // Project once, then filter by selected category.
  const allProjected: ProjectedPoint[] = useMemo(() => {
    const out: ProjectedPoint[] = []
    for (const p of points) {
      const o = project(p.origin)
      const d = project(p.destination)
      if (!o || !d) continue
      out.push({
        ...p,
        ox: o[0],
        oy: o[1],
        dx: d[0],
        dy: d[1],
        category: categorize(p, today),
      })
    }
    return out
  }, [points, today])

  const counts = useMemo(() => {
    const c: Record<FleetCategory, number> = {
      in_transit: 0,
      in_progress: 0,
      delayed: 0,
      idle: 0,
    }
    for (const p of allProjected) c[p.category]++
    return c
  }, [allProjected])

  const [activeCategory, setActiveCategory] = useState<FleetCategory | null>(
    null,
  )
  const [hoverId, setHoverId] = useState<string | null>(null)

  // Camera state: zoom (>=1) and an anchor point in viewBox coordinates.
  // viewBox is derived from these — never stored — so the maths stay in sync.
  // Clamped against the canvas bounds so the user can't pan into the void.
  const MIN_ZOOM = 1
  const MAX_ZOOM = 4.5
  const [view, setView] = useState({ cx: W / 2, cy: H / 2, zoom: 1 })
  const dragRef = useRef<{
    startX: number
    startY: number
    cx: number
    cy: number
    rectW: number
    rectH: number
  } | null>(null)
  const [dragging, setDragging] = useState(false)

  const clampView = useCallback(
    (next: { cx: number; cy: number; zoom: number }) => {
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next.zoom))
      const halfW = W / zoom / 2
      const halfH = H / zoom / 2
      const cx = Math.max(halfW, Math.min(W - halfW, next.cx))
      const cy = Math.max(halfH, Math.min(H - halfH, next.cy))
      return { cx, cy, zoom }
    },
    [],
  )

  const vbW = W / view.zoom
  const vbH = H / view.zoom
  const vbX = view.cx - vbW / 2
  const vbY = view.cy - vbH / 2

  const onZoomIn = useCallback(() => {
    setView((v) => clampView({ ...v, zoom: v.zoom * 1.4 }))
  }, [clampView])
  const onZoomOut = useCallback(() => {
    setView((v) => clampView({ ...v, zoom: v.zoom / 1.4 }))
  }, [clampView])
  const onRecenter = useCallback(() => {
    setView({ cx: W / 2, cy: H / 2, zoom: 1 })
  }, [])

  // Drag-to-pan. Only meaningful when zoomed in; at zoom 1 the camera is
  // clamped and movement is a no-op. We translate cursor pixels back into
  // viewBox units using the SVG's actual rendered size.
  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (view.zoom <= 1) return
      const rect = e.currentTarget.getBoundingClientRect()
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        cx: view.cx,
        cy: view.cy,
        rectW: rect.width,
        rectH: rect.height,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(true)
    },
    [view.cx, view.cy, view.zoom],
  )
  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const d = dragRef.current
      if (!d) return
      const dx = ((e.clientX - d.startX) / d.rectW) * vbW
      const dy = ((e.clientY - d.startY) / d.rectH) * vbH
      setView(clampView({ cx: d.cx - dx, cy: d.cy - dy, zoom: view.zoom }))
    },
    [clampView, vbW, vbH, view.zoom],
  )
  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragRef.current) return
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      dragRef.current = null
      setDragging(false)
    },
    [],
  )

  const projected = useMemo(
    () =>
      activeCategory === null
        ? allProjected
        : allProjected.filter((p) => p.category === activeCategory),
    [allProjected, activeCategory],
  )

  const skipped = points.length - allProjected.length
  const hovered = hoverId
    ? projected.find((p) => p.id === hoverId) ?? null
    : null

  const categories: FleetCategory[] = [
    "in_transit",
    "in_progress",
    "delayed",
    "idle",
  ]

  return (
    <section
      className={cn(
        "relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 text-slate-100",
        "bg-[radial-gradient(ellipse_at_top_right,rgba(34,160,146,0.10),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(240,168,32,0.06),transparent_50%),linear-gradient(180deg,#0d1426_0%,#0a0e1a_100%)]",
        "shadow-[0_8px_32px_-12px_rgba(0,0,0,0.50)]",
      )}
    >
      {/* Header bar — title + live indicator + view-full action. */}
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-3.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            <h2 className="text-sm font-semibold tracking-tight text-white">
              Live Fleet Map
            </h2>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-400/80">
            Live
          </span>
        </div>
        <Link
          href="/loads"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors",
            "hover:bg-white/10 hover:text-white",
          )}
        >
          View full list
          <Maximize2 className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-4 sm:flex-row">
        {/* Status filter cards (left rail). */}
        <aside className="flex shrink-0 flex-row gap-2 sm:w-[124px] sm:flex-col">
          {categories.map((cat) => {
            const meta = CATEGORY_META[cat]
            const isActive = activeCategory === cat
            const hasAny = counts[cat] > 0
            return (
              <button
                key={cat}
                type="button"
                onClick={() =>
                  setActiveCategory((prev) => (prev === cat ? null : cat))
                }
                disabled={!hasAny}
                className={cn(
                  "flex flex-1 flex-col items-start gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-all sm:flex-none",
                  isActive
                    ? "border-white/20 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "border-white/5 bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.06]",
                  !hasAny && "opacity-50",
                )}
              >
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: meta.dot }}
                  />
                  {meta.label}
                </span>
                <span className="font-display text-2xl leading-none tracking-wide text-white">
                  {counts[cat]}
                </span>
              </button>
            )
          })}
        </aside>

        {/* Map canvas. */}
        <div
          className="relative flex-1"
          style={{ aspectRatio: `${W} / ${H}` }}
        >
          <svg
            viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
            preserveAspectRatio="xMidYMid meet"
            className={cn(
              "absolute inset-0 block h-full w-full touch-none select-none",
              view.zoom > 1 && (dragging ? "cursor-grabbing" : "cursor-grab"),
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <defs>
              {(Object.entries(CATEGORY_META) as Array<
                [FleetCategory, (typeof CATEGORY_META)[FleetCategory]]
              >).map(([key, meta]) => (
                <radialGradient
                  key={key}
                  id={`halo-${key}`}
                  cx="50%"
                  cy="50%"
                  r="50%"
                >
                  <stop offset="0%" stopColor={meta.glow} stopOpacity="1" />
                  <stop offset="60%" stopColor={meta.glow} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={meta.glow} stopOpacity="0" />
                </radialGradient>
              ))}
              <pattern
                id="opMapGrid"
                width="32"
                height="32"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 32 0 L 0 0 0 32"
                  fill="none"
                  stroke="rgba(255,255,255,0.025)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>

            {/* Subtle grid texture across the whole canvas. */}
            <rect width={W} height={H} fill="url(#opMapGrid)" />

            {/* Country fills — barely-there shapes with the state-style border. */}
            {countryPaths.map((c) => {
              const isPrimary = c.id === "124" || c.id === "840"
              return (
                <path
                  key={c.id}
                  d={c.d}
                  fill={
                    isPrimary
                      ? "rgba(148,163,184,0.05)"
                      : "rgba(148,163,184,0.025)"
                  }
                  stroke="rgba(148,163,184,0.32)"
                  strokeWidth={1 / view.zoom}
                />
              )
            })}

            {/* State + province outlines. Stroke width scales inversely with
                zoom so borders stay 1px-ish in screen space at any zoom. */}
            {statePaths.map((s) => (
              <path
                key={s.key}
                d={s.d}
                fill="none"
                stroke="rgba(148,163,184,0.20)"
                strokeWidth={0.55 / view.zoom}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* State / province postal-code labels at each centroid. Sized
                inversely to zoom so the type stays ~8px in screen space at
                any zoom. Pointer-events off — they never block hover. Only
                drawn for features whose centroid sits inside the canvas
                (filters out off-screen Alaska/Hawaii) and that have a code. */}
            {statePaths.map((s) =>
              s.code &&
              s.cx >= 0 &&
              s.cx <= W &&
              s.cy >= 0 &&
              s.cy <= H ? (
                <text
                  key={`label-${s.key}`}
                  x={s.cx}
                  y={s.cy}
                  fontSize={9 / view.zoom}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="rgba(203,213,225,0.42)"
                  fontWeight={500}
                  style={{
                    pointerEvents: "none",
                    letterSpacing: `${0.06 / view.zoom}em`,
                    userSelect: "none",
                  }}
                >
                  {s.code}
                </text>
              ) : null,
            )}

            {/* Route arcs underneath the markers. */}
            {projected.map((p) => {
              const dim = hoverId !== null && hoverId !== p.id
              return <Arc key={`arc-${p.id}`} p={p} dim={dim} />
            })}

            {/* Destination pins (rendered first so trucks sit on top). */}
            {projected.map((p) => (
              <DestinationPin key={`dest-${p.id}`} p={p} />
            ))}

            {/* Truck markers at origin. */}
            {projected.map((p) => (
              <TruckMarker
                key={`truck-${p.id}`}
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
              <p className="rounded-md border border-dashed border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-slate-400">
                {activeCategory
                  ? `No ${CATEGORY_META[activeCategory].label.toLowerCase()} loads on the map.`
                  : "No active loads on the map."}
                {skipped > 0 ? ` · ${skipped} hidden (city not mapped)` : ""}
              </p>
            </div>
          ) : null}

          {hovered ? (
            <HoverCard
              p={hovered}
              vbX={vbX}
              vbY={vbY}
              vbW={vbW}
              vbH={vbH}
            />
          ) : null}

          {/* Functional zoom + recenter controls. */}
          <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={onZoomIn}
              disabled={view.zoom >= MAX_ZOOM - 0.001}
              aria-label="Zoom in"
              className="flex size-7 items-center justify-center rounded-md border border-white/10 bg-slate-900/70 text-slate-300 backdrop-blur transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onZoomOut}
              disabled={view.zoom <= MIN_ZOOM + 0.001}
              aria-label="Zoom out"
              className="flex size-7 items-center justify-center rounded-md border border-white/10 bg-slate-900/70 text-slate-300 backdrop-blur transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onRecenter}
              aria-label="Recenter map"
              className="flex size-7 items-center justify-center rounded-md border border-white/10 bg-slate-900/70 text-slate-300 backdrop-blur transition-colors hover:bg-slate-800 hover:text-white"
            >
              <Crosshair className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

// Deterministic 32-bit string hash. Used to seed each lane's waypoint
// jitter so the same load always renders the same winding path between
// origin and destination — different across loads, identical across
// re-renders, identical between SSR and client.
function strHash(s: string): number {
  let h = 2166136261 >>> 0 // FNV-1a offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

// Pull successive [0..1) pseudo-randoms out of a single seed by chaining
// xorshift. Cheap, deterministic, and good enough for spatial jitter.
function makeRng(seed: number) {
  let s = seed || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    s = s >>> 0
    return (s & 0xffffffff) / 0x100000000
  }
}

function Arc({ p, dim }: { p: ProjectedPoint; dim: boolean }) {
  const meta = CATEGORY_META[p.category]
  const q2 = (n: number) => Math.round(n * 100) / 100

  const dx = p.dx - p.ox
  const dy = p.dy - p.oy
  const len = Math.hypot(dx, dy) || 1
  // Raw perpendicular to the chord — no upward bias. Forcing every route to
  // bow north pushed US-internal lanes (e.g. Atlanta→Chicago) up through
  // Canadian territory, which read as "markers in Canada".
  const nx = -dy / len
  const ny = dx / len

  // Build a winding polyline of waypoints between origin and destination.
  // The seeded RNG picks which side the route bows toward, and each interior
  // waypoint zig-zags by a smaller perpendicular offset than before so the
  // curve stays close to the great-circle chord.
  const STEPS = 5
  const rng = makeRng(strHash(p.id))
  const baseSign = rng() < 0.5 ? -1 : 1
  const maxOffset = Math.min(38, len * 0.10)
  const pts: Array<[number, number]> = [[p.ox, p.oy]]
  for (let i = 1; i < STEPS; i++) {
    const t = i / STEPS
    const baseX = p.ox + dx * t
    const baseY = p.oy + dy * t
    // Strength tapers in towards the endpoints so the line lands cleanly.
    const taper = Math.sin(t * Math.PI)
    const sign = baseSign * (i % 2 === 0 ? -1 : 1)
    const jitter = 0.35 + rng() * 0.65 // 0.35..1.0
    const off = maxOffset * taper * sign * jitter
    pts.push([q2(baseX + nx * off), q2(baseY + ny * off)])
  }
  pts.push([p.dx, p.dy])

  // Smooth the polyline by laying down a quadratic Bezier through each
  // mid-point: from each pᵢ, curve via pᵢ₊₁ to the midpoint of pᵢ₊₁ and
  // pᵢ₊₂. End with a final segment to the destination. This rounds the
  // hard corners just enough to look "routed" instead of jagged, while
  // keeping the multiple bends visible (vs. a single arc).
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [cx, cy] = pts[i]
    const [nxt0, nxt1] = pts[i + 1]
    const mx = q2((cx + nxt0) / 2)
    const my = q2((cy + nxt1) / 2)
    d += ` Q ${cx} ${cy} ${mx} ${my}`
  }
  d += ` T ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`

  return (
    <path
      d={d}
      fill="none"
      stroke={meta.stroke}
      strokeWidth={1.4}
      strokeOpacity={dim ? 0.15 : 0.55}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="5 4"
      style={{ transition: "stroke-opacity 120ms" }}
    />
  )
}

function DestinationPin({ p }: { p: ProjectedPoint }) {
  const meta = CATEGORY_META[p.category]
  return (
    <g style={{ pointerEvents: "none" }}>
      <circle
        cx={p.dx}
        cy={p.dy}
        r={5}
        fill={meta.stroke}
        fillOpacity={0.18}
      />
      <circle
        cx={p.dx}
        cy={p.dy}
        r={2.4}
        fill={meta.dot}
        stroke="rgba(255,255,255,0.65)"
        strokeWidth={0.8}
      />
    </g>
  )
}

function TruckMarker({
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
  const meta = CATEGORY_META[p.category]
  // Pin-style layout: a small precise dot lives at (p.ox, p.oy) and the
  // chip is offset upward so it never spills across the city's actual
  // pixel. This keeps cities near a border (Burnaby ↔ Washington, Windsor
  // ↔ Detroit) on the correct side at default zoom — the chip body sits
  // *north* of the city while the dot pinpoints the city itself.
  const size = hovered ? 18 : 16
  const half = size / 2
  const haloR = hovered ? 16 : 13
  const offsetY = size / 2 + 5 // chip sits this many px above the city
  const cy = p.oy - offsetY
  return (
    <Link
      href={`/loads/${p.id}`}
      style={{ opacity: dim ? 0.4 : 1, transition: "opacity 120ms" }}
    >
      {/* Glow halo centered on the precise city pixel. */}
      <circle
        cx={p.ox}
        cy={p.oy}
        r={haloR}
        fill={`url(#halo-${p.category})`}
        style={{ pointerEvents: "none" }}
      />
      {/* Tail from the chip down to the city dot. */}
      <line
        x1={p.ox}
        y1={cy + half}
        x2={p.ox}
        y2={p.oy - 2}
        stroke={meta.stroke}
        strokeWidth={1.1}
        strokeOpacity={0.8}
        style={{ pointerEvents: "none" }}
      />
      {/* Rounded marker chip — offset above the city. */}
      <rect
        x={p.ox - half}
        y={cy - half}
        width={size}
        height={size}
        rx={5}
        ry={5}
        fill="rgba(15,23,42,0.92)"
        stroke={meta.stroke}
        strokeWidth={1.1}
        style={{ pointerEvents: "none" }}
      />
      {/* Lucide Truck path, scaled into the offset chip. */}
      <g
        transform={`translate(${p.ox - size / 2 + size * 0.07}, ${cy - size / 2 + size * 0.12}) scale(${size / 30})`}
        fill="none"
        stroke={meta.truck}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pointerEvents: "none" }}
      >
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
        <path d="M15 18H9" />
        <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
        <circle cx="17" cy="18" r="2" />
        <circle cx="7" cy="18" r="2" />
      </g>
      {/* Precise city pin: small bright dot at the actual lat/lng. This is
          the "this is where the city is" anchor — chip body never moves the
          city's true position. */}
      <circle
        cx={p.ox}
        cy={p.oy}
        r={2.6}
        fill={meta.dot}
        stroke="rgba(15,23,42,0.85)"
        strokeWidth={1}
        style={{ pointerEvents: "none" }}
      />
      {/* Hit-target overlay covering both chip and dot. */}
      <rect
        x={p.ox - half - 4}
        y={cy - half - 4}
        width={size + 8}
        height={offsetY + size + 8}
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

function HoverCard({
  p,
  vbX,
  vbY,
  vbW,
  vbH,
}: {
  p: ProjectedPoint
  vbX: number
  vbY: number
  vbW: number
  vbH: number
}) {
  // Convert the marker's viewBox coords to a percentage of the visible
  // canvas, so the popover sticks to the truck no matter how zoomed/panned.
  const xPct = ((p.ox - vbX) / vbW) * 100
  const yPct = ((p.oy - vbY) / vbH) * 100
  // Hide the popover if the marker has scrolled off-screen.
  if (xPct < 0 || xPct > 100 || yPct < 0 || yPct > 100) return null
  const flipLeft = xPct > 60
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-10 flex w-[260px] flex-col gap-2 rounded-xl border border-white/10 bg-slate-900/95 px-3.5 py-3 text-xs text-slate-100",
        "shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] backdrop-blur",
      )}
      style={{
        left: flipLeft ? undefined : `calc(${xPct}% + 18px)`,
        right: flipLeft ? `calc(${100 - xPct}% + 18px)` : undefined,
        top: `calc(${yPct}% - 14px)`,
        transform: "translateY(-50%)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold tracking-tight text-white">
          {p.loadNumber}
        </span>
        <Badge
          className={cn("border-transparent", STATUS_TONE[p.status])}
        >
          {LOAD_STATUS_LABEL[p.status]}
        </Badge>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wider text-slate-400">
          Customer
        </span>
        <span className="font-medium">{p.customerName ?? "—"}</span>
      </div>
      <div className="flex flex-col gap-0.5 text-[11px]">
        <span className="text-slate-300">{p.originLabel}</span>
        <span className="text-slate-500">↓</span>
        <span className="text-slate-300">{p.destinationLabel}</span>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-[11px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-400">
            Driver
          </span>
          <span>
            {p.driverName ?? (
              <span className="italic text-slate-500">unassigned</span>
            )}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-400">
            {p.pickupDate ? "Pickup" : ""}
          </span>
          <span className="tabular-nums">
            {p.pickupDate ? format(parseISO(p.pickupDate), "MMM d") : ""}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-400">
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
