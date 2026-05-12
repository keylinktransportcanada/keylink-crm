"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { sendEmail } from "@/lib/email"
import { buildPasswordResetEmail } from "@/lib/emails/password-reset"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  loginSchema,
  passwordResetRequestSchema,
  type LoginInput,
  type PasswordResetRequestInput,
} from "@/lib/schemas/auth"

// Resolve the public site URL with three fallbacks so password-reset links
// always point at the right origin:
//   1. NEXT_PUBLIC_SITE_URL env (set on Netlify in prod)
//   2. Request's x-forwarded-host (when serving behind Netlify proxy)
//   3. host header (local dev)
async function resolveSiteUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? ""
  return host ? `${proto}://${host}` : ""
}

type ActionResult = { error: string } | { ok: true } | undefined

export async function signInWithPassword(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Invalid email or password." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: "Invalid email or password." }
  }

  redirect("/dashboard")
}

export async function sendPasswordReset(
  input: PasswordResetRequestInput,
): Promise<ActionResult> {
  const parsed = passwordResetRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Please enter a valid email." }
  }

  const siteUrl = await resolveSiteUrl()
  const admin = createAdminClient()

  // Best-effort name lookup so the email can greet by first name.
  // auth.users.email → users list → profiles. Silently skip if it fails.
  let fullName: string | null = null
  try {
    const { data: userList } = await admin.auth.admin.listUsers()
    const user = userList?.users.find(
      (u) => u.email?.toLowerCase() === parsed.data.email.toLowerCase(),
    )
    if (user) {
      const { data: p } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle()
      fullName = p?.full_name ?? null
    }
  } catch {
    // Ignore — name is just a nicety.
  }

  // Mint a recovery link via admin API and send our branded email through
  // Resend. If the email doesn't correspond to a user, generateLink will
  // 400 — swallow it so we don't leak which addresses are registered.
  try {
    const { data: linkData, error: linkErr } =
      await admin.auth.admin.generateLink({
        type: "recovery",
        email: parsed.data.email,
        options: {
          redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
        },
      })

    // Use the hashed_token via our own /auth/confirm route instead of
    // Supabase's action_link — the latter uses the implicit/fragment flow
    // which our server-side callback can't read, causing "link expired"
    // bounces. verifyOtp(token_hash) works cleanly server-side.
    const tokenHash = linkData?.properties?.hashed_token
    if (!linkErr && tokenHash) {
      const actionLink = `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&next=/reset-password`
      const { subject, html, text } = buildPasswordResetEmail({
        fullName,
        actionLink,
        loginUrl: `${siteUrl}/login`,
      })
      await sendEmail({
        to: parsed.data.email,
        subject,
        html,
        text,
      })
    }
  } catch {
    // Swallow — we don't reveal whether the email exists or whether
    // sending succeeded.
  }

  // Always return ok to avoid leaking account existence.
  return { ok: true }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login?reason=signed-out")
}
