"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { navItemsForRole } from "@/lib/nav"
import type { Role } from "@/lib/auth"

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname()
  const items = navItemsForRole(role)

  return (
    <nav
      aria-label="Primary"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2 lg:w-56 lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0 lg:p-3"
    >
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
