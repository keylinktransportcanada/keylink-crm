import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

// Server-side handler for email-based auth tokens (password reset, magic
// link, email confirmation). We send users to this route from our own
// branded emails with the token_hash returned by admin.generateLink —
// verifyOtp here exchanges that hash for a real session cookie, then
// redirects to the next page (typically /reset-password).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as
    | "recovery"
    | "email"
    | "invite"
    | "magiclink"
    | "email_change"
    | null
  const nextParam = searchParams.get("next")
  // Only same-origin relative paths — prevents open-redirect via a crafted link.
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard"

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  return NextResponse.redirect(new URL("/login?reason=expired", request.url))
}
