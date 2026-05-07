"use client"

import * as React from "react"
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card"

import { cn } from "@/lib/utils"

function PreviewCard({ ...props }: PreviewCardPrimitive.Root.Props) {
  return <PreviewCardPrimitive.Root data-slot="preview-card" {...props} />
}

function PreviewCardTrigger({
  ...props
}: PreviewCardPrimitive.Trigger.Props) {
  return (
    <PreviewCardPrimitive.Trigger data-slot="preview-card-trigger" {...props} />
  )
}

// Liquid-glass styling: dark midnight surface at ~78% opacity with backdrop
// blur + saturation, a 1px white highlight along the top edge to suggest
// refraction, a subtle teal radial wash, and a soft layered drop shadow.
// Text inside inherits brand-cloud so previews can use opacity-based shades
// (opacity-60, opacity-70) instead of theme tokens that would clash on dark.
function PreviewCardContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "right",
  sideOffset = 12,
  children,
  ...props
}: PreviewCardPrimitive.Popup.Props &
  Pick<
    PreviewCardPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <PreviewCardPrimitive.Portal>
      <PreviewCardPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PreviewCardPrimitive.Popup
          data-slot="preview-card-content"
          className={cn(
            "relative z-50 origin-(--transform-origin) overflow-hidden rounded-xl border border-white/10 bg-brand-midnight/80 text-brand-cloud backdrop-blur-2xl backdrop-saturate-150 outline-hidden duration-150 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.12),0_24px_48px_-16px_rgba(10,14,26,0.45),0_4px_16px_-4px_rgba(10,14,26,0.25)] data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          {/* Subtle teal radial wash at the top to mimic the marketing-site
              hero treatment. Pointer-events: none so it never blocks input. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,160,146,0.22)_0%,transparent_70%)]"
          />
          {children}
        </PreviewCardPrimitive.Popup>
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  )
}

export { PreviewCard, PreviewCardContent, PreviewCardTrigger }
