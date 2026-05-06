"use client"

import { useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { signOutAction } from "@/app/(public)/login/actions"
import type { CurrentProfile } from "@/lib/auth"

const ROLE_LABEL: Record<CurrentProfile["role"], string> = {
  admin: "Admin",
  dispatcher: "Dispatcher",
  driver: "Driver",
  accounting: "Accounting",
}

export function AppTopbar({ profile }: { profile: CurrentProfile }) {
  const [pending, startTransition] = useTransition()

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3 lg:px-6">
      <div className="flex flex-col leading-tight">
        <span className="text-base font-semibold tracking-tight">
          Keylink Transport
        </span>
        <span className="text-xs text-muted-foreground">CRM</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden flex-col items-end gap-0.5 leading-tight sm:flex">
          <span className="text-sm font-medium">
            {profile.full_name || "Unnamed"}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {profile.employee_id ?? "No ID"}
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {ROLE_LABEL[profile.role]}
            </Badge>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(() => signOutAction())}
        >
          {pending ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </header>
  )
}
