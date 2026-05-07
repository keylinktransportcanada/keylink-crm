import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

import { AddEmployeeButton } from "./add-employee-button"
import { EmployeesTable, type EmployeeRow } from "./employees-table"

export default async function EmployeesPage() {
  const me = await requireRole(["admin"])
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, employee_id, role, phone, active, avatar_url, created_at",
    )
    .order("created_at", { ascending: false })

  const employees: EmployeeRow[] = data ?? []

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            Onboard, update, and deactivate employees. Email is fixed at
            creation; everything else can be edited.
          </p>
        </div>
        <AddEmployeeButton />
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn&apos;t load employees: {error.message}
        </div>
      ) : (
        <EmployeesTable employees={employees} currentUserId={me.id} />
      )}
    </div>
  )
}
