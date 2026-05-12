// Authenticated route-level loading state. Rendered into <main> while the
// next page streams. Generic enough to plausibly precede any tab: a header
// strip, a six-tile KPI row, a wide+narrow split, and a four-up row. Each
// pane is a frosted-glass surface with a moving liquid-shimmer highlight,
// so the transition feels like the new page is materializing rather than
// the screen going blank.

function GlassBlock({ className }: { className?: string }) {
  return (
    <div
      className={
        "liquid-shimmer relative overflow-hidden rounded-xl border border-white/40 bg-white/55 backdrop-blur-xl " +
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_8px_24px_-12px_rgba(18,41,74,0.12)] " +
        (className ?? "")
      }
      aria-hidden="true"
    />
  )
}

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="flex flex-1 flex-col gap-4"
    >
      <GlassBlock className="h-12" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <GlassBlock key={i} className="h-20" />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <GlassBlock className="h-72" />
        <GlassBlock className="h-72" />
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <GlassBlock className="h-56" />
        <GlassBlock className="h-56" />
        <GlassBlock className="h-56" />
        <GlassBlock className="h-56" />
      </div>
    </div>
  )
}
