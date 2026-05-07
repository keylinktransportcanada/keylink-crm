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

export const SEVERITY_TONE: Record<Severity, string> = {
  expired: "bg-red-500/15 text-red-700 dark:text-red-300",
  critical: "bg-red-500/10 text-red-700 dark:text-red-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
}

export function relativeExpiryLabel(daysUntil: number): string {
  if (daysUntil < 0) return `${Math.abs(daysUntil)}d ago`
  if (daysUntil === 0) return "today"
  if (daysUntil === 1) return "tomorrow"
  return `in ${daysUntil}d`
}
