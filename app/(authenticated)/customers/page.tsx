import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

import { CustomersTable, type CustomerRow } from "./customers-table"

export default async function CustomersPage() {
  const me = await requireRole(["admin", "dispatcher", "accounting"])
  const canEdit = me.role === "admin" || me.role === "dispatcher"

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, name, contact_name, email, phone, address, billing_address, payment_terms_days, credit_limit_cad, notes, active, created_at",
    )
    .order("name", { ascending: true })

  const customers: CustomerRow[] = data ?? []

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Shippers and receivers loads are billed to. Archive disables a
            customer for new loads but preserves history.
          </p>
        </div>
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn&apos;t load customers: {error.message}
        </div>
      ) : (
        <CustomersTable customers={customers} canEdit={canEdit} />
      )}
    </div>
  )
}
