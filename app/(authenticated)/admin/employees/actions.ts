"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth"
import {
  createEmployeeSchema,
  setPasswordSchema,
  updateEmployeeSchema,
  type CreateEmployeeInput,
  type SetPasswordInput,
  type UpdateEmployeeInput,
} from "@/lib/schemas/employees"
import { getNextEmployeeId as rpcNextEmployeeId } from "@/lib/employee-id"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { generateTempPassword } from "@/lib/temp-password"

type FieldErrors = Partial<Record<string, string[]>>

type CreateResult =
  | { ok: true; tempPassword: string; employeeId: string }
  | { error: FieldErrors }

type UpdateResult = { ok: true } | { error: FieldErrors }

type ToggleResult = { ok: true } | { error: string }

export async function getNextEmployeeIdAction(): Promise<string> {
  await requireRole(["admin"])
  return rpcNextEmployeeId()
}

export async function createEmployee(
  input: CreateEmployeeInput,
): Promise<CreateResult> {
  await requireRole(["admin"])

  const parsed = createEmployeeSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const admin = createAdminClient()
  const tempPassword = generateTempPassword(16)

  // Service-role required to create auth users.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
      role: parsed.data.role,
    },
  })

  if (createErr || !created.user) {
    return {
      error: {
        _form: [createErr?.message ?? "Failed to create user."],
      },
    }
  }

  const userId = created.user.id

  // The on_auth_user_created trigger has already inserted a profiles row
  // with full_name + role from user_metadata. Now patch in phone +
  // employee_id via the admin's session so the audit trigger captures
  // auth.uid() correctly.
  const userClient = await createClient()
  const { error: updateErr } = await userClient
    .from("profiles")
    .update({
      phone: parsed.data.phone || null,
      employee_id: parsed.data.employee_id,
    })
    .eq("id", userId)

  if (updateErr) {
    // Roll back the auth user so we don't leak a half-onboarded account.
    await admin.auth.admin.deleteUser(userId)
    return {
      error: {
        _form: [`Failed to set profile fields: ${updateErr.message}`],
      },
    }
  }

  revalidatePath("/admin/employees")

  return {
    ok: true,
    tempPassword,
    employeeId: parsed.data.employee_id,
  }
}

export async function updateEmployee(
  input: UpdateEmployeeInput,
): Promise<UpdateResult> {
  await requireRole(["admin"])

  const parsed = updateEmployeeSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const userClient = await createClient()
  const { error } = await userClient
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
      role: parsed.data.role,
    })
    .eq("id", parsed.data.id)

  if (error) {
    return { error: { _form: [error.message] } }
  }

  revalidatePath("/admin/employees")
  return { ok: true }
}

type SetPasswordResult =
  | { ok: true; emailSent: boolean }
  | { error: FieldErrors }

export async function setEmployeePassword(
  input: SetPasswordInput,
): Promise<SetPasswordResult> {
  const actor = await requireRole(["admin"])

  const parsed = setPasswordSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  if (parsed.data.id === actor.id) {
    return {
      error: {
        _form: [
          "You can't reset your own password from this flow. Sign out and use the password reset link on the login page.",
        ],
      },
    }
  }

  const admin = createAdminClient()

  const { data: updated, error: updateErr } =
    await admin.auth.admin.updateUserById(parsed.data.id, {
      password: parsed.data.password,
    })

  if (updateErr || !updated.user) {
    return {
      error: {
        _form: [updateErr?.message ?? "Failed to set password."],
      },
    }
  }

  // Notification: trigger Supabase's recovery email so the user knows their
  // password changed. They can either use the new password (admin shares it
  // out-of-band) or click the recovery link to set their own. The email body
  // uses Supabase's default "Reset password" template; customize it under
  // Authentication -> Email Templates -> Reset Password if a custom
  // "Your password was changed" copy is wanted later.
  let emailSent = false
  const targetEmail = updated.user.email
  if (targetEmail) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ""
    const userClient = await createClient()
    const { error: emailErr } = await userClient.auth.resetPasswordForEmail(
      targetEmail,
      {
        redirectTo: siteUrl ? `${siteUrl}/auth/callback` : undefined,
      },
    )
    emailSent = !emailErr
  }

  revalidatePath("/admin/employees")
  return { ok: true, emailSent }
}

export async function deleteEmployee(id: string): Promise<ToggleResult> {
  const actor = await requireRole(["admin"])

  if (id === actor.id) {
    return { error: "You can't delete your own account." }
  }

  // Deleting an auth.users row cascades to profiles via the FK on
  // profiles.id (ON DELETE CASCADE). audit_log entries are preserved with
  // actor_id set to NULL because that FK is ON DELETE SET NULL.
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) {
    return { error: error.message }
  }

  revalidatePath("/admin/employees")
  return { ok: true }
}

export async function setEmployeeActive(
  id: string,
  active: boolean,
): Promise<ToggleResult> {
  await requireRole(["admin"])

  const userClient = await createClient()
  const { error: profileErr } = await userClient
    .from("profiles")
    .update({ active })
    .eq("id", id)

  if (profileErr) {
    return { error: profileErr.message }
  }

  // Banning the auth user is the second layer: middleware also blocks via
  // profiles.active, but a banned user can't even mint a fresh JWT.
  const admin = createAdminClient()
  const { error: banErr } = await admin.auth.admin.updateUserById(id, {
    ban_duration: active ? "none" : "876000h",
  })

  if (banErr) {
    return { error: banErr.message }
  }

  revalidatePath("/admin/employees")
  return { ok: true }
}
