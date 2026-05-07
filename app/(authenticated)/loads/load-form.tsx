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
import {
  EQUIPMENT_REQUIRED_LABEL,
  EQUIPMENT_REQUIRED_VALUES,
  LOAD_CURRENCY_VALUES,
  LOAD_TYPE_LABEL,
  LOAD_TYPE_VALUES,
  loadSchema,
  type LoadInput,
} from "@/lib/schemas/loads"
import {
  regionFieldLabel,
  regionLabel,
  regionsForCountry,
} from "@/lib/regions"

import { createLoad, updateLoad } from "./actions"

const COUNTRY_LABEL: Record<"CA" | "US" | "MX", string> = {
  CA: "Canada",
  US: "United States",
  MX: "Mexico",
}

export type LoadFormOptions = {
  customers: Array<{ id: string; name: string; active: boolean }>
  drivers: Array<{ id: string; full_name: string }>
  trucks: Array<{ id: string; truck_number: string }>
  trailers: Array<{ id: string; trailer_number: string }>
}

type Mode =
  | { kind: "create" }
  | { kind: "edit"; loadId: string; initialValues: LoadInput }

export function LoadForm({
  options,
  mode,
}: {
  options: LoadFormOptions
  mode: Mode
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const form = useForm<LoadInput>({
    resolver: zodResolver(loadSchema),
    defaultValues:
      mode.kind === "edit"
        ? mode.initialValues
        : {
            customer_id: "" as unknown as string,
            driver_id: null,
            truck_id: null,
            trailer_id: null,

            reference_number: "",
            po_number: "",

            origin_company: "",
            origin_address: "",
            origin_city: "",
            origin_province: "",
            origin_country: "CA",

            destination_company: "",
            destination_address: "",
            destination_city: "",
            destination_province: "",
            destination_country: "CA",

            pickup_date: "",
            delivery_date: "",

            load_type: "ftl",
            commodity: "",
            weight_kg: null,
            pieces: null,
            equipment_required: "none",

            currency: "CAD",
            rate: null,
            fuel_surcharge: null,
            accessorial_charges: null,

            is_cross_border: false,
            customs_broker: "",
            pars_pass_number: "",
            aci_aces_number: "",

            notes: "",
            internal_notes: "",
          },
  })

  const currency = form.watch("currency")
  const isCrossBorder = form.watch("is_cross_border")
  const rate = form.watch("rate")
  const fuel = form.watch("fuel_surcharge")
  const acc = form.watch("accessorial_charges")
  const originCountry = form.watch("origin_country")
  const destinationCountry = form.watch("destination_country")
  const enteredTotal =
    (rate ?? 0) + (fuel ?? 0) + (acc ?? 0)

  const onSubmit = (values: LoadInput) => {
    startTransition(async () => {
      const result =
        mode.kind === "edit"
          ? await updateLoad({ ...values, id: mode.loadId })
          : await createLoad(values)

      if ("error" in result) {
        const formError = result.error._form?.[0]
        if (formError) toast.error(formError)
        for (const [field, messages] of Object.entries(result.error)) {
          if (field === "_form") continue
          if (messages && messages.length > 0) {
            form.setError(field as keyof LoadInput, {
              message: messages[0],
            })
          }
        }
        return
      }

      toast.success(mode.kind === "edit" ? "Load updated." : "Load created.")
      router.push(`/loads/${result.id}`)
      router.refresh()
    })
  }

  const activeCustomers = options.customers.filter((c) => c.active)

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-8"
      >
        {/* Customer & references --------------------------------------- */}
        <Section title="Customer & references">
          <FormField
            control={form.control}
            name="customer_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer</FormLabel>
                <Select
                  value={field.value || ""}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pick a customer…">
                        {(v: string | null) =>
                          v
                            ? options.customers.find((c) => c.id === v)?.name ??
                              "—"
                            : "Pick a customer…"
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {activeCustomers.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No customers yet. Add one in /customers first.
                      </div>
                    ) : (
                      activeCustomers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <Grid2>
            <FormField
              control={form.control}
              name="reference_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Customer reference{" "}
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
              name="po_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    PO #{" "}
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
          </Grid2>
        </Section>

        {/* Origin ------------------------------------------------------ */}
        <Section title="Origin">
          <FormField
            control={form.control}
            name="origin_company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shipper / pickup location</FormLabel>
                <FormControl>
                  <Input placeholder="Company name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="origin_address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street address</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Grid3>
            <FormField
              control={form.control}
              name="origin_city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="origin_province"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{regionFieldLabel(originCountry)}</FormLabel>
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
                              ? `Pick a ${regionFieldLabel(originCountry).toLowerCase()}…`
                              : regionLabel(originCountry, v)
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none">—</SelectItem>
                      {regionsForCountry(originCountry).map((r) => (
                        <SelectItem key={r.code} value={r.code}>
                          {r.code} · {r.name}
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
              name="origin_country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select
                    value={field.value || "CA"}
                    onValueChange={(v) => {
                      field.onChange(v ?? "CA")
                      // Clear province so it doesn't keep a stale code from
                      // the previous country.
                      form.setValue("origin_province", "")
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) =>
                            COUNTRY_LABEL[(v ?? "CA") as keyof typeof COUNTRY_LABEL] ??
                            v
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CA">Canada</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="MX">Mexico</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Grid3>
        </Section>

        {/* Destination ------------------------------------------------- */}
        <Section title="Destination">
          <FormField
            control={form.control}
            name="destination_company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Receiver / delivery location</FormLabel>
                <FormControl>
                  <Input placeholder="Company name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="destination_address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street address</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Grid3>
            <FormField
              control={form.control}
              name="destination_city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="destination_province"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{regionFieldLabel(destinationCountry)}</FormLabel>
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
                              ? `Pick a ${regionFieldLabel(destinationCountry).toLowerCase()}…`
                              : regionLabel(destinationCountry, v)
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none">—</SelectItem>
                      {regionsForCountry(destinationCountry).map((r) => (
                        <SelectItem key={r.code} value={r.code}>
                          {r.code} · {r.name}
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
              name="destination_country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select
                    value={field.value || "CA"}
                    onValueChange={(v) => {
                      field.onChange(v ?? "CA")
                      form.setValue("destination_province", "")
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) =>
                            COUNTRY_LABEL[(v ?? "CA") as keyof typeof COUNTRY_LABEL] ??
                            v
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CA">Canada</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="MX">Mexico</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Grid3>
        </Section>

        {/* Schedule ---------------------------------------------------- */}
        <Section title="Schedule">
          <Grid2>
            <FormField
              control={form.control}
              name="pickup_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pickup date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="delivery_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Grid2>
        </Section>

        {/* Assignment -------------------------------------------------- */}
        <Section title="Assignment">
          <Grid3>
            <FormField
              control={form.control}
              name="driver_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Driver</FormLabel>
                  <Select
                    value={field.value ?? "_unassigned"}
                    onValueChange={(v) =>
                      field.onChange(v === "_unassigned" ? null : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) =>
                            !v || v === "_unassigned"
                              ? "Unassigned"
                              : options.drivers.find((d) => d.id === v)
                                  ?.full_name || "Unnamed"
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_unassigned">Unassigned</SelectItem>
                      {options.drivers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.full_name || "Unnamed"}
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
              name="truck_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Truck</FormLabel>
                  <Select
                    value={field.value ?? "_unassigned"}
                    onValueChange={(v) =>
                      field.onChange(v === "_unassigned" ? null : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) =>
                            !v || v === "_unassigned"
                              ? "Unassigned"
                              : options.trucks.find((t) => t.id === v)
                                  ?.truck_number ?? "—"
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_unassigned">Unassigned</SelectItem>
                      {options.trucks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.truck_number}
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
              name="trailer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trailer</FormLabel>
                  <Select
                    value={field.value ?? "_unassigned"}
                    onValueChange={(v) =>
                      field.onChange(v === "_unassigned" ? null : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) =>
                            !v || v === "_unassigned"
                              ? "Unassigned"
                              : options.trailers.find((t) => t.id === v)
                                  ?.trailer_number ?? "—"
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_unassigned">Unassigned</SelectItem>
                      {options.trailers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.trailer_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Grid3>
        </Section>

        {/* Cargo ------------------------------------------------------- */}
        <Section title="Cargo">
          <Grid2>
            <FormField
              control={form.control}
              name="load_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Load type</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) =>
                            v
                              ? LOAD_TYPE_LABEL[v as keyof typeof LOAD_TYPE_LABEL] ??
                                v
                              : ""
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LOAD_TYPE_VALUES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {LOAD_TYPE_LABEL[t]}
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
              name="equipment_required"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipment required</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) =>
                            v
                              ? EQUIPMENT_REQUIRED_LABEL[
                                  v as keyof typeof EQUIPMENT_REQUIRED_LABEL
                                ] ?? v
                              : ""
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EQUIPMENT_REQUIRED_VALUES.map((e) => (
                        <SelectItem key={e} value={e}>
                          {EQUIPMENT_REQUIRED_LABEL[e]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Grid2>
          <FormField
            control={form.control}
            name="commodity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Commodity{" "}
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
          <Grid2>
            <FormField
              control={form.control}
              name="weight_kg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Weight (kg)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="1"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? null : Number(e.target.value),
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
              name="pieces"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pieces</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="1"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? null : Number(e.target.value),
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

        {/* Rates ------------------------------------------------------- */}
        <Section
          title="Rates"
          description={
            currency === "USD"
              ? "Amounts are converted to CAD on save using the Bank of Canada noon rate."
              : "All amounts in CAD."
          }
        >
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {LOAD_CURRENCY_VALUES.map((c) => (
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
          <Grid3>
            <MoneyField
              form={form}
              name="rate"
              label="Line haul rate"
              currency={currency}
            />
            <MoneyField
              form={form}
              name="fuel_surcharge"
              label="Fuel surcharge"
              currency={currency}
            />
            <MoneyField
              form={form}
              name="accessorial_charges"
              label="Accessorial charges"
              currency={currency}
            />
          </Grid3>
          {enteredTotal > 0 ? (
            <p className="text-sm text-muted-foreground">
              Total billed:{" "}
              <span className="font-medium text-foreground">
                {currency} {enteredTotal.toFixed(2)}
              </span>
              {currency === "USD"
                ? " — converted to CAD at save time."
                : ""}
            </p>
          ) : null}
        </Section>

        {/* Cross-border ----------------------------------------------- */}
        <Section title="Cross-border">
          <FormField
            control={form.control}
            name="is_cross_border"
            render={({ field }) => (
              <FormItem>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                  <span>This is a Canada–US cross-border load</span>
                </label>
                <FormMessage />
              </FormItem>
            )}
          />
          {isCrossBorder ? (
            <Grid2>
              <FormField
                control={form.control}
                name="customs_broker"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customs broker</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pars_pass_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PARS pass #</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="aci_aces_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ACI / ACE eManifest #</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Grid2>
          ) : null}
        </Section>

        {/* Notes ------------------------------------------------------- */}
        <Section title="Notes">
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Notes{" "}
                  <span className="text-xs text-muted-foreground">
                    (visible to the driver)
                  </span>
                </FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="internal_notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Internal notes{" "}
                  <span className="text-xs text-muted-foreground">
                    (dispatcher / accounting only)
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
                : "Create load"}
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

function MoneyField({
  form,
  name,
  label,
  currency,
}: {
  form: ReturnType<typeof useForm<LoadInput>>
  name: "rate" | "fuel_surcharge" | "accessorial_charges"
  label: string
  currency: string
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}{" "}
            <span className="text-xs text-muted-foreground">({currency})</span>
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={field.value ?? ""}
              onChange={(e) =>
                field.onChange(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
