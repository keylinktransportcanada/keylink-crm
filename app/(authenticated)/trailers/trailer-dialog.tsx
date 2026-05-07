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
  TRAILER_TYPE_LABEL,
  TRAILER_TYPE_VALUES,
  trailerSchema,
  type TrailerInput,
} from "@/lib/schemas/equipment"

import { createTrailer, updateTrailer } from "./actions"
import type { TrailerRow } from "./trailers-table"

type Mode = "create" | "edit"

export function TrailerDialog({
  mode,
  trailer,
  open,
  onOpenChange,
}: {
  mode: Mode
  trailer?: TrailerRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, startTransition] = useTransition()

  const form = useForm<TrailerInput>({
    resolver: zodResolver(trailerSchema),
    defaultValues:
      mode === "edit" && trailer
        ? {
            trailer_number: trailer.trailer_number,
            type: trailer.type,
            status: trailer.status,
            notes: trailer.notes ?? "",
          }
        : {
            trailer_number: "",
            type: "dry_van",
            status: "active",
            notes: "",
          },
  })

  const onSubmit = (values: TrailerInput) => {
    startTransition(async () => {
      const result =
        mode === "edit" && trailer
          ? await updateTrailer({ ...values, id: trailer.id })
          : await createTrailer(values)

      if ("error" in result) {
        const formError = result.error._form?.[0]
        if (formError) toast.error(formError)
        for (const [field, messages] of Object.entries(result.error)) {
          if (field === "_form") continue
          if (messages && messages.length > 0) {
            form.setError(field as keyof TrailerInput, {
              message: messages[0],
            })
          }
        }
        return
      }

      toast.success(mode === "edit" ? "Trailer updated." : "Trailer added.")
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
            {mode === "edit" ? "Edit trailer" : "Add trailer"}
          </DialogTitle>
          <DialogDescription>
            Plates, VIN, and inspections come in Phase 3.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="trailer_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trailer number</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="e.g. TR-201" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string | null) =>
                              v
                                ? TRAILER_TYPE_LABEL[
                                    v as keyof typeof TRAILER_TYPE_LABEL
                                  ] ?? v
                                : ""
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TRAILER_TYPE_VALUES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {TRAILER_TYPE_LABEL[t]}
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
                          <SelectValue>
                            {(v: string | null) =>
                              v
                                ? EQUIPMENT_STATUS_LABEL[
                                    v as keyof typeof EQUIPMENT_STATUS_LABEL
                                  ] ?? v
                                : ""
                            }
                          </SelectValue>
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
                    : "Create trailer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
