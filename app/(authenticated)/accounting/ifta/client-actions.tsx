"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Fuel, MapPinned, Plus, Trash2 } from "lucide-react"
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
import { CA_PROVINCES, US_STATES } from "@/lib/regions"
import {
  fuelRecordSchema,
  tripDistanceSchema,
  type FuelRecordInput,
  type TripDistanceInput,
} from "@/lib/schemas/ifta"

import {
  createFuelRecord,
  createTripDistance,
  deleteFuelRecord,
  deleteTripDistance,
} from "./actions"

const JURISDICTION_LABEL: Record<string, string> = {
  ...Object.fromEntries(CA_PROVINCES.map((r) => [r.code, `${r.name} (CA)`])),
  ...Object.fromEntries(US_STATES.map((r) => [r.code, `${r.name} (US)`])),
}

function JurisdictionField({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  return (
    <FormItem>
      <FormLabel>Jurisdiction</FormLabel>
      <Select value={value || ""} onValueChange={(v) => onChange(v ?? "")}>
        <FormControl>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pick a jurisdiction…">
              {(v: string | null) =>
                v ? JURISDICTION_LABEL[v] ?? v : "Pick a jurisdiction…"
              }
            </SelectValue>
          </SelectTrigger>
        </FormControl>
        <SelectContent>
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
      {error ? <FormMessage>{error}</FormMessage> : <FormMessage />}
    </FormItem>
  )
}

// =============================================================================
// FUEL ENTRY
// =============================================================================

export function AddFuelButton({
  trucks,
  drivers,
}: {
  trucks: Array<{ id: string; truck_number: string }>
  drivers: Array<{ id: string; full_name: string }>
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus />
        Add fuel
      </Button>
      {open ? (
        <FuelDialog
          trucks={trucks}
          drivers={drivers}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

function FuelDialog({
  trucks,
  drivers,
  onClose,
}: {
  trucks: Array<{ id: string; truck_number: string }>
  drivers: Array<{ id: string; full_name: string }>
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const form = useForm<FuelRecordInput>({
    resolver: zodResolver(fuelRecordSchema),
    defaultValues: {
      truck_id: "" as unknown as string,
      driver_id: null,
      purchase_date: new Date().toISOString().slice(0, 10),
      jurisdiction: "" as unknown as FuelRecordInput["jurisdiction"],
      litres: 0 as unknown as number,
      total_cad: 0 as unknown as number,
      odometer_km: null,
      vendor: "",
    },
  })

  const onSubmit = (values: FuelRecordInput) => {
    startTransition(async () => {
      const result = await createFuelRecord(values)
      if ("error" in result) {
        const formError = result.error._form?.[0]
        if (formError) toast.error(formError)
        for (const [field, messages] of Object.entries(result.error)) {
          if (field === "_form") continue
          if (messages && messages.length > 0) {
            form.setError(field as keyof FuelRecordInput, {
              message: messages[0],
            })
          }
        }
        return
      }
      toast.success("Fuel entry recorded.")
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fuel className="size-4" />
            Add fuel purchase
          </DialogTitle>
          <DialogDescription>
            Per-jurisdiction fuel for IFTA quarterly reporting.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="purchase_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="jurisdiction"
                render={({ field }) => (
                  <JurisdictionField
                    value={field.value || ""}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="truck_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Truck</FormLabel>
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick a truck…">
                          {(v: string | null) =>
                            v
                              ? trucks.find((t) => t.id === v)?.truck_number ??
                                "—"
                              : "Pick a truck…"
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {trucks.map((t) => (
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
              name="driver_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Driver{" "}
                    <span className="text-xs text-muted-foreground">
                      (optional)
                    </span>
                  </FormLabel>
                  <Select
                    value={field.value ?? "_none"}
                    onValueChange={(v) =>
                      field.onChange(v === "_none" ? null : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            if (!v || v === "_none") return "Unassigned"
                            return (
                              drivers.find((d) => d.id === v)?.full_name ?? "—"
                            )
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none">Unassigned</SelectItem>
                      {drivers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="litres"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Litres</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.001"
                        min={0}
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
              <FormField
                control={form.control}
                name="total_cad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total (CAD)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="odometer_km"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Odometer{" "}
                      <span className="text-xs text-muted-foreground">
                        (km, optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min={0}
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
                name="vendor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Vendor{" "}
                      <span className="text-xs text-muted-foreground">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Petro-Canada, Husky…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save entry"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteFuelButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size="xs"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this fuel entry?")) return
        startTransition(async () => {
          const result = await deleteFuelRecord(id)
          if ("error" in result) {
            toast.error(result.error)
            return
          }
          toast.success("Deleted.")
          router.refresh()
        })
      }}
    >
      <Trash2 className="size-3.5" />
    </Button>
  )
}

// =============================================================================
// TRIP DISTANCE
// =============================================================================

export function AddDistanceButton({
  loads,
}: {
  loads: Array<{ id: string; load_number: string; delivery_date: string | null }>
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus />
        Add distance
      </Button>
      {open ? (
        <DistanceDialog loads={loads} onClose={() => setOpen(false)} />
      ) : null}
    </>
  )
}

function DistanceDialog({
  loads,
  onClose,
}: {
  loads: Array<{ id: string; load_number: string; delivery_date: string | null }>
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const form = useForm<TripDistanceInput>({
    resolver: zodResolver(tripDistanceSchema),
    defaultValues: {
      load_id: "" as unknown as string,
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
      toast.success("Trip distance recorded.")
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinned className="size-4" />
            Add trip distance
          </DialogTitle>
          <DialogDescription>
            Per-jurisdiction kilometres for a single load. Add one row per
            jurisdiction the truck crossed.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="load_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Load</FormLabel>
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick a load…">
                          {(v: string | null) =>
                            v
                              ? loads.find((l) => l.id === v)?.load_number ??
                                "—"
                              : "Pick a load…"
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {loads.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No eligible loads.
                        </div>
                      ) : (
                        loads.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.load_number}
                            {l.delivery_date ? ` · ${l.delivery_date}` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="jurisdiction"
              render={({ field }) => (
                <JurisdictionField
                  value={field.value || ""}
                  onChange={field.onChange}
                />
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
                {pending ? "Saving…" : "Save entry"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteDistanceButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size="xs"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this distance entry?")) return
        startTransition(async () => {
          const result = await deleteTripDistance(id)
          if ("error" in result) {
            toast.error(result.error)
            return
          }
          toast.success("Deleted.")
          router.refresh()
        })
      }}
    >
      <Trash2 className="size-3.5" />
    </Button>
  )
}
