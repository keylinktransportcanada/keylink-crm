import Image from "next/image"

import { cn } from "@/lib/utils"

const NOTIONISTS_URL = "https://api.dicebear.com/9.x/notionists/svg"

export function getDefaultAvatarUrl(seed: string): string {
  return `${NOTIONISTS_URL}?seed=${encodeURIComponent(seed)}`
}

export function generateAvatarSeed(): string {
  return Math.random().toString(36).slice(2, 12)
}

const SIZE_CLASSES = {
  sm: "size-7",
  md: "size-9",
  lg: "size-12",
  xl: "size-16",
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
  const finalUrl = url || getDefaultAvatarUrl(seed)
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-teal/10 ring-1 ring-inset ring-white/10",
        SIZE_CLASSES[size],
        className,
      )}
    >
      <Image
        src={finalUrl}
        alt={name ? `${name} avatar` : "Avatar"}
        width={PIXEL_SIZE[size]}
        height={PIXEL_SIZE[size]}
        unoptimized
        className="size-full object-cover"
      />
    </span>
  )
}
