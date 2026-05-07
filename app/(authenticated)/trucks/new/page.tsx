import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { requireRole } from "@/lib/auth"

import { TruckForm } from "../truck-form"

export default async function NewTruckPage() {
  await requireRole(["admin", "dispatcher"])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/trucks"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to trucks
        </Link>
      </div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New truck</h1>
        <p className="text-sm text-muted-foreground">
          Truck number and status are required. Compliance dates can be filled
          in later.
        </p>
      </header>

      <TruckForm mode={{ kind: "create" }} />
    </div>
  )
}
