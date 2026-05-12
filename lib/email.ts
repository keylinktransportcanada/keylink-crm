import "server-only"

import { Resend } from "resend"

// Single sender for all outbound CRM email during the testing phase.
// Configured in CLAUDE memory: project_email_sender. Swap to dispatch@
// before onboarding real customers.
const FROM = "Keylink Transport <shahazeen@keylinktransport.com>"
const REPLY_TO = "shahazeen@keylinktransport.com"

let cachedClient: Resend | null = null

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  if (!cachedClient) {
    cachedClient = new Resend(key)
  }
  return cachedClient
}

export type SendEmailInput = {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string }

// Single point of egress for app emails. Returns ok:false instead of
// throwing so callers can log + continue — a missed welcome email
// shouldn't roll back the employee row.
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const client = getClient()
  if (!client) {
    return {
      ok: false,
      error: "RESEND_API_KEY is not configured in this environment.",
    }
  }

  try {
    const result = await client.emails.send({
      from: FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: REPLY_TO,
    })

    if (result.error) {
      return { ok: false, error: result.error.message }
    }

    return { ok: true, id: result.data?.id ?? null }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown email error",
    }
  }
}
