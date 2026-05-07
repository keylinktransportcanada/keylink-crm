import Image from "next/image"

import { getInitials, getInitialsColor } from "@/lib/avatars"
import { cn } from "@/lib/utils"

const SIZE_CLASSES = {
  sm: "size-7 text-[11px]",
  md: "size-9 text-xs",
  lg: "size-12 text-sm",
  xl: "size-16 text-lg",
} as const

const PIXEL_SIZE = {
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
} as const

export type AvatarSize = keyof typeof SIZE_CLASSES

export function UserAvatar({
  url,
  seed,
  name,
  size = "md",
  className,
}: {
  url?: string | null
  seed: string
  name?: string | null
  size?: AvatarSize
  className?: string
}) {
  // No URL = use initials with a deterministic background color.
  if (!url) {
    const color = getInitialsColor(seed)
    return (
      <span
        aria-label={name ? `${name} avatar` : "Avatar"}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide ring-1 ring-inset ring-white/10",
          SIZE_CLASSES[size],
          color.bg,
          color.text,
          className,
        )}
      >
        {getInitials(name)}
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-cloud/40 ring-1 ring-inset ring-white/10",
        SIZE_CLASSES[size],
        className,
      )}
    >
      <Image
        src={url}
        alt={name ? `${name} avatar` : "Avatar"}
        width={PIXEL_SIZE[size]}
        height={PIXEL_SIZE[size]}
        unoptimized
        className="size-full object-cover"
      />
    </span>
  )
}
