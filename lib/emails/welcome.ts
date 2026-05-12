import "server-only"

// Welcome-email template sent by createEmployee. Branded with Keylink
// colors; uses table-based layout because email clients (Outlook, Gmail
// mobile, Apple Mail) drop or mangle flexbox/grid.
//
// All copy and links live in this file — the action just hands in data.

export type WelcomeEmailInput = {
  fullName: string
  employeeId: string
  role: "admin" | "dispatcher" | "driver" | "accounting"
  actionLink: string // pre-signed Supabase recovery URL → set password
  loginUrl: string // bookmark URL for after they set their password
}

const ROLE_LABEL: Record<WelcomeEmailInput["role"], string> = {
  admin: "Admin",
  dispatcher: "Dispatcher",
  driver: "Driver",
  accounting: "Accounting",
}

const COLOR = {
  navy: "#12294a",
  midnight: "#0a0e1a",
  gold: "#f0a820",
  teal: "#1a7b6e",
  tealLight: "#22a092",
  cloud: "#e8edf5",
  slate: "#64748b",
  bg: "#f4f6fa",
  border: "#e2e8f0",
}

export function buildWelcomeEmail(input: WelcomeEmailInput): {
  subject: string
  html: string
  text: string
} {
  const subject = `Welcome to Keylink Transport — set up your account`
  const roleLabel = ROLE_LABEL[input.role]

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

          <!-- Header band -->
          <tr>
            <td style="background:linear-gradient(135deg,${COLOR.midnight} 0%,${COLOR.navy} 100%);padding:28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:${COLOR.gold};font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">
                    Keylink Transport
                  </td>
                </tr>
                <tr>
                  <td style="color:#ffffff;font-size:24px;font-weight:600;letter-spacing:0.01em;padding-top:8px;">
                    Welcome aboard, ${escapeHtml(firstName(input.fullName))}.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${COLOR.navy};">
                You've been added to the Keylink Transport CRM as a <strong>${escapeHtml(roleLabel)}</strong>.
                Your account is ready — set your password to get started.
              </p>

              <!-- Employee ID card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
                <tr>
                  <td style="background:${COLOR.bg};border:1px solid ${COLOR.border};border-radius:10px;padding:14px 18px;">
                    <div style="color:${COLOR.slate};font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;">
                      Your employee ID
                    </div>
                    <div style="color:${COLOR.navy};font-family:'SF Mono',Monaco,Consolas,'Courier New',monospace;font-size:18px;font-weight:600;padding-top:4px;">
                      ${escapeHtml(input.employeeId)}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">
                <tr>
                  <td style="background:${COLOR.teal};border-radius:10px;">
                    <a href="${escapeAttr(input.actionLink)}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                      Set your password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${COLOR.slate};">
                This link is single-use. If it expires, go to
                <a href="${escapeAttr(input.loginUrl)}" style="color:${COLOR.teal};text-decoration:none;">${escapeHtml(stripScheme(input.loginUrl))}</a>
                and click "Forgot password" — we'll send you a fresh one.
              </p>
            </td>
          </tr>

          <!-- What's next -->
          <tr>
            <td style="padding:8px 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${COLOR.border};padding-top:20px;margin-top:12px;">
                <tr>
                  <td style="color:${COLOR.slate};font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;padding-bottom:8px;">
                    What's next
                  </td>
                </tr>
                <tr>
                  <td style="font-size:14px;line-height:1.6;color:${COLOR.navy};">
                    ${nextSteps(input.role)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:${COLOR.bg};padding:18px 32px;border-top:1px solid ${COLOR.border};">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${COLOR.slate};">
                Questions? Reply to this email and it'll land in dispatch.<br/>
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
    `Welcome to Keylink Transport, ${firstName(input.fullName)}.`,
    ``,
    `You've been added to the Keylink Transport CRM as a ${roleLabel}.`,
    ``,
    `Your employee ID: ${input.employeeId}`,
    ``,
    `Set your password: ${input.actionLink}`,
    ``,
    `If that link expires, go to ${input.loginUrl} and click "Forgot password".`,
    ``,
    `Questions? Reply to this email.`,
    `— Keylink Transport`,
  ].join("\n")

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

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, "")
}

function nextSteps(role: WelcomeEmailInput["role"]): string {
  switch (role) {
    case "admin":
      return `You can onboard more employees, manage compliance records, and see the full company overview from the Dashboard.`
    case "dispatcher":
      return `Head to <strong>Loads</strong> to start dispatching, or <strong>Drivers</strong> to see who's available.`
    case "driver":
      return `Open <strong>Dashboard</strong> on your phone — bookmark it. You'll see your assigned loads, can upload BOLs/PODs, and update status with one tap.`
    case "accounting":
      return `The <strong>Accounting</strong> tab has the invoice queue and A/R aging. <strong>Reports</strong> covers revenue and IFTA.`
  }
}
