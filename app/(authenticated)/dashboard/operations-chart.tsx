"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ArrowDownRight, ArrowUpRight, LineChart } from "lucide-react"

import { cn } from "@/lib/utils"

export type ChartPoint = {
  date: string // YYYY-MM-DD
  revenue: number // CAD
  count: number // loads delivered
}

type Mode = "revenue" | "count"

const formatCAD = (value: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value)

const formatCAD2 = (value: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(Math.round(value))

const ROW_HEIGHT = 170
const PADDING = { top: 12, right: 16, bottom: 24, left: 16 }

export function OperationsChart({
  series,
  previousTotalRevenue,
  previousTotalCount,
  title = "Operations",
}: {
  series: ChartPoint[]
  previousTotalRevenue: number
  previousTotalCount: number
  title?: string
}) {
  const [mode, setMode] = useState<Mode>("revenue")
  const [hover, setHover] = useState<number | null>(null)

  const totals = useMemo(() => {
    const revenue = series.reduce((s, p) => s + p.revenue, 0)
    const count = series.reduce((s, p) => s + p.count, 0)
    return { revenue, count }
  }, [series])

  const currentTotal = mode === "revenue" ? totals.revenue : totals.count
  const previousTotal =
    mode === "revenue" ? previousTotalRevenue : previousTotalCount
  const delta =
    previousTotal === 0
      ? currentTotal === 0
        ? 0
        : 100
      : ((currentTotal - previousTotal) / previousTotal) * 100
  const trendUp = delta >= 0

  const valueFormatter = mode === "revenue" ? formatCAD : (n: number) => `${n}`

  return (
    <section
      className={cn(
        "relative isolate flex h-full flex-col gap-3 overflow-hidden rounded-xl border border-border/70 bg-card p-4 text-foreground",
        "shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div
            className={cn(
              "inline-flex w-fit rounded-full p-1 text-xs font-medium",
              "border border-border bg-muted/50",
            )}
          >
            <Tab active={mode === "revenue"} onClick={() => setMode("revenue")}>
              Revenue (CAD)
            </Tab>
            <Tab active={mode === "count"} onClick={() => setMode("count")}>
              Loads delivered
            </Tab>
          </div>
          <div className="flex items-end gap-3">
            <span className="font-display text-3xl tracking-wide tabular-nums text-brand-navy">
              {mode === "revenue"
                ? formatCAD2(currentTotal)
                : currentTotal.toLocaleString()}
            </span>
            <DeltaBadge value={delta} trendUp={trendUp} />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
            {title} · last 30 days
          </p>
        </div>
        <LineChart
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground/40"
        />
      </div>

      <div className="relative flex-1 min-h-[170px]">
        <Chart
          series={series}
          mode={mode}
          hover={hover}
          setHover={setHover}
          valueFormatter={valueFormatter}
        />
      </div>

      <Link
        href="/reports"
        className="inline-flex items-center gap-1 self-start text-xs font-medium text-brand-teal hover:underline"
      >
        View full report
        <span aria-hidden="true">→</span>
      </Link>
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
          ? "bg-card text-foreground shadow-[0_1px_2px_rgba(18,41,74,0.06)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function DeltaBadge({
  value,
  trendUp,
}: {
  value: number
  trendUp: boolean
}) {
  const Icon = trendUp ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
        trendUp
          ? "bg-emerald-100 text-emerald-700"
          : "bg-red-100 text-red-700",
      )}
    >
      <Icon className="size-3" />
      {Math.abs(value).toFixed(0)}%
    </span>
  )
}

