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
      className={cn(
        "flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 bg-brand-midnight px-3 py-2",
        "lg:w-56 lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0 lg:px-3 lg:py-4",
      )}
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
              "relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-white/5 text-brand-cloud"
                : "text-brand-cloud/55 hover:bg-white/5 hover:text-brand-cloud",
            )}
          >
            {/* Teal active-state bar — vertical on lg+, hidden on mobile */}
            {active ? (
              <span
                aria-hidden="true"
                className="absolute inset-y-1.5 left-0 hidden w-0.5 rounded-full bg-brand-teal-light lg:block"
              />
            ) : null}
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
