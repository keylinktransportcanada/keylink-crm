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

export function AvatarPickerDialog({
  open,
  onOpenChange,
  currentName,
  currentUrl,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName?: string | null
  currentUrl?: string | null
}) {
  const [pickedUrl, setPickedUrl] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleSave = () => {
    if (!pickedUrl) return
    startTransition(async () => {
      const result = await updateMyAvatar(pickedUrl)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Avatar updated.")
      onOpenChange(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setPickedUrl(null)
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose your avatar</DialogTitle>
          <DialogDescription>
            Pick one of the 3D characters below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[420px] grid-cols-5 gap-2 overflow-y-auto p-1 sm:grid-cols-6">
          {AVATARS.map((avatar) => {
            const isPicked = pickedUrl === avatar.url
            const isCurrent = !pickedUrl && currentUrl === avatar.url
            return (
              <button
                key={avatar.id}
                type="button"
                aria-pressed={isPicked}
                title={avatar.name}
                onClick={() => setPickedUrl(avatar.url)}
                className={cn(
                  "flex items-center justify-center rounded-lg p-1.5 transition-colors",
                  isPicked
                    ? "bg-brand-teal/10 ring-2 ring-brand-teal"
                    : isCurrent
                      ? "ring-1 ring-brand-teal/40"
                      : "hover:bg-muted",
                )}
              >
                <UserAvatar
                  url={avatar.url}
                  seed={avatar.id}
                  name={`${avatar.name}, ${currentName ?? "preview"}`}
                  size="lg"
                />
              </button>
            )
          })}
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
            disabled={!pickedUrl || pending}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
