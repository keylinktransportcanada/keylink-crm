"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check, Copy, Plus } from "lucide-react"
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
  createEmployeeSchema,
  type CreateEmployeeInput,
} from "@/lib/schemas/employees"

import { createEmployee, getNextEmployeeIdAction } from "./actions"

type TempPasswordData = {
  password: string
  employeeId: string
}

export function AddEmployeeButton() {
  const [openDialogFor, setOpenDialogFor] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<TempPasswordData | null>(null)
  const [opening, startOpening] = useTransition()

  const handleOpen = () => {
    startOpening(async () => {
      try {
        const nextId = await getNextEmployeeIdAction()
        setOpenDialogFor(nextId)
      } catch (err) {
        toast.error(
          `Could not fetch next employee ID: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        )
      }
    })
  }

  return (
    <>
      <Button onClick={handleOpen} size="sm" disabled={opening}>
        <Plus />
        {opening ? "Loading…" : "Add Employee"}
      </Button>

      {openDialogFor ? (
        <AddDialog
          key={openDialogFor}
          initialEmployeeId={openDialogFor}
          onClose={() => setOpenDialogFor(null)}
          onCreated={(data) => {
            setOpenDialogFor(null)
            setTempPassword(data)
          }}
        />
      ) : null}

      <TempPasswordDialog
        data={tempPassword}
        onClose={() => setTempPassword(null)}
      />
    </>
  )
}

function AddDialog({
  initialEmployeeId,
  onClose,
  onCreated,
}: {
  initialEmployeeId: string
  onClose: () => void
  onCreated: (data: TempPasswordData) => void
}) {
  const [pending, startTransition] = useTransition()

  const form = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      role: "driver",
      employee_id: initialEmployeeId,
    },
  })

  const onSubmit = (values: CreateEmployeeInput) => {
    startTransition(async () => {
      const result = await createEmployee(values)
      if ("error" in result) {
        const formError = result.error._form?.[0]
        if (formError) toast.error(formError)
        for (const [field, messages] of Object.entries(result.error)) {
          if (field === "_form") continue
          if (messages && messages.length > 0) {
            form.setError(field as keyof CreateEmployeeInput, {
              message: messages[0],
            })
          }
        }
        return
      }
      onCreated({
        password: result.tempPassword,
        employeeId: result.employeeId,
      })
    })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>
            A 16-character temporary password is generated and shown once. The
            new employee can also reset via &quot;Forgot password?&quot; on the
            login page.
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="off" {...field} />
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
            <FormField
              control={form.control}
              name="employee_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee ID</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create employee"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function TempPasswordDialog({
  data,
  onClose,
}: {
  data: TempPasswordData | null
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const handleClose = () => {
    setCopied(false)
    setConfirmed(false)
    onClose()
  }

  const handleCopy = async () => {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Couldn't copy to clipboard. Select the password manually.")
    }
  }

  return (
    <Dialog
      open={!!data}
      onOpenChange={(open) => {
        // Refuse all close attempts (outside click, escape) until confirmed.
        if (!open && confirmed) handleClose()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Employee created</DialogTitle>
          <DialogDescription>
            {data?.employeeId ? `${data.employeeId} has been created. ` : ""}
            Copy the temporary password — you won&apos;t see it again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3">
            <code className="flex-1 truncate font-mono text-sm">
              {data?.password ?? ""}
            </code>
            <Button size="sm" variant="outline" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="size-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-4" /> Copy
                </>
              )}
            </Button>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I&apos;ve copied the password and stored it somewhere safe.
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button onClick={handleClose} disabled={!confirmed}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
