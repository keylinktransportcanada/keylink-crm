"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

// Liquid-glass toast styling. Every sonner toast picks these classNames up
// via toastOptions.classNames, matching the midnight-glass surface used by
// the topbar, sidebar, KPI cards, and notification popovers.
const TOAST_BASE = [
  // layout / spacing
  "!flex !items-start !gap-3 !rounded-xl !p-4 !pr-10 !min-h-[64px]",
  // glass surface
  "!bg-brand-midnight/85 !text-brand-cloud !border !border-white/10",
  "!backdrop-blur-2xl !backdrop-saturate-150",
  // shadow + inset highlight
  "!shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_24px_48px_-16px_rgba(10,14,26,0.55),0_4px_16px_-4px_rgba(10,14,26,0.35)]",
].join(" ")

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-emerald-300" />,
        info: <InfoIcon className="size-4 text-blue-300" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-300" />,
        error: <OctagonXIcon className="size-4 text-red-300" />,
        loading: <Loader2Icon className="size-4 animate-spin text-brand-cloud" />,
      }}
      toastOptions={{
        classNames: {
          toast: TOAST_BASE,
          // Title / description: readable cloud-white tones on the dark glass.
          title: "!text-sm !font-semibold !text-brand-cloud !leading-tight",
          description: "!text-xs !text-brand-cloud/75 !leading-snug",
          // Icon column.
          icon: "!mt-0.5",
          // Primary action button (e.g. the "Open" link on inspection-message
          // toasts) — gold pill matching the rest of the brand.
          actionButton:
            "!rounded-md !bg-brand-gold !px-2.5 !py-1 !text-[11px] !font-semibold !text-brand-navy hover:!bg-brand-gold-light",
          cancelButton:
            "!rounded-md !border !border-white/15 !bg-white/5 !px-2.5 !py-1 !text-[11px] !font-semibold !text-brand-cloud hover:!bg-white/10",
          closeButton:
            "!size-6 !rounded-md !border !border-white/15 !bg-white/5 !text-brand-cloud/70 hover:!bg-white/15 hover:!text-brand-cloud",
          // Severity tints on the left edge — keeps default toasts dark while
          // success/info/warning/error pick up subtle accent borders.
          success: "!border-l-4 !border-l-emerald-400",
          info: "!border-l-4 !border-l-blue-400",
          warning: "!border-l-4 !border-l-amber-400",
          error: "!border-l-4 !border-l-red-400",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
