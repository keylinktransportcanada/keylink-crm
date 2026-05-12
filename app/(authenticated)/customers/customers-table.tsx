"use client"

import { useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  User,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@/components/ui/preview-card"
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
  tax_id: string | null
  tax_exempt: boolean
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
                <PreviewCard key={c.id}>
                  <PreviewCardTrigger
                    delay={350}
                    closeDelay={120}
                    render={
                      <TableRow
                        tabIndex={canEdit ? 0 : -1}
                        onClick={canEdit ? () => setEditing(c) : undefined}
                        onKeyDown={
                          canEdit
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault()
                                  setEditing(c)
                                }
                              }
                            : undefined
                        }
                        className={cnRow(c.active, canEdit)}
                      />
                    }
                  >
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
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditing(c)
                            }}
                          >
                            <Pencil className="size-3.5" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant={c.active ? "destructive" : "outline"}
                            disabled={pendingId === c.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleActive(c)
                            }}
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
                  </PreviewCardTrigger>
                  <PreviewCardContent
                    side="left"
                    align="start"
                    sideOffset={16}
                    className="w-[340px]"
                  >
                    <CustomerPreview customer={c} />
                  </PreviewCardContent>
                </PreviewCard>
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

function cnRow(active: boolean, clickable: boolean): string {
  const base = "transition-colors hover:bg-muted/40"
  const dim = active ? "" : "opacity-60"
  const focus =
    "focus-visible:bg-muted/40 focus-visible:outline-none cursor-pointer"
  return [base, dim, clickable ? focus : ""].filter(Boolean).join(" ")
}

function CustomerPreview({ customer }: { customer: CustomerRow }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{customer.name}</span>
          {customer.contact_name ? (
            <span className="text-xs opacity-70">{customer.contact_name}</span>
          ) : null}
        </div>
        {customer.active ? (
          <Badge>Active</Badge>
        ) : (
          <Badge variant="outline">Archived</Badge>
        )}
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-col gap-2 text-xs">
          <Row icon={<User className="size-3.5" />} label="Contact">
            <span>{customer.contact_name ?? "—"}</span>
          </Row>
          <Row icon={<Phone className="size-3.5" />} label="Phone">
            <span>{customer.phone ?? "—"}</span>
          </Row>
          <Row icon={<Mail className="size-3.5" />} label="Email">
            <span className="break-all">{customer.email ?? "—"}</span>
          </Row>
          {customer.address ? (
            <Row icon={<MapPin className="size-3.5" />} label="Address">
              <span className="whitespace-pre-line">{customer.address}</span>
            </Row>
          ) : null}
          {customer.billing_address &&
          customer.billing_address !== customer.address ? (
            <Row icon={<Building2 className="size-3.5" />} label="Billing">
              <span className="whitespace-pre-line">
                {customer.billing_address}
              </span>
            </Row>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <Field
            icon={<CalendarDays className="size-3.5" />}
            label="Terms"
            value={`Net ${customer.payment_terms_days}`}
          />
          <Field
            icon={<CircleDollarSign className="size-3.5" />}
            label="Credit limit"
            value={formatCAD(customer.credit_limit_cad)}
          />
        </div>

        {customer.notes ? (
          <div className="flex flex-col gap-0.5 rounded-md bg-white/5 px-2.5 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
              Notes
            </span>
            <span className="line-clamp-3 text-xs">{customer.notes}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 opacity-60">{icon}</span>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
          {label}
        </span>
        {children}
      </div>
    </div>
  )
}

function Field({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 opacity-60">{icon}</span>
      <div className="flex flex-1 flex-col gap-0.5 leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
          {label}
        </span>
        <span>{value ?? "—"}</span>
      </div>
    </div>
  )
}
