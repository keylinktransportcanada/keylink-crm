"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"
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
  formatPayRate,
  PAY_METHOD_LABEL,
} from "@/lib/schemas/driver-profile"
import {
  buildSettlementLines,
  createSettlementSchema,
  type CreateSettlementInput,
  type PayMethod,
} from "@/lib/schemas/settlements"

import { createSettlement, previewEligibleLoads } from "../actions"

type DriverOption = {
  id: string
  full_name: string
  employee_id: string | null
  pay_method: PayMethod
  pay_rate: number
}

type EligibleLoad = {
  id: string
  load_number: string
  customer_name: string | null
  origin_city: string | null
  destination_city: string | null
  delivery_date: string | null
  rate_cad: number | null
  total_km: number | null
}

const CAD = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 2,
})

export function NewSettlementForm({ drivers }: { drivers: DriverOption[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [previewing, startPreview] = useTransition()
  const [preview, setPreview] = useState<EligibleLoad[] | null>(null)

  const form = useForm<CreateSettlementInput>({
    resolver: zodResolver(createSettlementSchema),
    defaultValues: {
      driver_id: drivers[0]?.id ?? "",
      period_start: defaultPeriodStart(),
      period_end: defaultPeriodEnd(),
      notes: "",
    },
  })

  const driverId = form.watch("driver_id")
  const periodStart = form.watch("period_start")
  const periodEnd = form.watch("period_end")

  const selectedDriver = useMemo(
    () => drivers.find((d) => d.id === driverId),
    [drivers, driverId],
  )

  // Auto-fetch preview when driver or dates change. Debounced via the
  // useTransition pending flag — fires the next render after the user
  // stops typing in a date field.
  useEffect(() => {
    if (!driverId || !periodStart || !periodEnd) {
      setPreview(null)
      return
    }
    if (periodEnd < periodStart) {
      setPreview(null)
      return
    }
    startPreview(async () => {
      const result = await previewEligibleLoads(
        driverId,
        periodStart,
        periodEnd,
      )
      setPreview(result.loads)
    })
  }, [driverId, periodStart, periodEnd])

  const previewLines = useMemo(() => {
    if (!preview || !selectedDriver) return []
    return buildSettlementLines(
      selectedDriver.pay_method,
      selectedDriver.pay_rate,
      preview.map((l) => ({
        load_id: l.id,
        rate_cad: l.rate_cad,
        total_km: l.total_km,
      })),
    )
  }, [preview, selectedDriver])

  const previewTotal = previewLines.reduce((acc, l) => acc + l.amount_cad, 0)

  const onSubmit = (values: CreateSettlementInput) => {
    startTransition(async () => {
      const result = await createSettlement(values)
      if ("error" in result) {
        const msg = result.error._form?.[0]
        if (msg) toast.error(msg)
        for (const [field, messages] of Object.entries(result.error)) {
          if (field === "_form") continue
          if (messages && messages.length > 0) {
            form.setError(field as keyof CreateSettlementInput, {
              message: messages[0],
            })
          }
        }
        return
      }
      toast.success("Settlement created.")
      router.push(`/accounting/settlements/${result.id}`)
    })
  }

  if (drivers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-8 text-sm text-muted-foreground">
        No active drivers. Add a driver first, then come back here to
        generate a settlement.
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
      >
        <section className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="driver_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Driver</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.full_name}
                        {d.employee_id ? ` · ${d.employee_id}` : ""}
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
            name="period_start"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Period start</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="period_end"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Period end</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        {selectedDriver ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Pay method:</span>
            <span className="font-medium">
              {PAY_METHOD_LABEL[selectedDriver.pay_method]}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium">
              {formatPayRate(selectedDriver.pay_method, selectedDriver.pay_rate)}
            </span>
            {selectedDriver.pay_rate === 0 ? (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                Rate is 0 — set it on the driver page first
              </span>
            ) : null}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Eligible loads</h2>
              {preview ? (
                <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {preview.length}
                </span>
              ) : null}
              {previewing ? (
                <span className="text-xs text-muted-foreground">
                  loading…
                </span>
              ) : null}
            </div>
            <span className="text-xs text-muted-foreground">
              Delivered, invoiced, or paid loads with delivery dates in the
              selected range, not yet on another settlement.
            </span>
          </div>
          {!preview ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Pick a driver and date range to preview.
            </div>
          ) : preview.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No eligible loads in this range.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Load</th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Lane</th>
                  <th className="px-4 py-2 font-medium">Delivered</th>
                  <th className="px-4 py-2 text-right font-medium">Rate</th>
                  <th className="px-4 py-2 text-right font-medium">KM</th>
                  <th className="px-4 py-2 text-right font-medium">Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.map((l, idx) => {
                  const line = previewLines[idx]
                  return (
                    <tr key={l.id}>
                      <td className="px-4 py-2 font-medium tabular-nums">
                        {l.load_number}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {l.customer_name ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {l.origin_city ?? "—"} → {l.destination_city ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {l.delivery_date ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {l.rate_cad != null ? CAD.format(l.rate_cad) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {l.total_km != null ? l.total_km.toFixed(0) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">
                        {CAD.format(line?.amount_cad ?? 0)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/30">
                  <td className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground" colSpan={6}>
                    Gross pay total
                  </td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">
                    {CAD.format(previewTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </section>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Anything the driver should see on their statement…"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="sticky bottom-0 -mx-2 flex justify-end gap-2 border-t border-border bg-background/95 px-2 py-3 backdrop-blur">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/accounting/settlements")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create settlement"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function defaultPeriodStart(): string {
  const d = new Date()
  // Default to the 1st of the current month.
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  return first.toISOString().slice(0, 10)
}

function defaultPeriodEnd(): string {
  return new Date().toISOString().slice(0, 10)
}
