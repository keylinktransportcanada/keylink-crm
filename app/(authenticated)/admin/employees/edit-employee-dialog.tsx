"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ROLE_LABEL,
  ROLE_VALUES,
  updateEmployeeSchema,
  type UpdateEmployeeInput,
} from "@/lib/schemas/employees"

import { deleteEmployee, updateEmployee } from "./actions"
import type { EmployeeRow } from "./employees-table"

const DELETE_PHRASE = "DELETE"

export function EditEmployeeDialog({
  employee,
  currentUserId,
  onClose,
}: {
  employee: EmployeeRow | null
  currentUserId: string
  onClose: () => void
}) {
  return (
    <Dialog
      open={!!employee}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        {employee ? (
          <EditDialogBody
            key={employee.id}
            employee={employee}
            currentUserId={currentUserId}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

type Mode = "edit" | "confirm-delete"

function EditDialogBody({
  employee,
  currentUserId,
  onClose,
}: {
  employee: EmployeeRow
  currentUserId: string
  onClose: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<Mode>("edit")
  const [confirmText, setConfirmText] = useState("")

  const form = useForm<UpdateEmployeeInput>({
    resolver: zodResolver(updateEmployeeSchema),
    defaultValues: {
      id: employee.id,
      full_name: employee.full_name,
      phone: employee.phone ?? "",
      role: employee.role,
    },
  })

  const isSelf = employee.id === currentUserId

  const onSubmit = (values: UpdateEmployeeInput) => {
    startTransition(async () => {
      const result = await updateEmployee(values)
      if ("error" in result) {
        const formError = result.error._form?.[0]
        toast.error(formError ?? "Failed to update employee.")
        for (const [field, messages] of Object.entries(result.error)) {
          if (field === "_form") continue
          if (messages && messages.length > 0) {
            form.setError(field as keyof UpdateEmployeeInput, {
              message: messages[0],
            })
          }
        }
        return
      }
      toast.success("Employee updated.")
      onClose()
    })
  }

  const handleDelete = () => {
    if (confirmText !== DELETE_PHRASE) return
    startTransition(async () => {
      const result = await deleteEmployee(employee.id)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(`${employee.full_name || "Employee"} deleted.`)
      onClose()
    })
  }

  if (mode === "confirm-delete") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Delete this employee?</DialogTitle>
          <DialogDescription>
            This permanently removes{" "}
            <strong>{employee.full_name || "this employee"}</strong>
            {employee.employee_id ? ` (${employee.employee_id})` : ""}. Their
            auth account and profile are deleted, any session is revoked, and
            they can no longer sign in. Audit log entries are preserved but
            their actor will read as unknown. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-delete-input">
            Type{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {DELETE_PHRASE}
            </code>{" "}
            to confirm.
          </Label>
          <Input
            id="confirm-delete-input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setMode("edit")
              setConfirmText("")
            }}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={pending || confirmText !== DELETE_PHRASE}
          >
            {pending ? "Deleting…" : "Delete employee"}
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit employee</DialogTitle>
        <DialogDescription>
          Update name, phone, or role. Email and employee ID can&apos;t be
          changed.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Phone{" "}
                  <span className="text-xs text-muted-foreground">
                    (optional)
                  </span>
                </FormLabel>
                <FormControl>
                  <Input type="tel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ROLE_VALUES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {!isSelf ? (
            <div className="mt-2 flex items-start justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-destructive">
                  Danger zone
                </span>
                <span className="text-xs text-muted-foreground">
                  Permanently remove this employee and revoke all access.
                </span>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setMode("confirm-delete")}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}
