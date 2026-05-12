"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { MapPinned, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  createTripDistance,
  deleteTripDistance,
} from "@/app/(authenticated)/accounting/ifta/actions"
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
import { CA_PROVINCES, US_STATES } from "@/lib/regions"
import {
  tripDistanceSchema,
  type TripDistanceInput,
} from "@/lib/schemas/ifta"

export type LoadDistance = {
  id: string
  jurisdiction: string
  distance_km: number
}

const JURISDICTION_LABEL: Record<string, string> = {
  ...Object.fromEntries(CA_PROVINCES.map((r) => [r.code, `${r.name} (CA)`])),
  ...Object.fromEntries(US_STATES.map((r) => [r.code, `${r.name} (US)`])),
}

const formatNum = (value: number) =>
  new Intl.NumberFormat("en-CA").format(Math.round(value))

export function TripDistancesCard({
  loadId,
  distances,
  canEdit,
}: {
  loadId: string
  distances: LoadDistance[]
  canEdit: boolean
}) {
  const [adding, setAdding] = useState(false)
  const router = useRouter()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const total = distances.reduce((s, d) => s + Number(d.distance_km ?? 0), 0)

  const handleDelete = (id: string) => {
    if (!confirm("Delete this distance entry?")) return
    setPendingDeleteId(id)
    startTransition(async () => {
      const result = await deleteTripDistance(id)
      setPendingDeleteId(null)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Distance removed.")
      router.refresh()
    })
  }

  return (
    <>
      {distances.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">
            No kilometres recorded yet for this load.{" "}
            {canEdit ? (
              <>Add one row per jurisdiction the truck crossed.</>
            ) : null}
          </p>
          {canEdit ? (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus />
              Add distance
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="border-b border-border px-2 py-2 text-left">
                    Jurisdiction
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    Kilometres
                  </th>
                  {canEdit ? (
                    <th className="border-b border-border px-2 py-2" />
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {distances.map((d) => (
                  <tr key={d.id}>
                    <td className="border-b border-border/50 px-2 py-2">
                      <span className="font-mono text-xs font-semibold">
                        {d.jurisdiction}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {JURISDICTION_LABEL[d.jurisdiction] ?? "—"}
                      </span>
                    </td>
                    <td className="border-b border-border/50 px-2 py-2 text-right tabular-nums">
                      {formatNum(Number(d.distance_km ?? 0))}
                    </td>
                    {canEdit ? (
                      <td className="border-b border-border/50 px-2 py-2 text-right">
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={pendingDeleteId === d.id}
                          onClick={() => handleDelete(d.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-semibold">
                  <td className="px-2 py-2">Total</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatNum(total)}
                  </td>
                  {canEdit ? <td /> : null}
                </tr>
              </tbody>
            </table>
          </div>
          {canEdit ? (
            <div>
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <Plus />
                Add another jurisdiction
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {adding ? (
        <QuickDistanceDialog
          loadId={loadId}
          existingCodes={new Set(distances.map((d) => d.jurisdiction))}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </>
  )
}

function QuickDistanceDialog({
  loadId,
  existingCodes,
  onClose,
}: {
  loadId: string
  existingCodes: Set<string>
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const form = useForm<TripDistanceInput>({
    resolver: zodResolver(tripDistanceSchema),
    defaultValues: {
      load_id: loadId,
      jurisdiction: "" as unknown as TripDistanceInput["jurisdiction"],
      distance_km: 0 as unknown as number,
    },
  })

  const onSubmit = (values: TripDistanceInput) => {
    startTransition(async () => {
      const result = await createTripDistance(values)
      if ("error" in result) {
        const formError = result.error._form?.[0]
        if (formError) toast.error(formError)
        for (const [field, messages] of Object.entries(result.error)) {
          if (field === "_form") continue
          if (messages && messages.length > 0) {
            form.setError(field as keyof TripDistanceInput, {
              message: messages[0],
            })
          }
        }
        return
      }
      toast.success("Distance recorded.")
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinned className="size-4" />
            Add trip distance
          </DialogTitle>
          <DialogDescription>
            Kilometres driven in this jurisdiction on this load. One row per
            jurisdiction crossed — the IFTA quarterly summary aggregates them.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="jurisdiction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jurisdiction</FormLabel>
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick a jurisdiction…">
                          {(v: string | null) =>
                            v
                              ? JURISDICTION_LABEL[v] ?? v
                              : "Pick a jurisdiction…"
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Canada</SelectLabel>
                        {CA_PROVINCES.map((r) => (
                          <SelectItem
                            key={r.code}
                            value={r.code}
                            disabled={existingCodes.has(r.code)}
                          >
                            {r.code} · {r.name}
                            {existingCodes.has(r.code) ? " — added" : ""}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>United States</SelectLabel>
                        {US_STATES.map((r) => (
                          <SelectItem
                            key={r.code}
                            value={r.code}
                            disabled={existingCodes.has(r.code)}
                          >
                            {r.code} · {r.name}
                            {existingCodes.has(r.code) ? " — added" : ""}
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
              name="distance_km"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Distance (km)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      autoFocus
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? 0 : Number(e.target.value),
                        )
                      }
                    />
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
                {pending ? "Saving…" : "Save distance"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
