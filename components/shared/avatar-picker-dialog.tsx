"use client"

import { useState, useTransition } from "react"
import { Shuffle } from "lucide-react"
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
import { cn } from "@/lib/utils"

import {
  generateAvatarSeed,
  getDefaultAvatarUrl,
  UserAvatar,
} from "./user-avatar"

import { updateMyAvatar } from "@/app/(authenticated)/account/actions"

const TILE_COUNT = 12

function makeSeeds(count: number): string[] {
  return Array.from({ length: count }, () => generateAvatarSeed())
}

export function AvatarPickerDialog({
  open,
  onOpenChange,
  currentName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName?: string | null
}) {
  const [seeds, setSeeds] = useState<string[]>(() => makeSeeds(TILE_COUNT))
  const [picked, setPicked] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleSave = () => {
    if (!picked) return
    const url = getDefaultAvatarUrl(picked)
    startTransition(async () => {
      const result = await updateMyAvatar(url)
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
        if (!o) {
          setPicked(null)
        }
        onOpenChange(o)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose your avatar</DialogTitle>
          <DialogDescription>
            Pick one of the options below. Hit Shuffle if you want different
            choices.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-3">
          {seeds.map((seed) => (
            <button
              key={seed}
              type="button"
              aria-pressed={picked === seed}
              onClick={() => setPicked(seed)}
              className={cn(
                "flex items-center justify-center rounded-lg p-2 transition-colors",
                picked === seed
                  ? "bg-brand-teal/10 ring-2 ring-brand-teal"
                  : "hover:bg-muted",
              )}
            >
              <UserAvatar seed={seed} name={currentName} size="lg" />
            </button>
          ))}
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSeeds(makeSeeds(TILE_COUNT))
              setPicked(null)
            }}
            disabled={pending}
          >
            <Shuffle className="size-4" />
            Shuffle
          </Button>
          <div className="flex gap-2">
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
              disabled={!picked || pending}
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
