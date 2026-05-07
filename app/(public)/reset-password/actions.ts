"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/schemas/auth"

type ActionResult = { error: string } | undefined

export async function setNewPassword(
  input: ResetPasswordInput,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Please enter a valid password (8+ characters)." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Reset link expired. Request a new one." }
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })
  if (error) {
    return { error: error.message }
  }

  redirect("/dashboard")
}
