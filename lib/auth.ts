import "server-only"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import type { AppRole, Tables } from "@/lib/supabase/types"

export type Role = AppRole

export type CurrentProfile = Pick<
  Tables<"profiles">,
  "id" | "role" | "full_name" | "phone" | "employee_id" | "active"
>

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone, employee_id, active")
    .eq("id", user.id)
    .single()

  return data
}

export async function requireRole(allowed: Role[]): Promise<CurrentProfile> {
  const profile = await getCurrentProfile()
  if (!profile) {
    redirect("/login?reason=signed-out")
  }
  if (!profile.active) {
    redirect("/login?reason=inactive")
  }
  if (!allowed.includes(profile.role)) {
    redirect("/dashboard")
  }
  return profile
}
