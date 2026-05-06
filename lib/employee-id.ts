import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

export async function getNextEmployeeId(): Promise<string> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("next_employee_id")
  if (error) {
    throw new Error(`Failed to get next employee ID: ${error.message}`)
  }
  if (!data) {
    throw new Error("next_employee_id() returned no value")
  }
  return data
}
