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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { CA_PROVINCES, US_STATES } from "@/lib/regions"

import { createTrailer, updateTrailer } from "./actions"
import type { TrailerRow } from "./trailers-table"

type Mode = "create" | "edit"

const PROVINCE_LOOKUP: Record<string, string> = {
  ...Object.fromEntries(CA_PROVINCES.map((r) => [r.code, `${r.name}, CA`])),
  ...Object.fromEntries(US_STATES.map((r) => [r.code, `${r.name}, US`])),
}

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
            plate: trailer.plate ?? "",
            plate_province: trailer.plate_province ?? "",
            plate_expiry: trailer.plate_expiry ?? "",
            vin: trailer.vin ?? "",
            last_inspection_date: trailer.last_inspection_date ?? "",
            next_inspection_due: trailer.next_inspection_due ?? "",
            notes: trailer.notes ?? "",
          }
        : {
            trailer_number: "",
            type: "dry_van",
            status: "active",
            plate: "",
            plate_province: "",
            plate_expiry: "",
            vin: "",
            last_inspection_date: "",
            next_inspection_due: "",
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit trailer" : "Add trailer"}
          </DialogTitle>
          <DialogDescription>
            Identity, plate, and inspection dates.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
          >
            <Section title="Identity">
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
              <Grid2>
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
              </Grid2>
            </Section>

            <Section title="Plate & VIN">
              <Grid2>
                <FormField
                  control={form.control}
                  name="plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plate #</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="plate_province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jurisdiction</FormLabel>
                      <Select
                        value={field.value || "_none"}
                        onValueChange={(v) =>
                          field.onChange(v === "_none" ? "" : v)
                        }
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {(v: string | null) =>
                                !v || v === "_none"
                                  ? "Pick…"
                                  : PROVINCE_LOOKUP[v] ?? v
                              }
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none">—</SelectItem>
                          <SelectGroup>
                            <SelectLabel>Canada</SelectLabel>
                            {CA_PROVINCES.map((r) => (
                              <SelectItem key={r.code} value={r.code}>
                                {r.code} · {r.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>United States</SelectLabel>
                            {US_STATES.map((r) => (
                              <SelectItem key={r.code} value={r.code}>
                                {r.code} · {r.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Grid2>
              <Grid2>
                <FormField
                  control={form.control}
                  name="plate_expiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plate expiry</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        VIN{" "}
                        <span className="text-xs text-muted-foreground">
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input maxLength={40} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Grid2>
            </Section>

            <Section title="Inspection">
              <Grid2>
                <FormField
                  control={form.control}
                  name="last_inspection_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last inspection</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="next_inspection_due"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next inspection due</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Grid2>
            </Section>

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

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card/40 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
  )
}
