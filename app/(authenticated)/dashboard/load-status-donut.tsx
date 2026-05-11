// SVG donut chart of load counts by status group. Pure server component —
// the data is precomputed in the dashboard query and the slices are rendered
// with stroke-dasharray, no JS interactivity needed for v1.
import { cn } from "@/lib/utils"

export type StatusBucket = {
  key: string
  label: string
  count: number
  color: string  // CSS color (var() reference or rgb()).
}

const RADIUS = 44
const STROKE = 14
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function LoadStatusDonut({
  buckets,
  total,
  className,
}: {
  buckets: StatusBucket[]
  total: number
  className?: string
}) {
  const visible = buckets.filter((b) => b.count > 0)
  const denom = total > 0 ? total : 1

  // Arc segments — accumulate offsets so each slice starts where the
  // previous ended. We rotate -90deg so the first slice begins at 12 o'clock.
  let offset = 0
  const segments = visible.map((b) => {
    const fraction = b.count / denom
    const length = fraction * CIRCUMFERENCE
    const seg = {
      key: b.key,
      label: b.label,
      count: b.count,
      pct: Math.round(fraction * 100),
      color: b.color,
      length,
      gap: CIRCUMFERENCE - length,
      offset: -offset,
    }
    offset += length
    return seg
  })

  return (
    <section
      className={cn(
        "flex h-full flex-col gap-2 rounded-xl border border-border/70 bg-card p-3",
        "shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="size-1.5 rounded-full bg-brand-gold"
            aria-hidden="true"
          />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
            Load status
          </h2>
        </div>
        {total > 0 ? (
          <span className="text-xs text-muted-foreground">
            {total} total
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-5">
        {/* Donut SVG */}
        <div className="relative shrink-0">
          <svg
            width={2 * RADIUS + STROKE}
            height={2 * RADIUS + STROKE}
            viewBox={`0 0 ${2 * RADIUS + STROKE} ${2 * RADIUS + STROKE}`}
            className="-rotate-90"
            aria-label="Load status breakdown"
          >
            {/* Track */}
            <circle
              cx={RADIUS + STROKE / 2}
              cy={RADIUS + STROKE / 2}
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE}
              className="text-muted/40"
            />
            {segments.map((s) => (
              <circle
                key={s.key}
                cx={RADIUS + STROKE / 2}
                cy={RADIUS + STROKE / 2}
                r={RADIUS}
                fill="none"
                stroke={s.color}
                strokeWidth={STROKE}
                strokeDasharray={`${s.length} ${s.gap}`}
                strokeDashoffset={s.offset}
                strokeLinecap="butt"
              />
            ))}
          </svg>
          {/* Center label */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-tight">
            <span className="text-xl font-bold tracking-tight tabular-nums text-brand-navy">
              {total}
            </span>
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              Loads
            </span>
          </div>
        </div>

        {/* Legend */}
        <ul className="flex flex-1 flex-col gap-1.5 text-sm">
          {buckets.map((b) => (
            <li
              key={b.key}
              className={cn(
                "flex items-center justify-between gap-3",
                b.count === 0 && "opacity-50",
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: b.color }}
                />
                <span className="text-foreground">{b.label}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {b.count}
                <span className="ml-1 text-xs">
                  ({total > 0 ? Math.round((b.count / total) * 100) : 0}%)
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
