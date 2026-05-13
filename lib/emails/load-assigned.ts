import "server-only"

// Load-assignment email — sent to a driver when dispatch assigns them a
// load (either at create-time with a driver attached, or on a later edit
// that swaps the driver). Same visual language as the other Phase 12
// emails (welcome, password-reset).

export type LoadAssignedEmailInput = {
  driverFullName: string | null
  loadNumber: string
  customerName: string | null
  origin: {
    city: string | null
    province: string | null
    company: string | null
  }
  destination: {
    city: string | null
    province: string | null
    company: string | null
  }
  pickupDate: string | null // ISO yyyy-mm-dd
  deliveryDate: string | null // ISO yyyy-mm-dd
  equipment: string | null
  isCrossBorder: boolean
  loadUrl: string // absolute /loads/:id
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

export function buildLoadAssignedEmail(input: LoadAssignedEmailInput): {
  subject: string
  html: string
  text: string
} {
  const subject = `New load assigned · ${input.loadNumber}${
    input.customerName ? ` — ${input.customerName}` : ""
  }`

  const greeting = input.driverFullName
    ? `Hi ${escapeHtml(firstName(input.driverFullName))},`
    : `Hi,`

  const originLabel = formatPlace(input.origin)
  const destLabel = formatPlace(input.destination)

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
                    Keylink Transport · Dispatch
                  </td>
                </tr>
                <tr>
                  <td style="color:#ffffff;font-size:24px;font-weight:600;letter-spacing:0.01em;padding-top:8px;">
                    New load assigned
                  </td>
                </tr>
                <tr>
                  <td style="color:${COLOR.cloud};font-size:14px;padding-top:6px;">
                    ${escapeHtml(input.loadNumber)}${input.customerName ? " · " + escapeHtml(input.customerName) : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:${COLOR.navy};">
                ${greeting} dispatch has assigned you a new load.
              </p>

              <!-- Route card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.bg};border:1px solid ${COLOR.border};border-radius:10px;margin:0 0 16px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="vertical-align:top;width:38%;">
                          <div style="color:${COLOR.slate};font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;">Pickup</div>
                          <div style="color:${COLOR.navy};font-size:14px;font-weight:600;padding-top:4px;line-height:1.3;">
                            ${escapeHtml(originLabel || "—")}
                          </div>
                          <div style="color:${COLOR.slate};font-size:12px;padding-top:2px;">
                            ${formatDate(input.pickupDate)}
                          </div>
                        </td>
                        <td style="vertical-align:middle;text-align:center;width:24%;color:${COLOR.teal};font-size:20px;font-weight:600;">→</td>
                        <td style="vertical-align:top;width:38%;">
                          <div style="color:${COLOR.slate};font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;">Delivery</div>
                          <div style="color:${COLOR.navy};font-size:14px;font-weight:600;padding-top:4px;line-height:1.3;">
                            ${escapeHtml(destLabel || "—")}
                          </div>
                          <div style="color:${COLOR.slate};font-size:12px;padding-top:2px;">
                            ${formatDate(input.deliveryDate)}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Meta row: equipment, cross-border, reference -->
              ${metaRow(input)}

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">
                <tr>
                  <td style="background:${COLOR.teal};border-radius:10px;">
                    <a href="${escapeAttr(input.loadUrl)}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                      Open load
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:${COLOR.slate};">
                Open the load in the CRM to see the full pickup/delivery windows,
                customer references, and start updating status as you roll.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:${COLOR.bg};padding:18px 32px;border-top:1px solid ${COLOR.border};">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${COLOR.slate};">
                Questions? Reply to this email and dispatch will pick it up.<br/>
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
    `New load assigned · ${input.loadNumber}${input.customerName ? " — " + input.customerName : ""}`,
    ``,
    input.driverFullName
      ? `Hi ${firstName(input.driverFullName)},`
      : `Hi,`,
    `Dispatch has assigned you a new load.`,
    ``,
    `Pickup:   ${originLabel || "—"}${input.pickupDate ? "  (" + formatDate(input.pickupDate) + ")" : ""}`,
    `Delivery: ${destLabel || "—"}${input.deliveryDate ? "  (" + formatDate(input.deliveryDate) + ")" : ""}`,
    input.equipment ? `Equipment: ${input.equipment}` : "",
    input.isCrossBorder ? `Cross-border: yes (PARS/ACI/ACE applies)` : "",
    input.referenceNumber ? `Reference:  ${input.referenceNumber}` : "",
    ``,
    `Open load: ${input.loadUrl}`,
    ``,
    `Questions? Reply to this email.`,
    `— Keylink Transport`,
  ]
    .filter(Boolean)
    .join("\n")

  return { subject, html, text }
}

function metaRow(input: LoadAssignedEmailInput): string {
  const chips: string[] = []
  if (input.equipment) chips.push(chip("Equipment", input.equipment))
  if (input.isCrossBorder) chips.push(chip("Cross-border", "Yes"))
  if (input.referenceNumber) chips.push(chip("Reference", input.referenceNumber))
  if (chips.length === 0) return ""

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
    <tr>
      ${chips
        .map(
          (c) =>
            `<td style="vertical-align:top;padding-right:8px;padding-bottom:8px;">${c}</td>`,
        )
        .join("")}
    </tr>
  </table>`
}

function chip(label: string, value: string): string {
  return `<div style="background:${COLOR.bg};border:1px solid ${COLOR.border};border-radius:8px;padding:8px 12px;display:inline-block;">
    <div style="color:${COLOR.slate};font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;">${escapeHtml(label)}</div>
    <div style="color:${COLOR.navy};font-size:13px;font-weight:600;padding-top:2px;">${escapeHtml(value)}</div>
  </div>`
}

function formatPlace(p: LoadAssignedEmailInput["origin"]): string {
  const cityProv = [p.city, p.province].filter(Boolean).join(", ")
  return p.company ? `${p.company}\n${cityProv}` : cityProv
}

function formatDate(iso: string | null): string {
  if (!iso) return "Date TBD"
  // iso is yyyy-mm-dd; render as e.g. "Tue May 19"
  try {
    const d = new Date(`${iso}T12:00:00`)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
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
