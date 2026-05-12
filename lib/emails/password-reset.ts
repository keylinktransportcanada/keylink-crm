import "server-only"

// Branded password-reset email. Sent by sendPasswordReset (which uses
// admin.generateLink to mint the recovery URL) so we control both the
// envelope and the template. Replaces Supabase's default reset email
// for our domain users — the Supabase template is only kept as fallback
// for the auth flows we don't intercept (email change confirmation).

export type PasswordResetEmailInput = {
  fullName: string | null
  actionLink: string // pre-signed Supabase recovery URL → set password
  loginUrl: string // bookmark URL fallback
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

export function buildPasswordResetEmail(input: PasswordResetEmailInput): {
  subject: string
  html: string
  text: string
} {
  const subject = `Reset your Keylink Transport password`
  const greeting = input.fullName
    ? `Hi ${escapeHtml(firstName(input.fullName))},`
    : `Hi there,`

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
                    Keylink Transport
                  </td>
                </tr>
                <tr>
                  <td style="color:#ffffff;font-size:24px;font-weight:600;letter-spacing:0.01em;padding-top:8px;">
                    Reset your password
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${COLOR.navy};">
                ${greeting}
              </p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${COLOR.navy};">
                We received a request to reset the password on your Keylink
                Transport account. Click the button below to set a new one.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">
                <tr>
                  <td style="background:${COLOR.teal};border-radius:10px;">
                    <a href="${escapeAttr(input.actionLink)}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                      Set a new password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:${COLOR.slate};">
                This link is single-use and expires in 1 hour. If it doesn't work,
                head to
                <a href="${escapeAttr(input.loginUrl)}" style="color:${COLOR.teal};text-decoration:none;">${escapeHtml(stripScheme(input.loginUrl))}</a>
                and request another one.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:8px 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${COLOR.border};padding-top:18px;margin-top:12px;">
                <tr>
                  <td style="font-size:13px;line-height:1.5;color:${COLOR.slate};">
                    Didn't request this? Ignore this email — your password
                    stays the same and the link does nothing until clicked.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:${COLOR.bg};padding:18px 32px;border-top:1px solid ${COLOR.border};">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${COLOR.slate};">
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
    `Reset your Keylink Transport password`,
    ``,
    input.fullName ? `Hi ${firstName(input.fullName)},` : `Hi there,`,
    ``,
    `We received a request to reset the password on your Keylink Transport account.`,
    ``,
    `Set a new password: ${input.actionLink}`,
    ``,
    `This link is single-use and expires in 1 hour. If it doesn't work, request another one at ${input.loginUrl}.`,
    ``,
    `Didn't request this? Ignore this email — your password stays the same.`,
    ``,
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
