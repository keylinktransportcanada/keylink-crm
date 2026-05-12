"use client"

// Authenticated route-level loading state. One full-area liquid-glass
// surface fills <main>, with a brand-gradient spinner and the destination
// section name centered on it (e.g. "Loading Loads").

import { usePathname } from "next/navigation"

const SECTION_LABELS: Array<[RegExp, string]> = [
  [/^\/dashboard/, "Dashboard"],
  [/^\/loads\/new/, "New load"],
  [/^\/loads\/[^/]+\/edit/, "Edit load"],
  [/^\/loads\/[^/]+/, "Load details"],
  [/^\/loads/, "Loads"],
  [/^\/customers\/[^/]+/, "Customer"],
  [/^\/customers/, "Customers"],
  [/^\/drivers\/[^/]+/, "Driver"],
  [/^\/drivers/, "Drivers"],
  [/^\/trucks\/[^/]+/, "Truck"],
  [/^\/trucks/, "Trucks"],
  [/^\/trailers\/[^/]+/, "Trailer"],
  [/^\/trailers/, "Trailers"],
  [/^\/documents/, "Documents"],
  [/^\/maintenance/, "Maintenance"],
  [/^\/inspections/, "Inspections"],
  [/^\/messages/, "Chat"],
  [/^\/accounting\/ifta/, "IFTA"],
  [/^\/accounting/, "Accounting"],
  [/^\/reports/, "Reports"],
  [/^\/search/, "Search"],
  [/^\/account/, "Account"],
  [/^\/admin\/employees\/[^/]+/, "Employee"],
  [/^\/admin\/employees/, "Employees"],
  [/^\/admin/, "Admin"],
]

function sectionLabel(pathname: string): string {
  for (const [pattern, label] of SECTION_LABELS) {
    if (pattern.test(pathname)) return label
  }
  return "Page"
}

function Spinner() {
  return (
    <svg
      className="size-12 motion-safe:animate-spin [animation-duration:900ms]"
      viewBox="0 0 50 50"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="kl-spin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22a092" />
          <stop offset="60%" stopColor="#1a7b6e" />
          <stop offset="100%" stopColor="#f0a820" />
        </linearGradient>
      </defs>
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke="#12294a"
        strokeOpacity="0.08"
        strokeWidth="3"
      />
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke="url(#kl-spin)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="60 90"
      />
    </svg>
  )
}

export default function Loading() {
  const pathname = usePathname()
  const label = sectionLabel(pathname)

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Loading ${label}`}
      className="liquid-shimmer relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/40 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_8px_24px_-12px_rgba(18,41,74,0.12)] backdrop-blur-xl"
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner />
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Loading
          </span>
          <span className="font-display text-2xl tracking-wide text-brand-navy">
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}
