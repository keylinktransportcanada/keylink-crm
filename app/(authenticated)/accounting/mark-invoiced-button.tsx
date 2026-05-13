"use client"

// Inline "Mark invoiced" button for the accounting invoice queue.
// Flips the load's status delivered → invoiced and fires the customer
// invoice email. Imports the action from its co-located server file
// (./actions) to avoid a cross-route-group import that earlier produced
// an SSR crash on /accounting.

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

import { markLoadInvoiced } from "./actions"

export function MarkInvoicedButton({
  loadId,
  loadNumber,
}: {
  loadId: string
  loadNumber: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const onClick = (e: React.MouseEvent) => {
    // Prevent the row's "open load detail" click target underneath from
    // firing when the button is pressed.
    e.preventDefault()
    e.stopPropagation()

    start(async () => {
      const result = await markLoadInvoiced(loadId)
      if ("error" in result) {
        toast.error(`Couldn't mark invoiced: ${result.error}`)
        return
      }
      toast.success(`${loadNumber} marked invoiced — email sent to customer.`)
      router.refresh()
    })
  }

  return (
    <Button
      size="sm"
      variant="default"
      onClick={onClick}
      disabled={pending}
      className="relative z-10"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <CheckCircle2 className="size-4" />
      )}
      {pending ? "Marking…" : "Mark invoiced"}
    </Button>
  )
}
