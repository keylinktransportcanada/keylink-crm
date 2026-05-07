"use client"

import Image from "next/image"
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
    <header className="flex items-center justify-between border-b border-white/10 bg-brand-midnight px-4 py-3 lg:px-6">
      <div className="flex items-center gap-3">
        <Image
          src="/logo-keylink.png"
          alt="Keylink Transport"
          width={140}
          height={36}
          priority
          className="h-7 w-auto"
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden flex-col items-end gap-0.5 leading-tight sm:flex">
          <span className="text-sm font-medium text-brand-cloud">
            {profile.full_name || "Unnamed"}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-brand-cloud/55">
              {profile.employee_id ?? "No ID"}
            </span>
            <Badge className="border-transparent bg-brand-teal/20 text-[10px] font-semibold uppercase tracking-wider text-brand-teal-light">
              {ROLE_LABEL[profile.role]}
            </Badge>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(() => signOutAction())}
          className="border-white/15 bg-transparent text-brand-cloud hover:bg-white/5 hover:text-brand-cloud"
        >
          {pending ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </header>
  )
}
