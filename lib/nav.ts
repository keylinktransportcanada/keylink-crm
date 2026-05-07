import {
  Building2,
  Container,
  LayoutDashboard,
  Package,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react"

import type { Role } from "@/lib/auth"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  roles: Role[]
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "dispatcher", "driver", "accounting"],
  },
  {
    label: "Customers",
    href: "/customers",
    icon: Building2,
    roles: ["admin", "dispatcher", "accounting"],
  },
  {
    label: "Trucks",
    href: "/trucks",
    icon: Truck,
    roles: ["admin", "dispatcher", "accounting"],
  },
  {
    label: "Trailers",
    href: "/trailers",
    icon: Container,
    roles: ["admin", "dispatcher", "accounting"],
  },
  {
    label: "Loads",
    href: "/loads",
    icon: Package,
    roles: ["admin", "dispatcher", "driver", "accounting"],
  },
  {
    label: "Employees",
    href: "/admin/employees",
    icon: Users,
    roles: ["admin"],
  },
]

export function navItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}
