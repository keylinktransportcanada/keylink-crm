import "server-only"

// Customer invoice email. Sent when accounting transitions a load from
// `delivered` → `invoiced`. Summary-only for v1 (no PDF attachment) —
// the totals, tax breakdown, and payment terms are spelled out in the
// email body. Customers reply for an official PDF copy until we wire
// that up.

export type InvoiceReadyEmailInput = {
  customerContactName: string | null
  customerName: string | null
  loadNumber: string
  referenceNumber: string | null
  poNumber: string | null
  // CAD amounts — already converted from any USD input upstream.
  subtotalCad: number | null
  taxAmountCad: number | null
  taxRatePct: number | null
  taxJurisdiction: string | null
  totalCad: number | null
  paymentTermsDays: number
  trackingUrl: string
  // Optional date the invoice was "issued" (today, in practice).
  issueDateISO: string
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

const CAD_FMT = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 2,
})

function fmtCAD(v: number | null): string {
  return v === null ? "—" : CAD_FMT.format(v)
}

function dueDateLabel(issueDateISO: string, termsDays: number): string {
  try {
    const d = new Date(issueDateISO)
    if (Number.isNaN(d.getTime())) return `Net ${termsDays}`
    d.setDate(d.getDate() + termsDays)
    return d.toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return `Net ${termsDays}`
  }
}

export function buildInvoiceReadyEmail(input: InvoiceReadyEmailInput): {
  subject: string
  html: string
  text: string
} {
  const subject = `Invoice ready · ${input.loadNumber} · ${fmtCAD(input.totalCad)}`
  const greeting = input.customerContactName
    ? `Hi ${escapeHtml(firstName(input.customerContactName))},`
    : input.customerName
      ? `Hi ${escapeHtml(input.customerName)},`
      : `Hi,`

  const taxLabel =
    input.taxRatePct != null && input.taxRatePct > 0
      ? `Tax (${input.taxRatePct}%${
          input.taxJurisdiction ? " · " + input.taxJurisdiction : ""
        })`
      : "Tax"

  const due = dueDateLabel(input.issueDateISO, input.paymentTermsDays)

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
                    Keylink Transport · Accounting
                  </td>
                </tr>
                <tr>
                  <td style="color:#ffffff;font-size:24px;font-weight:600;letter-spacing:0.01em;padding-top:8px;">
                    Invoice ready
                  </td>
                </tr>
                <tr>
                  <td style="color:${COLOR.cloud};font-size:14px;padding-top:6px;">
                    ${escapeHtml(input.loadNumber)}${input.referenceNumber ? " · Ref " + escapeHtml(input.referenceNumber) : ""}${input.poNumber ? " · PO " + escapeHtml(input.poNumber) : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:${COLOR.navy};">
                ${greeting} the invoice for shipment ${escapeHtml(input.loadNumber)} is ready.
                The summary is below — please remit payment by <strong>${escapeHtml(due)}</strong> (Net ${input.paymentTermsDays}).
              </p>

              <!-- Charge breakdown -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.bg};border:1px solid ${COLOR.border};border-radius:10px;margin:0 0 16px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
                      <tr>
                        <td style="padding:4px 0;color:${COLOR.slate};">Subtotal</td>
                        <td style="padding:4px 0;text-align:right;color:${COLOR.navy};font-variant-numeric:tabular-nums;">${escapeHtml(fmtCAD(input.subtotalCad))}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:${COLOR.slate};">${escapeHtml(taxLabel)}</td>
                        <td style="padding:4px 0;text-align:right;color:${COLOR.navy};font-variant-numeric:tabular-nums;">${escapeHtml(fmtCAD(input.taxAmountCad))}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0 4px;border-top:1px solid ${COLOR.border};color:${COLOR.navy};font-weight:600;">Total due</td>
                        <td style="padding:10px 0 4px;border-top:1px solid ${COLOR.border};text-align:right;color:${COLOR.navy};font-weight:700;font-size:16px;font-variant-numeric:tabular-nums;">${escapeHtml(fmtCAD(input.totalCad))}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 8px;">
                <tr>
                  <td style="background:${COLOR.teal};border-radius:10px;">
                    <a href="${escapeAttr(input.trackingUrl)}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                      View shipment details
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:${COLOR.slate};">
                Need a copy of the official invoice PDF, BOL, or POD? Reply to
                this email and we'll send them across.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:${COLOR.bg};padding:18px 32px;border-top:1px solid ${COLOR.border};">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${COLOR.slate};">
                Questions about this invoice? Reply to this email.<br/>
                Keylink Transport · Canadian transportation &amp; logistics
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
    `Invoice ready · ${input.loadNumber} · ${fmtCAD(input.totalCad)}`,
    ``,
    input.customerContactName
      ? `Hi ${firstName(input.customerContactName)},`
      : input.customerName
        ? `Hi ${input.customerName},`
        : `Hi,`,
    `The invoice for shipment ${input.loadNumber} is ready. Please remit by ${due} (Net ${input.paymentTermsDays}).`,
    ``,
    `Subtotal: ${fmtCAD(input.subtotalCad)}`,
    `${taxLabel}: ${fmtCAD(input.taxAmountCad)}`,
    `Total due: ${fmtCAD(input.totalCad)}`,
    ``,
    input.referenceNumber ? `Reference: ${input.referenceNumber}` : "",
    input.poNumber ? `PO: ${input.poNumber}` : "",
    ``,
    `Shipment details: ${input.trackingUrl}`,
    ``,
    `Need the PDF invoice or supporting docs? Reply to this email.`,
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
