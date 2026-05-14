import { forwardRef, type CSSProperties, type ComponentPropsWithoutRef } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Wraps a lucide icon so its SVG <path> elements pick up the shared
// `.icon-trace` CSS class. The actual animation lives in app/globals.css —
// hosts: `.kpi-tile` (continuous heart-monitor redraw), `.chat-icon-host`
// and `.bell-icon-host` (hover-only redraw). Color and dimensions are
// preserved — only stroke-dashoffset is animated, so the icon never
// visibly resizes.
//
// The optional `duration` and `delay` options are exposed as CSS custom
// properties on the SVG (read by the .icon-trace rule), so two icons on
// the same KPI strip never animate in lockstep — a slightly different
// duration plus a negative delay means each waveform is permanently out
// of phase with its neighbours.
export function withTraceAnimation(
  BaseIcon: LucideIcon,
  options?: { duration?: string; delay?: string },
): LucideIcon {
  const inlineStyle =
    options && (options.duration || options.delay)
      ? ({
          ...(options.duration ? { "--trace-duration": options.duration } : {}),
          ...(options.delay ? { "--trace-delay": options.delay } : {}),
        } as CSSProperties)
      : undefined

  const Wrapped = forwardRef<
    SVGSVGElement,
    ComponentPropsWithoutRef<typeof BaseIcon>
  >(function Wrapped({ className, style, ...props }, ref) {
    return (
      <BaseIcon
        ref={ref}
        {...props}
        className={cn(className, "icon-trace")}
        style={inlineStyle ? { ...inlineStyle, ...style } : style}
      />
    )
  })
  Wrapped.displayName = `Animated(${
    BaseIcon.displayName || BaseIcon.name || "Icon"
  })`
  return Wrapped as unknown as LucideIcon
}
