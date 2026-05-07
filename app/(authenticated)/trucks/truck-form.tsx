"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
  truckSchema,
  type TruckInput,
} from "@/lib/schemas/equipment"
import { CA_PROVINCES, US_STATES } from "@/lib/regions"

import { createTruck, updateTruck } from "./actions"

type Mode =
  | { kind: "create" }
  | { kind: "edit"; truckId: string; initialValues: TruckInput }

const PROVINCE_LOOKUP: Record<string, string> = {
  ...Object.fromEntries(CA_PROVINCES.map((r) => [r.code, `${r.name}, CA`])),
  ...Object.fromEntries(US_STATES.map((r) => [r.code, `${r.name}, US`])),
}

const currentYear = new Date().getFullYear()

export function TruckForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const form = useForm<TruckInput>({
    resolver: zodResolver(truckSchema),
    defaultValues:
      mode.kind === "edit"
        ? mode.initialValues
        : {
            truck_number: "",
            make: "",
            model: "",
            year: null,
            status: "active",
            plate: "",
            plate_province: "",
            plate_expiry: "",
            vin: "",
            current_odometer_km: null,
            insurance_policy: "",
            insurance_expiry: "",
            ifta_decal_year: null,
            ifta_decal_expiry: "",
            safety_sticker_expiry: "",
            cvor_certificate_expiry: "",
            notes: "",
          },
  })

  const onSubmit = (values: TruckInput) => {
    startTransition(async () => {
      const result =
        mode.kind === "edit"
          ? await updateTruck({ ...values, id: mode.truckId })
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

      toast.success(mode.kind === "edit" ? "Truck updated." : "Truck added.")
      router.push(`/trucks/${result.id}`)
      router.refresh()
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-8"
      >
        {/* Identity --------------------------------------------------- */}
        <Section title="Identity">
          <Grid2>
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
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
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
          <Grid3>
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
                      max={currentYear + 2}
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
          </Grid3>
        </Section>

        {/* Plate & VIN ------------------------------------------------ */}
        <Section title="Plate & VIN">
          <Grid3>
            <FormField
              control={form.control}
              name="plate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plate #</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. AB123C" {...field} />
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
                  <FormLabel>Plate jurisdiction</FormLabel>
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
                              ? "Pick a jurisdiction…"
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
          </Grid3>
          <Grid2>
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
                    <Input
                      placeholder="17-character VIN"
                      maxLength={40}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="current_odometer_km"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current odometer (km)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="1"
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
          </Grid2>
        </Section>

        {/* Insurance -------------------------------------------------- */}
        <Section title="Insurance">
          <Grid2>
            <FormField
              control={form.control}
              name="insurance_policy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Policy #</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="insurance_expiry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Policy expiry</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Grid2>
        </Section>

        {/* IFTA ------------------------------------------------------- */}
        <Section
          title="IFTA decal"
          description="International Fuel Tax Agreement decal — renewed annually, every December 31."
        >
          <Grid2>
            <FormField
              control={form.control}
              name="ifta_decal_year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Decal year</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={2000}
                      max={currentYear + 2}
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
              name="ifta_decal_expiry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Decal expiry</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Grid2>
        </Section>

        {/* Provincial compliance ------------------------------------- */}
        <Section
          title="Provincial compliance"
          description="Annual safety inspection (CVIP) and CVOR certificate (Ontario carriers)."
        >
          <Grid2>
            <FormField
              control={form.control}
              name="safety_sticker_expiry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Annual safety sticker expiry</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cvor_certificate_expiry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CVOR certificate expiry</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Grid2>
        </Section>

        {/* Notes ----------------------------------------------------- */}
        <Section title="Notes">
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
        </Section>

        <div className="sticky bottom-0 -mx-2 flex justify-end gap-2 border-t border-border bg-background/95 px-2 py-3 backdrop-blur">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending
              ? "Saving…"
              : mode.kind === "edit"
                ? "Save changes"
                : "Create truck"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card/40 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  )
}

function Grid3({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{children}</div>
  )
}
