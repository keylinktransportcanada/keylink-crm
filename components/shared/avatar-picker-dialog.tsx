"use client"

import { useState, useTransition } from "react"
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
import { AVATARS } from "@/lib/avatars"
import { cn } from "@/lib/utils"

import { UserAvatar } from "./user-avatar"

import { updateMyAvatar } from "@/app/(authenticated)/account/actions"

const INITIALS_KEY = "__initials__"

type Picked = typeof INITIALS_KEY | string

export function AvatarPickerDialog({
  open,
  onOpenChange,
  currentUserId,
  currentName,
  currentUrl,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
  currentName?: string | null
  currentUrl?: string | null
}) {
  const [picked, setPicked] = useState<Picked | null>(null)
  const [pending, startTransition] = useTransition()

  const currentKey: Picked = currentUrl ? currentUrl : INITIALS_KEY

  const handleSave = () => {
    if (picked === null) return
    const nextUrl = picked === INITIALS_KEY ? null : picked
    startTransition(async () => {
      const result = await updateMyAvatar(nextUrl)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Avatar updated.")
      onOpenChange(false)
    })
  }

  const tileClass = (key: Picked) => {
    const isPicked = picked === key
    const isCurrent = !picked && currentKey === key
    return cn(
      "flex items-center justify-center rounded-lg p-1.5 transition-colors",
      isPicked
        ? "bg-brand-teal/10 ring-2 ring-brand-teal"
        : isCurrent
          ? "ring-1 ring-brand-teal/40"
          : "hover:bg-muted",
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setPicked(null)
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose your avatar</DialogTitle>
          <DialogDescription>
            Use your initials or pick a 3D character. Initials are the default
            for new accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[420px] grid-cols-5 gap-2 overflow-y-auto p-1 sm:grid-cols-6">
          <button
            type="button"
            aria-pressed={picked === INITIALS_KEY}
            title="Use my initials"
            onClick={() => setPicked(INITIALS_KEY)}
            className={tileClass(INITIALS_KEY)}
          >
            <UserAvatar
              url={null}
              seed={currentUserId}
              name={currentName}
              size="lg"
            />
          </button>

          {AVATARS.map((avatar) => (
            <button
              key={avatar.id}
              type="button"
              aria-pressed={picked === avatar.url}
              title={avatar.name}
              onClick={() => setPicked(avatar.url)}
              className={tileClass(avatar.url)}
            >
              <UserAvatar
                url={avatar.url}
                seed={avatar.id}
                name={`${avatar.name}, ${currentName ?? "preview"}`}
                size="lg"
              />
            </button>
          ))}
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={picked === null || picked === currentKey || pending}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
