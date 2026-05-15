"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
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
import {
  addAdjustmentSchema,
  ADJUSTMENT_KIND_LABEL,
  ADJUSTMENT_KINDS,
  adjustmentSign,
  type AddAdjustmentInput,
  type AdjustmentKind,
} from "@/lib/schemas/settlements"

import { addAdjustment, removeAdjustment } from "../actions"

const CAD = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 2,
})

type Adjustment = {
  id: string
  kind: AdjustmentKind
  description: string
  amount_cad: number
  created_at: string
}

export function AdjustmentsSection({
  settlementId,
  adjustments,
  locked,
  signTone,
}: {
  settlementId: string
  adjustments: Adjustment[]
  locked: boolean
  signTone: Record<AdjustmentKind, string>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)

  const form = useForm<AddAdjustmentInput>({
    resolver: zodResolver(addAdjustmentSchema),
    defaultValues: {
      settlement_id: settlementId,
      kind: "bonus",
      description: "",
      amount_cad: 0,
    },
  })

  const onAdd = (values: AddAdjustmentInput) => {
    startTransition(async () => {
      const result = await addAdjustment(values)
      if ("error" in result) {
        const msg = result.error._form?.[0]
        if (msg) toast.error(msg)
        for (const [field, messages] of Object.entries(result.error)) {
          if (field === "_form") continue
          if (messages && messages.length > 0) {
            form.setError(field as keyof AddAdjustmentInput, {
              message: messages[0],
            })
          }
        }
        return
      }
      toast.success("Adjustment added.")
      form.reset({
        settlement_id: settlementId,
        kind: "bonus",
        description: "",
        amount_cad: 0,
      })
      setAdding(false)
      router.refresh()
    })
  }

  const onRemove = (adjustmentId: string) => {
    if (!confirm("Remove this adjustment?")) return
    startTransition(async () => {
      const result = await removeAdjustment(adjustmentId)
      if ("error" in result) {
        const msg = result.error._form?.[0] ?? "Failed to remove."
        toast.error(msg)
        return
      }
      router.refresh()
    })
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <h2 className="text-sm font-semibold">Bonuses & deductions</h2>
        {!locked ? (
          adding ? null : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAdding(true)}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              Add adjustment
            </Button>
          )
        ) : (
          <span className="text-xs text-muted-foreground">
            Locked — settlement is paid.
          </span>
        )}
      </div>

      {adding && !locked ? (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onAdd)}
            className="grid grid-cols-1 gap-3 border-b border-border bg-muted/20 p-4 sm:grid-cols-[150px_1fr_140px_auto]"
          >
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Kind</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue>
                          {(v: string | null) =>
                            v
                              ? ADJUSTMENT_KIND_LABEL[
                                  v as keyof typeof ADJUSTMENT_KIND_LABEL
                                ] ?? "Select"
                              : "Select"
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ADJUSTMENT_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {ADJUSTMENT_KIND_LABEL[k]}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Description</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Cross-border bonus, fuel advance"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount_cad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Amount (CAD)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={0}
                      value={field.value ?? 0}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? 0 : Number(e.target.value),
                        )
                      }
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAdding(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      ) : null}

      {adjustments.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
          No adjustments. Add bonuses, deductions, or advances above.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Kind</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              {!locked ? <th className="px-4 py-2" /> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {adjustments.map((a) => {
              const sign = adjustmentSign(a.kind)
              return (
                <tr key={a.id}>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${signTone[a.kind] ?? ""}`}
                    >
                      {ADJUSTMENT_KIND_LABEL[a.kind]}
                    </span>
                  </td>
                  <td className="px-4 py-2">{a.description}</td>
                  <td
                    className={`px-4 py-2 text-right font-semibold tabular-nums ${signTone[a.kind] ?? ""}`}
                  >
                    {sign === -1 ? "−" : "+"}
                    {CAD.format(Number(a.amount_cad))}
                  </td>
                  {!locked ? (
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onRemove(a.id)}
                        disabled={pending}
                        aria-label="Remove adjustment"
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
