"use client"

import { useState, useTransition } from "react"
import { format } from "date-fns"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RoleBadge } from "@/components/shared/role-badge"
import { UserAvatar } from "@/components/shared/user-avatar"
import { type ROLE_VALUES } from "@/lib/schemas/employees"

import { setEmployeeActive } from "./actions"
import { EditEmployeeDialog } from "./edit-employee-dialog"

export type EmployeeRow = {
  id: string
  full_name: string
  employee_id: string | null
  role: (typeof ROLE_VALUES)[number]
  phone: string | null
  active: boolean
  avatar_url: string | null
  created_at: string
}

export function EmployeesTable({
  employees,
}: {
  employees: EmployeeRow[]
}) {
  const [editing, setEditing] = useState<EmployeeRow | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleToggleActive = (employee: EmployeeRow) => {
    setPendingId(employee.id)
    startTransition(async () => {
      const result = await setEmployeeActive(employee.id, !employee.active)
      setPendingId(null)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(
        `${employee.full_name || "Employee"} ${
          employee.active ? "deactivated" : "reactivated"
        }.`,
      )
    })
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No employees yet. Click <strong>Add Employee</strong> to
                  onboard your first one.
                </TableCell>
              </TableRow>
            ) : (
              employees.map((e) => (
                <TableRow key={e.id} className={!e.active ? "opacity-60" : ""}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        url={e.avatar_url}
                        seed={e.id}
                        name={e.full_name}
                        size="sm"
                        className="ring-border/60"
                      />
                      <span>{e.full_name || "Unnamed"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {e.employee_id ?? "—"}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={e.role} />
                  </TableCell>
                  <TableCell>{e.phone ?? "—"}</TableCell>
                  <TableCell>
                    {e.active ? (
                      <Badge>Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(e.created_at), "PP")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(e)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={e.active ? "destructive" : "outline"}
                        disabled={pendingId === e.id}
                        onClick={() => handleToggleActive(e)}
                      >
                        {pendingId === e.id
                          ? "Working…"
                          : e.active
                            ? "Deactivate"
                            : "Reactivate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EditEmployeeDialog
        employee={editing}
        onClose={() => setEditing(null)}
      />
    </>
  )
}
