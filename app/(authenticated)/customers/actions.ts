"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth"
import {
  customerSchema,
  updateCustomerSchema,
  type CustomerInput,
  type UpdateCustomerInput,
} from "@/lib/schemas/customers"
import { createClient } from "@/lib/supabase/server"

type FieldErrors = Partial<Record<string, string[]>>
type Result = { ok: true; id: string } | { error: FieldErrors }
type SimpleResult = { ok: true } | { error: string }

function toRow(input: CustomerInput) {
  return {
    name: input.name,
    contact_name: input.contact_name || null,
    email: input.email || null,
    phone: input.phone || null,
    address: input.address || null,
    billing_address: input.billing_address || null,
    payment_terms_days: input.payment_terms_days,
    credit_limit_cad: input.credit_limit_cad ?? null,
    notes: input.notes || null,
    active: input.active,
    tax_id: input.tax_id || null,
    tax_exempt: input.tax_exempt,
  }
}

export async function createCustomer(input: CustomerInput): Promise<Result> {
  await requireRole(["admin", "dispatcher"])

  const parsed = customerSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("customers")
    .insert(toRow(parsed.data))
    .select("id")
    .single()

  if (error) {
    return { error: { _form: [error.message] } }
  }

  revalidatePath("/customers")
  return { ok: true, id: data.id }
}

export async function updateCustomer(
  input: UpdateCustomerInput,
): Promise<Result> {
  await requireRole(["admin", "dispatcher"])

  const parsed = updateCustomerSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("customers")
    .update(toRow(parsed.data))
    .eq("id", parsed.data.id)

  if (error) {
    return { error: { _form: [error.message] } }
  }

  revalidatePath("/customers")
  return { ok: true, id: parsed.data.id }
}

export async function setCustomerActive(
  id: string,
  active: boolean,
): Promise<SimpleResult> {
  await requireRole(["admin", "dispatcher"])

  const supabase = await createClient()
  const { error } = await supabase
    .from("customers")
    .update({ active })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/customers")
  return { ok: true }
}
