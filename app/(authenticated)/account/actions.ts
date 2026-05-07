"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

type Result = { ok: true } | { error: string }

export async function updateMyAvatar(
  url: string | null,
): Promise<Result> {
  // null clears the column and the user falls back to initials.
  if (url !== null) {
    if (typeof url !== "string" || url.length === 0 || url.length > 500) {
      return { error: "Invalid avatar URL." }
    }
    if (!/^https:\/\//.test(url)) {
      return { error: "Avatar URL must be HTTPS." }
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not signed in." }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard")
  revalidatePath("/admin/employees")
  return { ok: true }
}
