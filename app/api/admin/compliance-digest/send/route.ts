// POST /api/admin/compliance-digest/send
// Computes the current compliance digest and emails it to every active
// admin on the CRM. Triggered manually from the admin dashboard during
// testing; a Netlify scheduled function will wrap this same endpoint
// once we wire up weekly cron.

import { NextResponse } from "next/server"

import { requireRole } from "@/lib/auth"
import { getComplianceDigest } from "@/lib/compliance/digest"
import { sendEmail } from "@/lib/email"
import { buildComplianceDigestEmail } from "@/lib/emails/compliance-digest"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function resolveBaseUrl(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  return new URL(request.url).origin
}

export async function POST(request: Request) {
  await requireRole(["admin"])

  const admin = createAdminClient()
  const digest = await getComplianceDigest()

  // Resolve admin recipients: active profiles with role=admin, joined
  // to auth.users for the email + display name.
  const { data: adminProfiles, error: profilesErr } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("role", "admin")
    .eq("active", true)
  if (profilesErr) {
    return NextResponse.json({ error: profilesErr.message }, { status: 500 })
  }

  const { data: userList } = await admin.auth.admin.listUsers()
  const emailById = new Map<string, string>()
  for (const u of userList?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email)
  }

  const baseUrl = resolveBaseUrl(request)
  const dashboardUrl = `${baseUrl}/dashboard`

  type Outcome = {
    profileId: string
    email: string
    ok: boolean
    error?: string
  }
  const outcomes: Outcome[] = []

  for (const p of adminProfiles ?? []) {
    const email = emailById.get(p.id)
    if (!email) continue
    const built = buildComplianceDigestEmail({
      recipientName: p.full_name ?? null,
      digest,
      baseUrl,
      dashboardUrl,
    })
    const res = await sendEmail({
      to: email,
      subject: built.subject,
      html: built.html,
      text: built.text,
    })
    outcomes.push({
      profileId: p.id,
      email,
      ok: res.ok,
      error: res.ok ? undefined : res.error,
    })
  }

  return NextResponse.json({
    ok: true,
    totalItems: digest.totalCount,
    sent: outcomes.filter((o) => o.ok).length,
    failed: outcomes.filter((o) => !o.ok).length,
    recipients: outcomes.length,
  })
}
