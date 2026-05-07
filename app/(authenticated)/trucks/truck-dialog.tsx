"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { Textarea } from "@/components/ui/textarea"
import {
  EQUIPMENT_STATUS_LABEL,
  EQUIPMENT_STATUS_VALUES,
  truckSchema,
  type TruckInput,
} from "@/lib/schemas/equipment"

import { createTruck, updateTruck } from "./actions"
import type { TruckRow } from "./trucks-table"

type Mode = "create" | "edit"

export function TruckDialog({
  mode,
  truck,
  open,
  onOpenChange,
}: {
  mode: Mode
  truck?: TruckRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, startTransition] = useTransition()

  const form = useForm<TruckInput>({
    resolver: zodResolver(truckSchema),
    defaultValues:
      mode === "edit" && truck
        ? {
            truck_number: truck.truck_number,
            make: truck.make ?? "",
            model: truck.model ?? "",
            year: truck.year,
            status: truck.status,
            notes: truck.notes ?? "",
          }
        : {
            truck_number: "",
            make: "",
            model: "",
            year: null,
            status: "active",
            notes: "",
          },
  })

  const onSubmit = (values: TruckInput) => {
    startTransition(async () => {
      const result =
        mode === "edit" && truck
          ? await updateTruck({ ...values, id: truck.id })
          : await createTruck(values)

      if ("error" in result) {
        const formError = result.error._form?.[0]
        if (formError) toast.error(formError)
        for (const [field, messages] of Object.entries(result.error)) {
          if (field === "_form") continue
          if (messages && messages.length > 0) {
            form.setError(field as keyof TruckInput, {
              message: messages[0],
            })
          }
        }
        return
      }

      toast.success(mode === "edit" ? "Truck updated." : "Truck added.")
      onOpenChange(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) form.reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit truck" : "Add truck"}
          </DialogTitle>
          <DialogDescription>
            Compliance fields (plates, insurance, IFTA, CVOR) come in Phase 3.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="truck_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Truck number</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="e.g. T-101" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="make"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Make{" "}
                      <span className="text-xs text-muted-foreground">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Model{" "}
                      <span className="text-xs text-muted-foreground">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Year{" "}
                      <span className="text-xs text-muted-foreground">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1980}
                        max={new Date().getFullYear() + 2}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EQUIPMENT_STATUS_VALUES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {EQUIPMENT_STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Notes{" "}
                    <span className="text-xs text-muted-foreground">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Saving…"
                  : mode === "edit"
                    ? "Save changes"
                    : "Create truck"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
