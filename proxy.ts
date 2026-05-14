import { NextResponse, type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

const PUBLIC_PATHS = ["/login", "/auth", "/track"]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

export async function proxy(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  // Unauthenticated: allow public paths through, redirect everything else.
  // No `reason` is set here — that's reserved for actual events
  // (signOutAction → "signed-out", inactive check → "inactive",
  // auth callback failure → "expired").
  if (!user) {
    if (isPublicPath(pathname)) return response
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    return NextResponse.redirect(url)
  }

  // Authenticated: confirm the profile is active. Inactive users are signed
  // out so a stale cookie doesn't keep them in.
  const { data: profile } = await supabase
    .from("profiles")
    .select("active")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || !profile.active) {
    await supabase.auth.signOut()
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    url.searchParams.set("reason", "inactive")
    return NextResponse.redirect(url)
  }

  // Authenticated + active hitting /login or /: send them to /dashboard.
  if (pathname === "/login" || pathname === "/") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    // Run on every request except static assets and Next internals.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|mov)$).*)",
  ],
}
