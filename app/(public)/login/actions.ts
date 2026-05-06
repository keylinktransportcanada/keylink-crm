"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  loginSchema,
  magicLinkSchema,
  type LoginInput,
  type MagicLinkInput,
} from "@/lib/schemas/auth"

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

export async function sendMagicLink(input: MagicLinkInput): Promise<ActionResult> {
  const parsed = magicLinkSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Please enter a valid email." }
  }

  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ""
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  })

  if (error) {
    // Don't reveal whether the account exists; treat as success.
    return { ok: true }
  }

  return { ok: true }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login?reason=signed-out")
}
