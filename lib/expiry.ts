// Tiny helpers for surfacing expiry dates across the CRM. Phase 4 will wire
// these into the alerts engine; for now they drive list-row badges and the
// detail-page expiry summary.

export type Severity = "expired" | "critical" | "warning" | "ok"

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function todayInToronto(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Toronto",
  })
}

export function daysBetween(today: string, when: string): number {
  // Inputs are YYYY-MM-DD. We treat them as UTC noon to avoid DST jitter and
  // round to whole days — close enough for "X days until expiry" labelling.
  const a = new Date(`${today}T12:00:00Z`).getTime()
  const b = new Date(`${when}T12:00:00Z`).getTime()
  return Math.round((b - a) / MS_PER_DAY)
}

export function severityFor(days: number): Severity {
  if (days < 0) return "expired"
  if (days <= 30) return "critical"
  if (days <= 60) return "warning"
  return "ok"
}

export type LabeledExpiry = {
  label: string
  date: string
  daysUntil: number
  severity: Severity
}

export function nextExpiry(
  today: string,
  entries: ReadonlyArray<{ label: string; date: string | null | undefined }>,
): LabeledExpiry | null {
  let best: LabeledExpiry | null = null
  for (const e of entries) {
    if (!e.date) continue
    const d = daysBetween(today, e.date)
    const sev = severityFor(d)
    // We pick the most-urgent (smallest daysUntil) expiry. Expired items
    // (negative days) come first, then soonest future.
    if (best === null || d < best.daysUntil) {
      best = {
        label: e.label,
        date: e.date,
        daysUntil: d,
        severity: sev,
      }
    }
  }
  return best
}

// Light-context tones for use on white / muted card backgrounds (table rows,
// compliance summary tiles on the truck detail page).
export const SEVERITY_TONE: Record<Severity, string> = {
  expired: "bg-red-200 text-red-900",
  critical: "bg-red-100 text-red-800",
  warning: "bg-amber-100 text-amber-800",
  ok: "bg-emerald-100 text-emerald-800",
}

// Dark liquid-glass context — preview cards, dashboards on the navy backdrop.
// Higher background opacity + light text so they read against brand-midnight.
export const SEVERITY_TONE_GLASS: Record<Severity, string> = {
  expired: "bg-red-500/40 text-white",
  critical: "bg-red-500/30 text-red-50",
  warning: "bg-amber-500/25 text-amber-100",
  ok: "bg-emerald-500/20 text-emerald-100",
}

export function relativeExpiryLabel(daysUntil: number): string {
  if (daysUntil < 0) return `${Math.abs(daysUntil)}d ago`
  if (daysUntil === 0) return "today"
  if (daysUntil === 1) return "tomorrow"
  return `in ${daysUntil}d`
}
