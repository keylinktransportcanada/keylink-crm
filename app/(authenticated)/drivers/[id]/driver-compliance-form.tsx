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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CA_PROVINCES } from "@/lib/regions"
import {
  driverProfileSchema,
  LICENCE_CLASSES,
  PAY_METHOD_LABEL,
  type DriverProfileInput,
} from "@/lib/schemas/driver-profile"
import { PAY_METHODS } from "@/lib/schemas/settlements"

import { updateDriverProfile } from "../actions"

export function DriverComplianceForm({
  initialValues,
  canEdit,
}: {
  initialValues: DriverProfileInput
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const form = useForm<DriverProfileInput>({
    resolver: zodResolver(driverProfileSchema),
    defaultValues: initialValues,
  })

  const onSubmit = (values: DriverProfileInput) => {
    startTransition(async () => {
      const result = await updateDriverProfile(values)
      if ("error" in result) {
        const formError = result.error._form?.[0]
        if (formError) toast.error(formError)
        for (const [field, messages] of Object.entries(result.error)) {
          if (field === "_form") continue
          if (messages && messages.length > 0) {
            form.setError(field as keyof DriverProfileInput, {
              message: messages[0],
            })
          }
        }
        return
      }
      toast.success("Driver compliance updated.")
      router.refresh()
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
      >
        <fieldset disabled={!canEdit} className="flex flex-col gap-6">
          {!canEdit ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Read-only — only admins can update driver compliance fields.
            </p>
          ) : null}

          <Section title="Driver licence">
            <Grid3>
              <FormField
                control={form.control}
                name="licence_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Licence number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="licence_class"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class</FormLabel>
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
                              !v || v === "_none" ? "—" : v
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_none">—</SelectItem>
                        {LICENCE_CLASSES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
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
                name="licence_province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Province</FormLabel>
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
                              !v || v === "_none" ? "—" : v
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_none">—</SelectItem>
                        {CA_PROVINCES.map((p) => (
                          <SelectItem key={p.code} value={p.code}>
                            {p.code} · {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Grid3>
            <FormField
              control={form.control}
              name="licence_expiry"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Licence expiry</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>

          <Section title="Medical certificate">
            <FormField
              control={form.control}
              name="medical_cert_expiry"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Medical cert expiry</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>

          <Section
            title="FAST card"
            description="Trusted-traveller card for cross-border driving (5-year expiry)."
          >
            <Grid2>
              <FormField
                control={form.control}
                name="fast_card_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>FAST card number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fast_card_expiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Grid2>
          </Section>

          <Section
            title="Driver abstract"
            description="Last time the driver's NSC abstract / driving record was reviewed."
          >
            <FormField
              control={form.control}
              name="abstract_last_pulled"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Last reviewed</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>

          <Section title="Emergency contact">
            <Grid2>
              <FormField
                control={form.control}
                name="emergency_contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="emergency_contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Grid2>
          </Section>

          <Section
            id="pay"
            title="Pay"
            description="Used to calculate driver pay on settlement statements. Admin-only."
          >
            <Grid2>
              <FormField
                control={form.control}
                name="pay_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pay method</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select pay method">
                            {(v: string | null) =>
                              v
                                ? PAY_METHOD_LABEL[
                                    v as keyof typeof PAY_METHOD_LABEL
                                  ] ?? "Select pay method"
                                : "Select pay method"
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAY_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {PAY_METHOD_LABEL[m]}
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
                name="pay_rate"
                render={({ field }) => {
                  const method = form.watch("pay_method")
                  const hint =
                    method === "percent_revenue"
                      ? "Fraction of load revenue. 0.25 = 25%."
                      : method === "per_km"
                        ? "CAD per kilometre. 0.55 = $0.55/km."
                        : "CAD per delivered load."
                  return (
                    <FormItem>
                      <FormLabel>Pay rate</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.0001"
                          min={0}
                          value={field.value ?? 0}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value),
                            )
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">{hint}</p>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
            </Grid2>
          </Section>

          <Section title="Employment">
            <FormField
              control={form.control}
              name="hire_date"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Hire date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (admin / dispatcher only)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>
        </fieldset>

        {canEdit ? (
          <div className="sticky bottom-0 -mx-2 flex justify-end gap-2 border-t border-border bg-background/95 px-2 py-3 backdrop-blur">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/drivers")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        ) : null}
      </form>
    </Form>
  )
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card/40 p-5"
    >
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
