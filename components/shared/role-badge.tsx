import {
  Calculator,
  RadioTower,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { ROLE_VALUES } from "@/lib/schemas/employees"

type Role = (typeof ROLE_VALUES)[number]

type RoleMeta = {
  label: string
  Icon: LucideIcon
  /** Tailwind classes for a subtle pill on a light surface (table rows, cards). */
  pill: string
  /** Tailwind text color for an inline icon (used in lists where the pill bg is unwanted). */
  iconColor: string
}

export const ROLE_META: Record<Role, RoleMeta> = {
  admin: {
    label: "Admin",
    Icon: ShieldCheck,
    pill: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200/70",
    iconColor: "text-blue-600",
  },
  dispatcher: {
    label: "Dispatcher",
    Icon: RadioTower,
    pill: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200/70",
    iconColor: "text-teal-600",
  },
  driver: {
    label: "Driver",
    Icon: Truck,
    pill: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200/70",
    iconColor: "text-amber-700",
  },
  accounting: {
    label: "Accounting",
    Icon: Calculator,
    pill: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200/70",
    iconColor: "text-slate-600",
  },
}

export function RoleBadge({
  role,
  className,
}: {
  role: Role
  className?: string
}) {
  const meta = ROLE_META[role]
  const { Icon } = meta
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium leading-none",
        meta.pill,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  )
}
