"use client"

import { useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import { Pencil, Plus, Search } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { setCustomerActive } from "./actions"
import { CustomerDialog } from "./customer-dialog"

export type CustomerRow = {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  billing_address: string | null
  payment_terms_days: number
  credit_limit_cad: number | null
  notes: string | null
  active: boolean
  created_at: string
}

const formatCAD = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0,
      }).format(value)

export function CustomersTable({
  customers,
  canEdit,
}: {
  customers: CustomerRow[]
  canEdit: boolean
}) {
  const [filter, setFilter] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<CustomerRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return customers.filter((c) => {
      if (!showInactive && !c.active) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        (c.contact_name?.toLowerCase().includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [customers, filter, showInactive])

  const handleToggleActive = (customer: CustomerRow) => {
    setPendingId(customer.id)
    startTransition(async () => {
      const result = await setCustomerActive(customer.id, !customer.active)
      setPendingId(null)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(
        `${customer.name} ${customer.active ? "archived" : "restored"}.`,
      )
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, contact, or email"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show archived
        </label>
        {canEdit ? (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus />
            Add Customer
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Terms</TableHead>
              <TableHead className="text-right">Credit limit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
              {canEdit ? (
                <TableHead className="text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 8 : 7}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {customers.length === 0 ? (
                    <>
                      No customers yet.
                      {canEdit ? (
                        <>
                          {" "}
                          Click <strong>Add Customer</strong> to create your
                          first one.
                        </>
                      ) : null}
                    </>
                  ) : (
                    "No customers match your filter."
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className={!c.active ? "opacity-60" : ""}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{c.name}</span>
                      {c.email ? (
                        <span className="text-xs text-muted-foreground">
                          {c.email}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{c.contact_name ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    Net {c.payment_terms_days}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCAD(c.credit_limit_cad)}
                  </TableCell>
                  <TableCell>
                    {c.active ? (
                      <Badge>Active</Badge>
                    ) : (
                      <Badge variant="outline">Archived</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(c.created_at), "PP")}
                  </TableCell>
                  {canEdit ? (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing(c)}
                        >
                          <Pencil className="size-3.5" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={c.active ? "destructive" : "outline"}
                          disabled={pendingId === c.id}
                          onClick={() => handleToggleActive(c)}
                        >
                          {pendingId === c.id
                            ? "Working…"
                            : c.active
                              ? "Archive"
                              : "Restore"}
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CustomerDialog
        mode="create"
        open={adding}
        onOpenChange={setAdding}
      />

      {editing ? (
        <CustomerDialog
          key={editing.id}
          mode="edit"
          customer={editing}
          open={!!editing}
          onOpenChange={(o) => {
            if (!o) setEditing(null)
          }}
        />
      ) : null}
    </>
  )
}