function Chart({
  series,
  mode,
  hover,
  setHover,
  valueFormatter,
}: {
  series: ChartPoint[]
  mode: Mode
  hover: number | null
  setHover: (i: number | null) => void
  valueFormatter: (v: number) => string
}) {
  // Use a fixed viewBox; the SVG scales responsively to its container.
  const W = 800
  const H = ROW_HEIGHT
  const innerW = W - PADDING.left - PADDING.right
  const innerH = H - PADDING.top - PADDING.bottom

  const values = series.map((p) => (mode === "revenue" ? p.revenue : p.count))
  const maxValue = Math.max(1, ...values)
  // 8% headroom so the curve doesn't kiss the top.
  const yMax = maxValue * 1.08

  const xFor = (i: number) =>
    PADDING.left + (series.length === 1 ? 0 : (i / (series.length - 1)) * innerW)
  const yFor = (v: number) =>
    PADDING.top + innerH - (v / yMax) * innerH

  // Build a smooth path with cubic Bezier curves between points.
  const pathD = useMemo(() => {
    if (series.length === 0) return ""
    const pts = series.map((p, i) => ({
      x: xFor(i),
      y: yFor(mode === "revenue" ? p.revenue : p.count),
    }))
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]
      const curr = pts[i]
      const cx = (prev.x + curr.x) / 2
      d += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`
    }
    return d
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, mode])

  const areaD = useMemo(() => {
    if (!pathD) return ""
    const last = series.length - 1
    return `${pathD} L ${xFor(last)} ${PADDING.top + innerH} L ${xFor(0)} ${
      PADDING.top + innerH
    } Z`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathD, series.length])

  // Sparse x-axis labels: first, ~middle, last.
  const labelIndices = useMemo(() => {
    const n = series.length
    if (n <= 4) return series.map((_, i) => i)
    return [0, Math.round(n / 3), Math.round((2 * n) / 3), n - 1]
  }, [series])

  // Y grid lines (4 of them).
  const gridLines = [0.25, 0.5, 0.75, 1].map((frac) => ({
    y: PADDING.top + innerH - frac * innerH,
    value: yMax * frac,
  }))

  if (series.length === 0) {
    return (
      <div className="flex h-full min-h-[170px] items-center justify-center rounded-md border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
        No deliveries yet — chart will populate as loads complete.
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-full min-h-[170px] w-full overflow-visible"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="opChartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(34 160 146)" stopOpacity="0.55" />
            <stop offset="50%" stopColor="rgb(34 160 146)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="rgb(34 160 146)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="opChartSheen" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.18" />
            <stop offset="50%" stopColor="white" stopOpacity="0.03" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="opChartStroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgb(94 215 197)" />
            <stop offset="100%" stopColor="rgb(34 160 146)" />
          </linearGradient>
          <filter id="opChartGlow" x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {gridLines.map((g, i) => (
          <line
            key={i}
            x1={PADDING.left}
            x2={W - PADDING.right}
            y1={g.y}
            y2={g.y}
            stroke="rgb(15 23 42)"
            strokeOpacity={0.08}
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        ))}

        <path d={areaD} fill="url(#opChartFill)" />
        <path d={areaD} fill="url(#opChartSheen)" opacity={0.7} />
        <path
          d={pathD}
          fill="none"
          stroke="url(#opChartStroke)"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#opChartGlow)"
        />

        {/* Hover hit-areas: invisible bars one per data point. */}
        {series.map((_, i) => {
          const cx = xFor(i)
          const halfW =
            series.length === 1
              ? innerW / 2
              : innerW / (series.length - 1) / 2
          return (
            <rect
              key={i}
              x={cx - halfW}
              y={PADDING.top}
              width={halfW * 2}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          )
        })}

        {hover !== null ? (
          <>
            <line
              x1={xFor(hover)}
              x2={xFor(hover)}
              y1={PADDING.top}
              y2={PADDING.top + innerH}
              stroke="rgb(94 215 197)"
              strokeWidth={1}
              strokeOpacity={0.45}
              strokeDasharray="3 3"
            />
            <circle
              cx={xFor(hover)}
              cy={yFor(mode === "revenue" ? series[hover].revenue : series[hover].count)}
              r={11}
              fill="rgb(94 215 197)"
              fillOpacity={0.22}
            />
            <circle
              cx={xFor(hover)}
              cy={yFor(mode === "revenue" ? series[hover].revenue : series[hover].count)}
              r={5}
              fill="rgb(94 215 197)"
              stroke="rgb(15 23 42)"
              strokeWidth={2}
            />
          </>
        ) : null}

        {/* X-axis labels */}
        {labelIndices.map((i) => (
          <text
            key={i}
            x={xFor(i)}
            y={H - 8}
            textAnchor="middle"
            fill="rgb(100 116 139)"
            className="text-[10px]"
          >
            {format(parseISO(series[i].date), "MMM d")}
          </text>
        ))}
      </svg>

      {hover !== null ? (
        <HoverTooltip
          point={series[hover]}
          mode={mode}
          formatter={valueFormatter}
          xPercent={
            series.length === 1 ? 50 : (hover / (series.length - 1)) * 100
          }
        />
      ) : null}
    </div>
  )
}

function HoverTooltip({
  point,
  mode,
  formatter,
  xPercent,
}: {
  point: ChartPoint
  mode: Mode
  formatter: (v: number) => string
  xPercent: number
}) {
  const value = mode === "revenue" ? point.revenue : point.count
  // Pin the tooltip horizontally to the hovered point. Offset to keep it on
  // screen at the edges.
  const left = `clamp(8px, calc(${xPercent}% - 60px), calc(100% - 128px))`
  return (
    <div
      className={cn(
        "pointer-events-none absolute -top-1 flex w-[120px] flex-col gap-0.5 rounded-lg px-2.5 py-1.5 text-xs text-foreground",
        "border border-border bg-popover shadow-md",
      )}
      style={{ left }}
    >
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {format(parseISO(point.date), "EEE, MMM d")}
      </span>
      <span className="font-semibold tabular-nums">
        {formatter(value)}
        {mode === "count" ? (
          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
            {value === 1 ? "load" : "loads"}
          </span>
        ) : null}
      </span>
    </div>
  )
}
