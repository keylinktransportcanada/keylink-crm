import "server-only"

import type { LoadStatus } from "@/lib/supabase/types"

// Customer-facing status-update email. Sent when a load reaches a
// milestone status the customer cares about (picked up, in transit,
// delivered, cancelled). The single CTA is the public tracking link
// for this load — no auth required, just a long signed slug.

export type LoadStatusUpdateEmailInput = {
  customerContactName: string | null
  customerName: string | null
  loadNumber: string
  status: LoadStatus
  origin: {
    city: string | null
    province: string | null
  }
  destination: {
    city: string | null
    province: string | null
  }
  trackingUrl: string
  referenceNumber: string | null
}

const COLOR = {
  navy: "#12294a",
  midnight: "#0a0e1a",
  gold: "#f0a820",
  teal: "#1a7b6e",
  cloud: "#e8edf5",
  slate: "#64748b",
  bg: "#f4f6fa",
  border: "#e2e8f0",
}

// Maps status → human-friendly subject phrase + opening sentence.
const STATUS_COPY: Partial<
  Record<
    LoadStatus,
    {
      subjectPhrase: string
      headline: string
      body: (loadNumber: string) => string
    }
  >
> = {
  at_pickup: {
    subjectPhrase: "Driver arrived at pickup",
    headline: "Driver at pickup",
    body: (n) =>
      `Our driver has arrived at the pickup location for shipment ${n}. We'll let you know once it's loaded.`,
  },
  loaded: {
    subjectPhrase: "Shipment picked up",
    headline: "Picked up",
    body: (n) =>
      `Shipment ${n} has been loaded and is leaving the pickup location. We'll keep you posted as it moves.`,
  },
  in_transit: {
    subjectPhrase: "Shipment in transit",
    headline: "In transit",
    body: (n) =>
      `Shipment ${n} is now in transit toward the destination.`,
  },
  at_delivery: {
    subjectPhrase: "Arriving at delivery",
    headline: "Arriving at delivery",
    body: (n) =>
      `The driver has arrived at the delivery location for shipment ${n}. Delivery is in progress.`,
  },
  delivered: {
    subjectPhrase: "Shipment delivered",
    headline: "Delivered",
    body: (n) =>
      `Shipment ${n} has been delivered. Thanks for shipping with Keylink Transport.`,
  },
  cancelled: {
    subjectPhrase: "Shipment cancelled",
    headline: "Cancelled",
    body: (n) =>
      `Shipment ${n} has been cancelled. If this wasn't expected, please reply to this email and we'll follow up.`,
  },
}

export function shouldNotifyCustomer(status: LoadStatus): boolean {
  return status in STATUS_COPY
}

export function buildLoadStatusUpdateEmail(
  input: LoadStatusUpdateEmailInput,
): { subject: string; html: string; text: string } | null {
  const copy = STATUS_COPY[input.status]
  if (!copy) return null

  const subject = `${copy.subjectPhrase} · ${input.loadNumber}`
  const greeting = input.customerContactName
    ? `Hi ${escapeHtml(firstName(input.customerContactName))},`
    : input.customerName
      ? `Hi ${escapeHtml(input.customerName)},`
      : `Hi,`

  const originLabel =
    [input.origin.city, input.origin.province].filter(Boolean).join(", ") ||
    "—"
  const destLabel =
    [input.destination.city, input.destination.province]
      .filter(Boolean)
      .join(", ") || "—"

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
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px -12px rgba(18,41,74,0.18);">

          <tr>
            <td style="background:linear-gradient(135deg,${COLOR.midnight} 0%,${COLOR.navy} 100%);padding:28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:${COLOR.gold};font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">
                    Keylink Transport · Shipment update
                  </td>
                </tr>
                <tr>
                  <td style="color:#ffffff;font-size:24px;font-weight:600;letter-spacing:0.01em;padding-top:8px;">
                    ${escapeHtml(copy.headline)}
                  </td>
                </tr>
                <tr>
                  <td style="color:${COLOR.cloud};font-size:14px;padding-top:6px;">
                    ${escapeHtml(input.loadNumber)}${input.referenceNumber ? " · Ref " + escapeHtml(input.referenceNumber) : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${COLOR.navy};">
                ${greeting}
              </p>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:${COLOR.navy};">
                ${escapeHtml(copy.body(input.loadNumber))}
              </p>

              <!-- Route row -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.bg};border:1px solid ${COLOR.border};border-radius:10px;margin:0 0 16px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="vertical-align:top;width:45%;">
                          <div style="color:${COLOR.slate};font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;">From</div>
                          <div style="color:${COLOR.navy};font-size:14px;font-weight:600;padding-top:4px;">
                            ${escapeHtml(originLabel)}
                          </div>
                        </td>
                        <td style="vertical-align:middle;text-align:center;width:10%;color:${COLOR.teal};font-size:18px;font-weight:600;">→</td>
                        <td style="vertical-align:top;width:45%;">
                          <div style="color:${COLOR.slate};font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;">To</div>
                          <div style="color:${COLOR.navy};font-size:14px;font-weight:600;padding-top:4px;">
                            ${escapeHtml(destLabel)}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">
                <tr>
                  <td style="background:${COLOR.teal};border-radius:10px;">
                    <a href="${escapeAttr(input.trackingUrl)}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                      Track this shipment
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:${COLOR.slate};">
                Bookmark the tracking link to check the latest status anytime —
                no login required.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:${COLOR.bg};padding:18px 32px;border-top:1px solid ${COLOR.border};">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${COLOR.slate};">
                Questions? Reply to this email and we'll get back to you.<br/>
                Keylink Transport
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `${copy.headline} · ${input.loadNumber}`,
    ``,
    input.customerContactName
      ? `Hi ${firstName(input.customerContactName)},`
      : input.customerName
        ? `Hi ${input.customerName},`
        : `Hi,`,
    copy.body(input.loadNumber),
    ``,
    `Route: ${originLabel} → ${destLabel}`,
    input.referenceNumber ? `Reference: ${input.referenceNumber}` : "",
    ``,
    `Track this shipment: ${input.trackingUrl}`,
    ``,
    `— Keylink Transport`,
  ]
    .filter(Boolean)
    .join("\n")

  return { subject, html, text }
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
