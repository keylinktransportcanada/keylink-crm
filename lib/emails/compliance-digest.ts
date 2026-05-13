import "server-only"

import type { ComplianceDigest, DigestItem } from "@/lib/compliance/digest"

// Weekly compliance digest email. Three grouped sections — Expired,
// Critical (next 14 days), Warning (15–30 days) — with one row per
// expiring item. Deep-links back into the CRM so admins land on the
// right truck / driver / document directly from the inbox.

const COLOR = {
  navy: "#12294a",
  midnight: "#0a0e1a",
  gold: "#f0a820",
  teal: "#1a7b6e",
  cloud: "#e8edf5",
  slate: "#64748b",
  bg: "#f4f6fa",
  border: "#e2e8f0",
  red: "#b91c1c",
  amber: "#b45309",
  emerald: "#047857",
}

const ENTITY_LABEL: Record<DigestItem["entityType"], string> = {
  truck: "Truck",
  trailer: "Trailer",
  driver: "Driver",
  document: "Document",
}

export type ComplianceDigestEmailInput = {
  recipientName: string | null
  digest: ComplianceDigest
  baseUrl: string // e.g. https://keylink-crm.netlify.app
  dashboardUrl: string
}

export function buildComplianceDigestEmail(
  input: ComplianceDigestEmailInput,
): { subject: string; html: string; text: string } {
  const { digest } = input
  const subject = `Compliance digest · ${digest.totalCount} item${digest.totalCount === 1 ? "" : "s"} need attention`

  const greeting = input.recipientName
    ? `Hi ${escapeHtml(firstName(input.recipientName))},`
    : `Hi,`

  const allClear =
    digest.expired.length === 0 &&
    digest.critical.length === 0 &&
    digest.warning.length === 0

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLOR.navy};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px -12px rgba(18,41,74,0.18);">

          <tr>
            <td style="background:linear-gradient(135deg,${COLOR.midnight} 0%,${COLOR.navy} 100%);padding:28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:${COLOR.gold};font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">
                    Keylink Transport · Compliance digest
                  </td>
                </tr>
                <tr>
                  <td style="color:#ffffff;font-size:24px;font-weight:600;letter-spacing:0.01em;padding-top:8px;">
                    ${allClear ? "All clear" : `${digest.totalCount} item${digest.totalCount === 1 ? "" : "s"} need attention`}
                  </td>
                </tr>
                <tr>
                  <td style="color:${COLOR.cloud};font-size:14px;padding-top:6px;">
                    ${escapeHtml(humanDate(digest.today))}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 4px;">
              <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:${COLOR.navy};">
                ${greeting} here's the compliance picture for the next 30 days.
                ${allClear ? "Nothing is expiring inside the window — nice." : "Anything on this list keeps the fleet legal at the border and roadside, so worth a few minutes."}
              </p>
            </td>
          </tr>

          ${section(
            "Expired",
            digest.expired,
            COLOR.red,
            input.baseUrl,
            "Renew or replace immediately — these are already past their date.",
          )}
          ${section(
            "Critical · next 14 days",
            digest.critical,
            COLOR.amber,
            input.baseUrl,
            "Time-sensitive. Most renewals take a few business days.",
          )}
          ${section(
            "Warning · 15–30 days",
            digest.warning,
            COLOR.emerald,
            input.baseUrl,
          )}

          <tr>
            <td style="padding:16px 32px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:${COLOR.teal};border-radius:10px;">
                    <a href="${escapeAttr(input.dashboardUrl)}"
                       style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">
                      Open the dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:${COLOR.bg};padding:18px 32px;border-top:1px solid ${COLOR.border};">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${COLOR.slate};">
                You're receiving this because you're an admin on Keylink CRM.
                The digest is also visible inside the app on the dashboard.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = textVersion(input)

  return { subject, html, text }
}

function section(
  title: string,
  items: DigestItem[],
  accent: string,
  baseUrl: string,
  blurb?: string,
): string {
  if (items.length === 0) return ""
  return `<tr>
    <td style="padding:6px 32px 8px;">
      <div style="border-left:3px solid ${accent};padding-left:12px;margin-bottom:8px;">
        <div style="color:${accent};font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">${escapeHtml(title)}</div>
        ${blurb ? `<div style="color:${COLOR.slate};font-size:12px;padding-top:2px;">${escapeHtml(blurb)}</div>` : ""}
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
        ${items.map((i) => itemRow(i, baseUrl)).join("")}
      </table>
    </td>
  </tr>`
}

function itemRow(it: DigestItem, baseUrl: string): string {
  const url = `${baseUrl}${it.href}`
  const dateLabel = humanDate(it.date)
  const dayLabel =
    it.daysUntil < 0
      ? `Expired ${Math.abs(it.daysUntil)}d ago`
      : it.daysUntil === 0
        ? "Expires today"
        : `In ${it.daysUntil}d`
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid ${COLOR.border};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:top;">
            <a href="${escapeAttr(url)}" style="color:${COLOR.navy};text-decoration:none;">
              <div style="font-size:14px;font-weight:600;line-height:1.3;">
                ${escapeHtml(ENTITY_LABEL[it.entityType])} · ${escapeHtml(it.entity)}
              </div>
              <div style="font-size:13px;color:${COLOR.slate};padding-top:2px;">
                ${escapeHtml(it.field)} · ${escapeHtml(dateLabel)}
              </div>
            </a>
          </td>
          <td style="vertical-align:top;text-align:right;white-space:nowrap;">
            <span style="display:inline-block;background:${COLOR.bg};color:${COLOR.navy};font-size:11px;font-weight:600;padding:4px 8px;border-radius:6px;">
              ${escapeHtml(dayLabel)}
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>`
}

function textVersion(input: ComplianceDigestEmailInput): string {
  const { digest, baseUrl } = input
  const lines: string[] = []
  lines.push(
    `Compliance digest · ${digest.totalCount} item${digest.totalCount === 1 ? "" : "s"} · ${humanDate(digest.today)}`,
  )
  lines.push("")
  const grouped: Array<[string, DigestItem[]]> = [
    ["EXPIRED", digest.expired],
    ["CRITICAL (next 14 days)", digest.critical],
    ["WARNING (15-30 days)", digest.warning],
  ]
  for (const [label, items] of grouped) {
    if (items.length === 0) continue
    lines.push(label)
    for (const it of items) {
      const dayLabel =
        it.daysUntil < 0
          ? `expired ${Math.abs(it.daysUntil)}d ago`
          : it.daysUntil === 0
            ? "today"
            : `in ${it.daysUntil}d`
      lines.push(
        `  • ${ENTITY_LABEL[it.entityType]} ${it.entity} — ${it.field} (${dayLabel}) → ${baseUrl}${it.href}`,
      )
    }
    lines.push("")
  }
  if (
    digest.expired.length === 0 &&
    digest.critical.length === 0 &&
    digest.warning.length === 0
  ) {
    lines.push("Nothing expiring in the next 30 days. All clear.")
  }
  lines.push("")
  lines.push(`Open the dashboard: ${input.dashboardUrl}`)
  lines.push("— Keylink Transport")
  return lines.join("\n")
}

function humanDate(iso: string): string {
  try {
    const d = new Date(`${iso}T12:00:00`)
    return d.toLocaleDateString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || "there"
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;")
}
