"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Lock, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  markPaidSchema,
  type MarkPaidInput,
  type SettlementStatus,
} from "@/lib/schemas/settlements"

import {
  deleteSettlement,
  finalizeSettlement,
  markPaid,
  reopenSettlement,
} from "../actions"

const CAD = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 2,
})

export function SettlementStatusActions({
  settlementId,
  status,
  totalCad,
}: {
  settlementId: string
  status: SettlementStatus
  totalCad: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [payOpen, setPayOpen] = useState(false)

  const payForm = useForm<MarkPaidInput>({
    resolver: zodResolver(markPaidSchema),
    defaultValues: {
      settlement_id: settlementId,
      paid_at: new Date().toISOString().slice(0, 10),
      paid_method: "etransfer",
      paid_reference: "",
    },
  })

  const onFinalize = () => {
    startTransition(async () => {
      const result = await finalizeSettlement(settlementId)
      if ("error" in result) {
        toast.error(result.error._form?.[0] ?? "Failed to finalize.")
        return
      }
      toast.success("Settlement finalized.")
      router.refresh()
    })
  }

  const onReopen = () => {
    if (!confirm("Reopen this settlement to make changes?")) return
    startTransition(async () => {
      const result = await reopenSettlement(settlementId)
      if ("error" in result) {
        toast.error(result.error._form?.[0] ?? "Failed to reopen.")
        return
      }
      toast.success("Settlement reopened.")
      router.refresh()
    })
  }

  const onDelete = () => {
    if (
      !confirm(
        "Delete this draft settlement? The loads on it will go back into the eligible pool.",
      )
    )
      return
    startTransition(async () => {
      const result = await deleteSettlement(settlementId)
      if (result && "error" in result) {
        toast.error(result.error._form?.[0] ?? "Failed to delete.")
        return
      }
      // Server action redirects on success.
    })
  }

  const onMarkPaid = (values: MarkPaidInput) => {
    startTransition(async () => {
      const result = await markPaid(values)
      if ("error" in result) {
        const msg = result.error._form?.[0]
        if (msg) toast.error(msg)
        for (const [field, messages] of Object.entries(result.error)) {
          if (field === "_form") continue
          if (messages && messages.length > 0) {
            payForm.setError(field as keyof MarkPaidInput, {
              message: messages[0],
            })
          }
        }
        return
      }
      toast.success("Payment recorded.")
      setPayOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "draft" ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDelete}
            disabled={pending}
            className="gap-1.5"
          >
            <Trash2 className="size-3.5" />
            Delete draft
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onFinalize}
            disabled={pending}
            className="gap-1.5"
          >
            <Lock className="size-3.5" />
            Finalize
          </Button>
        </>
      ) : null}

      {status === "finalized" ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReopen}
            disabled={pending}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            Reopen
          </Button>

          <Dialog open={payOpen} onOpenChange={setPayOpen}>
            <DialogTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  className="gap-1.5"
                />
              }
            >
              <CheckCircle2 className="size-3.5" />
              Mark paid
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Record payment</DialogTitle>
                <DialogDescription>
                  Total to pay: {CAD.format(totalCad)}
                </DialogDescription>
              </DialogHeader>
              <Form {...payForm}>
                <form
                  onSubmit={payForm.handleSubmit(onMarkPaid)}
                  className="flex flex-col gap-3"
                >
                  <FormField
                    control={payForm.control}
                    name="paid_at"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={payForm.control}
                    name="paid_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Method</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="etransfer / cheque / direct deposit"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={payForm.control}
                    name="paid_reference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reference (optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="cheque #, e-transfer code…"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPayOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={pending}>
                      {pending ? "Saving…" : "Record payment"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </>
      ) : null}

      {status === "paid" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReopen}
          disabled
          className="gap-1.5"
        >
          <Lock className="size-3.5" />
          Locked
        </Button>
      ) : null}
    </div>
  )
}
