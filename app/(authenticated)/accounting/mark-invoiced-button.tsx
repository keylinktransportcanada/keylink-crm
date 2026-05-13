"use client"

// Inline "Mark invoiced" button for the accounting invoice queue.
// Flips the load's status from delivered → invoiced via the existing
// transitionLoadStatus server action, which (post-Phase 12) also fires
// the branded invoice-ready email to the customer.

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { transitionLoadStatus } from "@/app/(authenticated)/loads/actions"
import { Button } from "@/components/ui/button"

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
      const result = await transitionLoadStatus({
        id: loadId,
        status: "invoiced",
      })
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
