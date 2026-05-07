"use client"

import Image from "next/image"
import { useState, useTransition } from "react"
import { Bell } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { signOutAction } from "@/app/(public)/login/actions"
import type { CurrentProfile } from "@/lib/auth"

import { AvatarPickerDialog } from "./avatar-picker-dialog"
import { UserAvatar } from "./user-avatar"

const ROLE_LABEL: Record<CurrentProfile["role"], string> = {
  admin: "Admin",
  dispatcher: "Dispatcher",
  driver: "Driver",
  accounting: "Accounting",
}

export function AppTopbar({ profile }: { profile: CurrentProfile }) {
  const [pending, startTransition] = useTransition()
  const [pickerOpen, setPickerOpen] = useState(false)

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
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Notifications"
                className="border-white/15 bg-transparent text-brand-cloud hover:bg-white/5 hover:text-brand-cloud"
              />
            }
          >
            <Bell className="size-4" />
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-80 p-0 text-foreground"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Notifications</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Soon
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Bell
                className="size-7 text-muted-foreground/40"
                aria-hidden="true"
              />
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="max-w-[220px] text-xs text-muted-foreground">
                New notifications will appear here once messaging and alerts
                ship.
              </p>
            </div>
          </PopoverContent>
        </Popover>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-label="Change avatar"
          title="Change avatar"
          className="rounded-full transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal-light focus-visible:ring-offset-2 focus-visible:ring-offset-brand-midnight"
        >
          <UserAvatar
            url={profile.avatar_url}
            seed={profile.id}
            name={profile.full_name}
            size="md"
          />
        </button>

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

      <AvatarPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        currentName={profile.full_name}
        currentUrl={profile.avatar_url}
      />
    </header>
  )
}
